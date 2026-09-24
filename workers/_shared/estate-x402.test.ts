import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE_USDC } from "../../scripts/lib/evm-chains.ts";
import { planPaymentLink, planUsd } from "../../src/lib/plans.ts";
import { X402_PUBLISHED_PAY_TO } from "../../src/lib/x402.ts";
import {
  isSisterX402Path,
  sisterOrigin,
  tryHandleSisterX402,
} from "./estate-x402.ts";
import { sisterBrandFromHost } from "./estate-x402-catalog.ts";
import type { SisterDiscoveryBrand } from "./estate-agent-discovery.ts";

const BRANDS: Array<{ brand: SisterDiscoveryBrand; host: string }> = [
  { brand: "qron", host: "qron.space" },
  { brand: "strainchain", host: "strainchain.io" },
  { brand: "govchain", host: "govchain.us" },
];

function req(host: string, path: string, init?: RequestInit): Request {
  return new Request(`https://${host}${path}`, init);
}

test("recognizes sister x402 paths and ignores marketing paths", () => {
  assert.equal(isSisterX402Path("/api/x402"), true);
  assert.equal(isSisterX402Path("/api/x402/"), true);
  assert.equal(isSisterX402Path("/api/x402/health"), true);
  assert.equal(isSisterX402Path("/api/x402/health/"), true);
  assert.equal(isSisterX402Path("/api/x402/catalog"), true);
  assert.equal(isSisterX402Path("/api/x402/catalog/"), true);
  assert.equal(isSisterX402Path("/.well-known/x402.json"), true);
  assert.equal(isSisterX402Path("/.well-known/x402"), true);
  assert.equal(isSisterX402Path("/openapi.json"), false);
  assert.equal(isSisterX402Path("/api/checkout/dpp"), false);
  assert.equal(isSisterX402Path("/pricing"), false);
});

test("sisterBrandFromHost maps live apexes only", () => {
  assert.equal(sisterBrandFromHost("qron.space"), "qron");
  assert.equal(sisterBrandFromHost("strainchain.io"), "strainchain");
  assert.equal(sisterBrandFromHost("govchain.us"), "govchain");
  assert.equal(sisterBrandFromHost("authichain.com"), null);
});

test("sisterOrigin is the live apex, not authichain.com", () => {
  assert.equal(sisterOrigin("qron"), "https://qron.space");
  assert.equal(sisterOrigin("strainchain"), "https://strainchain.io");
  assert.equal(sisterOrigin("govchain"), "https://govchain.us");
});

test("unpaid POST /api/x402 is 402 v2 with published payTo and sister resource", async () => {
  for (const { host } of BRANDS) {
    const res = await tryHandleSisterX402(
      req(host, "/api/x402", { method: "POST" })
    );
    assert.ok(res, host);
    assert.equal(res.status, 402, host);
    const body = (await res.json()) as {
      x402Version: number;
      resource?: { url?: string };
      accepts: Array<{
        payTo: string;
        amount?: string;
        maxAmountRequired?: string;
        network?: string;
        asset?: string;
        outputSchema?: { input?: { type?: string; method?: string } };
      }>;
      extensions?: { bazaar?: { info?: { input?: { method?: string } } } };
    };
    assert.equal(body.x402Version, 2, host);
    assert.equal(body.resource?.url, `https://${host}/api/x402`, host);
    assert.equal(body.accepts[0].amount, "50000", host);
    assert.equal(body.accepts[0].maxAmountRequired, undefined, host);
    assert.equal(body.accepts[0].network, "eip155:8453", host);
    assert.equal(body.accepts[0].payTo, X402_PUBLISHED_PAY_TO, host);
    assert.equal(body.accepts[0].asset, BASE_USDC, host);
    assert.equal(body.accepts[0].outputSchema?.input?.type, "http", host);
    assert.equal(body.accepts[0].outputSchema?.input?.method, "POST", host);
    assert.equal(body.extensions?.bazaar?.info?.input?.method, "POST", host);
    const blob = JSON.stringify(body).toLowerCase();
    assert.equal(blob.includes("facilitator.payai"), false, host);
    assert.equal(blob.includes("/api/checkout"), false, host);

    const required = res.headers.get("PAYMENT-REQUIRED");
    assert.ok(required, host);
    const v2 = JSON.parse(Buffer.from(required, "base64").toString("utf8")) as {
      x402Version: number;
      resource?: { url?: string };
      accepts: Array<{ amount?: string; payTo?: string; network?: string }>;
      extensions?: { bazaar?: unknown };
    };
    assert.equal(v2.x402Version, 2, host);
    assert.equal(v2.resource?.url, `https://${host}/api/x402`, host);
    assert.equal(v2.accepts[0].amount, "50000", host);
    assert.equal(v2.accepts[0].payTo, X402_PUBLISHED_PAY_TO, host);
    assert.equal(v2.accepts[0].network, "eip155:8453", host);
    assert.ok(v2.extensions?.bazaar, host);
  }
});

test("GET /api/x402 and /api/x402/health are 200 health", async () => {
  for (const { host } of BRANDS) {
    for (const path of ["/api/x402", "/api/x402/health"]) {
      const res = await tryHandleSisterX402(req(host, path));
      assert.ok(res, `${host} ${path}`);
      assert.equal(res.status, 200, `${host} ${path}`);
      const body = (await res.json()) as {
        payTo: string;
        status: string;
        ready: boolean;
        mode: string;
        facilitator: { configured: boolean; reachable: boolean };
        pricePerCall: { usd: number; atomic: string };
        aliases?: string[];
      };
      assert.equal(body.payTo, X402_PUBLISHED_PAY_TO, `${host} ${path}`);
      assert.equal(body.pricePerCall.usd, 0.05, `${host} ${path}`);
      assert.equal(body.pricePerCall.atomic, "50000", `${host} ${path}`);
      assert.equal(body.status, "not_configured", `${host} ${path}`);
      assert.equal(body.ready, false, `${host} ${path}`);
      assert.equal(body.mode, "not_configured", `${host} ${path}`);
      assert.equal(body.facilitator.configured, false, `${host} ${path}`);
    }
  }
});

function proofHeader(p: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(p)).toString("base64");
}

const PAYER = "0x1234567890abcdef1234567890abcdef12345678";

test("POST with a structural proof is refused 503 before any settlement", async () => {
  const header = proofHeader({
    scheme: "exact",
    network: "base",
    payer: PAYER,
    amount: "50000",
  });
  const res = await tryHandleSisterX402(
    req("qron.space", "/api/x402", {
      method: "POST",
      headers: { "x-payment": header, "content-type": "application/json" },
      body: JSON.stringify({ sealId: "seal-1" }),
    })
  );
  assert.ok(res);
  assert.equal(res.status, 503);
  const body = (await res.json()) as { error?: string; settled?: boolean };
  assert.equal(body.error, "registry_not_bound");
  assert.equal(body.settled, false);
});

test("POST with a live facilitator never calls /settle: no registry, no charge", async () => {
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ success: true, txHash: "0xabc" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const header = proofHeader({
      scheme: "exact",
      network: "base",
      payer: PAYER,
      amount: "50000",
      signature: "0xdead",
    });
    const res = await tryHandleSisterX402(
      req("strainchain.io", "/api/x402", {
        method: "POST",
        headers: { "x-payment": header, "content-type": "application/json" },
        body: JSON.stringify({ sealId: "seal-1" }),
      }),
      { X402_FACILITATOR_URL: "https://facilitator.example" }
    );
    assert.ok(res);
    assert.equal(res.status, 503);
    const body = (await res.json()) as {
      error?: string;
      verified?: boolean;
      settlement?: unknown;
    };
    assert.equal(body.error, "registry_not_bound");
    assert.equal(body.verified, undefined);
    assert.equal(body.settlement, undefined);
    assert.equal(res.headers.get("PAYMENT-RESPONSE"), null);
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = orig;
    delete process.env.X402_FACILITATOR_URL;
  }
});

test("HEAD /api/x402 is 204 and other paths are ignored", async () => {
  const head = await tryHandleSisterX402(
    req("qron.space", "/api/x402", { method: "HEAD" })
  );
  assert.ok(head);
  assert.equal(head.status, 204);

  const catalogHead = await tryHandleSisterX402(
    req("qron.space", "/api/x402/catalog", { method: "HEAD" })
  );
  assert.ok(catalogHead);
  assert.equal(catalogHead.status, 204);

  assert.equal(
    await tryHandleSisterX402(req("qron.space", "/openapi.json")),
    null
  );
  assert.equal(
    await tryHandleSisterX402(req("qron.space", "/api/checkout/dpp")),
    null
  );
});

test("GET /api/x402/catalog is 200 with Farm+Passport+DPP Payment Links", async () => {
  const passport = planPaymentLink("strainchain_passport") ?? "";
  const dpp = planPaymentLink("dpp_readiness") ?? "";
  const farm = planPaymentLink("strainchain_farm") ?? "";
  assert.equal(new URL(passport).hostname, "buy.stripe.com");
  assert.equal(new URL(dpp).hostname, "buy.stripe.com");
  assert.equal(new URL(farm).hostname, "buy.stripe.com");

  for (const { brand, host } of BRANDS) {
    const res = await tryHandleSisterX402(req(host, "/api/x402/catalog"));
    assert.ok(res, host);
    assert.equal(res.status, 200, host);
    const body = (await res.json()) as {
      protocol: string;
      x402Version: number;
      brand: string;
      catalog: string;
      payTo: string;
      pricePerCall: { usd: number; atomic: string };
      endpoints: Array<{ path: string; paid: boolean; method: string }>;
      humanCheckout: {
        rail: string;
        passportUsd: number;
        dppUsd: number;
        farmUsd: number;
        passportPaymentLink?: string;
        dppPaymentLink?: string;
        farmPaymentLink?: string;
        starterUsd?: number;
        creatorUsd?: number;
        starterPaymentLink?: string;
        creatorPaymentLink?: string;
        source: string;
      };
    };
    assert.equal(body.protocol, "x402", host);
    assert.equal(body.x402Version, 2, host);
    assert.equal(body.catalog, "/api/x402/catalog", host);
    assert.equal(body.payTo, X402_PUBLISHED_PAY_TO, host);
    assert.equal(body.pricePerCall.usd, 0.05, host);
    assert.equal(body.pricePerCall.atomic, "50000", host);
    assert.equal(
      body.endpoints.some(e => e.paid && e.path === "/api/x402"),
      true,
      host
    );
    assert.equal(
      body.endpoints.some(e => e.path === "/mcp"),
      false,
      host
    );
    assert.equal(body.humanCheckout.rail, "stripe", host);
    assert.equal(body.humanCheckout.source, "src/lib/plans.ts", host);
    assert.equal(
      body.humanCheckout.passportUsd,
      planUsd("strainchain_passport"),
      host
    );
    assert.equal(body.humanCheckout.dppUsd, planUsd("dpp_readiness"), host);
    assert.equal(body.humanCheckout.farmUsd, planUsd("strainchain_farm"), host);
    assert.equal(body.humanCheckout.passportPaymentLink, passport, host);
    assert.equal(body.humanCheckout.dppPaymentLink, dpp, host);
    assert.equal(body.humanCheckout.farmPaymentLink, farm, host);
    assert.equal(
      new URL(body.humanCheckout.passportPaymentLink ?? "").hostname,
      "buy.stripe.com",
      host
    );
    assert.equal(
      new URL(body.humanCheckout.dppPaymentLink ?? "").hostname,
      "buy.stripe.com",
      host
    );
    assert.equal(
      new URL(body.humanCheckout.farmPaymentLink ?? "").hostname,
      "buy.stripe.com",
      host
    );

    const blob = JSON.stringify(body);
    assert.equal(blob.includes("/api/checkout"), false, host);
    assert.equal(blob.toLowerCase().includes("facilitator.payai"), false, host);

    if (brand === "qron") {
      const starter = planPaymentLink("starter") ?? "";
      const creator = planPaymentLink("creator") ?? "";
      assert.equal(body.humanCheckout.starterUsd, planUsd("starter"), host);
      assert.equal(body.humanCheckout.creatorUsd, planUsd("creator"), host);
      assert.equal(body.humanCheckout.starterPaymentLink, starter, host);
      assert.equal(body.humanCheckout.creatorPaymentLink, creator, host);
      assert.equal(new URL(starter).hostname, "buy.stripe.com");
      assert.equal(new URL(creator).hostname, "buy.stripe.com");
    } else {
      assert.equal(body.humanCheckout.starterPaymentLink, undefined, host);
      assert.equal(body.humanCheckout.creatorPaymentLink, undefined, host);
    }
  }
});

test("GET /.well-known/x402.json is the catalog; /.well-known/x402 is fan-out", async () => {
  const catalog = await tryHandleSisterX402(
    req("strainchain.io", "/.well-known/x402.json")
  );
  assert.ok(catalog);
  assert.equal(catalog.status, 200);
  const catalogBody = (await catalog.json()) as { catalog: string };
  assert.equal(catalogBody.catalog, "/api/x402/catalog");

  const fanout = await tryHandleSisterX402(
    req("govchain.us", "/.well-known/x402")
  );
  assert.ok(fanout);
  assert.equal(fanout.status, 200);
  const fanoutBody = (await fanout.json()) as {
    version: number;
    resources: string[];
    protocol?: string;
  };
  assert.equal(fanoutBody.version, 1);
  assert.deepEqual(fanoutBody.resources, ["https://govchain.us/api/x402"]);
  assert.equal(fanoutBody.protocol, undefined);

  const post = await tryHandleSisterX402(
    req("qron.space", "/api/x402/catalog", { method: "POST" })
  );
  assert.ok(post);
  assert.equal(post.status, 405);
});
