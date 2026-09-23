import { test } from "node:test";
import assert from "node:assert/strict";
import { planPaymentLink, planUsd } from "../../src/lib/plans.ts";
import { X402_PUBLISHED_PAY_TO } from "../../src/lib/x402.ts";
import { BASE_USDC } from "../../scripts/lib/evm-chains.ts";
import type { SisterDiscoveryBrand } from "./estate-agent-discovery.ts";
import { sisterOrigin } from "./estate-x402.ts";
import {
  isSisterMcpPath,
  sisterMcpPricingDiscovery,
  tryHandleSisterMcp,
} from "./estate-mcp.ts";

const BRANDS: Array<{ brand: SisterDiscoveryBrand; host: string }> = [
  { brand: "qron", host: "qron.space" },
  { brand: "strainchain", host: "strainchain.io" },
  { brand: "govchain", host: "govchain.us" },
];

const PASSPORT = planPaymentLink("strainchain_passport") ?? "";
const DPP = planPaymentLink("dpp_readiness") ?? "";
const FARM = planPaymentLink("strainchain_farm") ?? "";
const STARTER = planPaymentLink("starter") ?? "";
const CREATOR = planPaymentLink("creator") ?? "";

function req(host: string, path: string, init?: RequestInit): Request {
  return new Request(`https://${host}${path}`, init);
}

function httpsUrl(raw: string): URL {
  const url = new URL(raw);
  assert.equal(url.protocol, "https:");
  return url;
}

function stripeLink(raw: string): URL {
  const url = httpsUrl(raw);
  assert.equal(url.hostname, "buy.stripe.com");
  return url;
}

test("recognizes sister MCP paths and ignores checkout", () => {
  assert.equal(isSisterMcpPath("/mcp"), true);
  assert.equal(isSisterMcpPath("/mcp/"), true);
  assert.equal(isSisterMcpPath("/api/mcp"), true);
  assert.equal(isSisterMcpPath("/.well-known/mcp.json"), true);
  assert.equal(isSisterMcpPath("/api/x402"), false);
  assert.equal(isSisterMcpPath("/api/checkout/dpp"), false);
  assert.equal(isSisterMcpPath("/pricing"), false);
});

test("GET discovery lists Payment Links and unpaid POST x402, not GET checkout", async () => {
  for (const { brand, host } of BRANDS) {
    for (const path of ["/mcp", "/api/mcp", "/.well-known/mcp.json"]) {
      const res = await tryHandleSisterMcp(req(host, path), brand);
      assert.ok(res, `${host} ${path}`);
      assert.equal(res.status, 200, `${host} ${path}`);
      const body = (await res.json()) as {
        protocol: string;
        serverInfo: { name: string };
        pay: { x402: string; catalog: string; mcpVerify: string };
        pricing: {
          agentRail: {
            endpoint: string;
            catalog: string;
            mcp: string;
            publishedPayTo: string;
          };
          humanCheckout: {
            source: string;
            passportUsd: number;
            dppUsd: number;
            farmUsd: number;
            passportPaymentLink: string;
            dppPaymentLink: string;
            farmPaymentLink: string;
            starterPaymentLink?: string;
            creatorPaymentLink?: string;
          };
        };
      };
      assert.equal(body.protocol, "mcp", `${host} ${path}`);
      assert.equal(body.serverInfo.name, brand, `${host} ${path}`);
      assert.equal(
        body.pay.x402,
        `POST ${sisterOrigin(brand)}/api/x402`,
        `${host} ${path}`
      );
      const catalog = httpsUrl(body.pay.catalog);
      assert.equal(catalog.hostname, "authichain.com", `${host} ${path}`);
      assert.equal(catalog.pathname, "/api/x402/catalog", `${host} ${path}`);
      const mcp = httpsUrl(body.pricing.agentRail.mcp);
      assert.equal(mcp.hostname, host, `${host} ${path}`);
      assert.equal(mcp.pathname, "/mcp", `${host} ${path}`);
      assert.equal(
        body.pricing.humanCheckout.source,
        "src/lib/plans.ts",
        `${host} ${path}`
      );
      assert.equal(
        body.pricing.humanCheckout.passportUsd,
        planUsd("strainchain_passport"),
        `${host} ${path}`
      );
      assert.equal(
        body.pricing.humanCheckout.dppUsd,
        planUsd("dpp_readiness"),
        `${host} ${path}`
      );
      assert.equal(
        body.pricing.humanCheckout.farmUsd,
        planUsd("strainchain_farm"),
        `${host} ${path}`
      );
      stripeLink(body.pricing.humanCheckout.passportPaymentLink);
      stripeLink(body.pricing.humanCheckout.dppPaymentLink);
      stripeLink(body.pricing.humanCheckout.farmPaymentLink);
      assert.equal(
        body.pricing.humanCheckout.passportPaymentLink,
        PASSPORT,
        `${host} ${path}`
      );
      assert.equal(
        body.pricing.humanCheckout.dppPaymentLink,
        DPP,
        `${host} ${path}`
      );
      assert.equal(
        body.pricing.humanCheckout.farmPaymentLink,
        FARM,
        `${host} ${path}`
      );
      assert.equal(
        body.pricing.agentRail.publishedPayTo,
        X402_PUBLISHED_PAY_TO,
        `${host} ${path}`
      );
      const blob = JSON.stringify(body);
      assert.equal(blob.includes("/api/checkout"), false, `${host} ${path}`);
      assert.equal(
        blob.toLowerCase().includes("facilitator.payai"),
        false,
        `${host} ${path}`
      );
      assert.equal(blob.includes("theater"), false, `${host} ${path}`);
      assert.equal(
        blob.includes("StrainChain Basic"),
        false,
        `${host} ${path}`
      );
    }
  }
});

test("QRON MCP lists Starter and Creator; sisters do not", async () => {
  const qron = sisterMcpPricingDiscovery("qron").humanCheckout as {
    starterPaymentLink?: string;
    creatorPaymentLink?: string;
    starterUsd?: number;
    creatorUsd?: number;
  };
  assert.equal(qron.starterPaymentLink, STARTER);
  assert.equal(qron.creatorPaymentLink, CREATOR);
  assert.equal(qron.starterUsd, planUsd("starter"));
  assert.equal(qron.creatorUsd, planUsd("creator"));
  stripeLink(qron.starterPaymentLink ?? "");
  stripeLink(qron.creatorPaymentLink ?? "");

  for (const brand of ["strainchain", "govchain"] as const) {
    const checkout = sisterMcpPricingDiscovery(brand).humanCheckout as {
      starterPaymentLink?: string;
      creatorPaymentLink?: string;
    };
    assert.equal(checkout.starterPaymentLink, undefined, brand);
    assert.equal(checkout.creatorPaymentLink, undefined, brand);
    const blob = JSON.stringify(sisterMcpPricingDiscovery(brand));
    assert.equal(blob.includes(STARTER), false, brand);
    assert.equal(blob.includes(CREATOR), false, brand);
  }
});

test("JSON-RPC tools/list and get_pricing are public", async () => {
  const list = await tryHandleSisterMcp(
    req("qron.space", "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }),
    "qron"
  );
  assert.equal(list?.status, 200);
  const listed = (await list!.json()) as {
    result: { tools: Array<{ name: string }> };
  };
  assert.deepEqual(
    listed.result.tools.map(t => t.name).sort(),
    ["get_pricing", "verify"].sort()
  );

  const call = await tryHandleSisterMcp(
    req("strainchain.io", "/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_pricing" },
      }),
    }),
    "strainchain"
  );
  const priced = (await call!.json()) as {
    result: { content: Array<{ text: string }> };
  };
  assert.ok(priced.result.content[0].text.includes("POST /api/x402"));
  assert.ok(priced.result.content[0].text.includes(PASSPORT));
  assert.ok(priced.result.content[0].text.includes(FARM));
  assert.equal(priced.result.content[0].text.includes("/api/checkout"), false);
});

test("tools/call verify is unpaid HTTP 402 with published payTo", async () => {
  for (const { brand, host } of BRANDS) {
    const unpaid = await tryHandleSisterMcp(
      req(host, "/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "verify", arguments: { serial: "AC-1" } },
        }),
      }),
      brand
    );
    assert.ok(unpaid, host);
    assert.equal(unpaid.status, 402, host);
    const body = (await unpaid.json()) as {
      x402Version: number;
      resource?: { url?: string };
      accepts: Array<{
        amount?: string;
        payTo?: string;
        network?: string;
        asset?: string;
      }>;
    };
    assert.equal(body.x402Version, 2, host);
    assert.equal(body.resource?.url, `https://${host}/mcp`, host);
    assert.equal(body.accepts[0].amount, "50000", host);
    assert.equal(body.accepts[0].payTo, X402_PUBLISHED_PAY_TO, host);
    assert.equal(body.accepts[0].network, "eip155:8453", host);
    assert.equal(body.accepts[0].asset, BASE_USDC, host);
    assert.equal(JSON.stringify(body).includes("SECURED"), false, host);
    assert.equal(
      JSON.stringify(body).toLowerCase().includes("facilitator.payai"),
      false,
      host
    );
    assert.ok(unpaid.headers.get("PAYMENT-REQUIRED"), host);
  }
});

test("tools/call verify with a payment proof is 503 and never settles", async () => {
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ success: true, txHash: "0xabc" }));
  }) as typeof fetch;
  try {
    const proof = Buffer.from(
      JSON.stringify({
        scheme: "exact",
        network: "base",
        payer: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "50000",
        signature: "0xdead",
      })
    ).toString("base64");
    const res = await tryHandleSisterMcp(
      req("qron.space", "/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-payment": proof },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "verify", arguments: { serial: "AC-1" } },
        }),
      }),
      "qron",
      { X402_FACILITATOR_URL: "https://facilitator.example" }
    );
    assert.ok(res);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error?: string; settled?: boolean };
    assert.equal(body.error, "registry_not_bound");
    assert.equal(body.settled, false);
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = orig;
    delete process.env.X402_FACILITATOR_URL;
  }
});

test("HEAD /mcp is 204 and other paths are ignored", async () => {
  const head = await tryHandleSisterMcp(
    req("qron.space", "/mcp", { method: "HEAD" }),
    "qron"
  );
  assert.ok(head);
  assert.equal(head.status, 204);

  assert.equal(
    await tryHandleSisterMcp(req("qron.space", "/openapi.json"), "qron"),
    null
  );
  assert.equal(
    await tryHandleSisterMcp(req("qron.space", "/api/checkout/dpp"), "qron"),
    null
  );
  assert.equal(
    await tryHandleSisterMcp(req("qron.space", "/api/x402"), "qron"),
    null
  );
});

test("unknown tool calls are errors, not fake verify", async () => {
  const res = await tryHandleSisterMcp(
    req("govchain.us", "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "mint_certificate" },
      }),
    }),
    "govchain"
  );
  const body = (await res!.json()) as {
    result: { content: Array<{ text: string }>; isError?: boolean };
  };
  assert.equal(body.result.isError, true);
  assert.ok(body.result.content[0].text.includes("verify"));
  assert.equal(body.result.content[0].text.includes("SECURED"), false);
});
