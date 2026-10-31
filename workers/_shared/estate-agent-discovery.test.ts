import { test } from "node:test";
import assert from "node:assert/strict";
import { planPaymentLink, planUsd } from "../../src/lib/plans.ts";
import { x402PriceUsd } from "../../src/lib/x402.ts";
import {
  isEstateAgentDiscoveryPath,
  isEstateLlmsTxtPath,
  isEstateOpenApiPath,
  renderEstateLlmsTxt,
  renderEstateOpenApi,
  tryHandleEstateAgentDiscovery,
  type SisterDiscoveryBrand,
} from "./estate-agent-discovery.ts";
import { sisterOrigin } from "./estate-x402.ts";

const BRANDS: SisterDiscoveryBrand[] = ["qron", "strainchain", "govchain"];
const PASSPORT = planPaymentLink("strainchain_passport") ?? "";
const DPP = planPaymentLink("dpp_readiness") ?? "";
const FARM = planPaymentLink("strainchain_farm") ?? "";

function httpsUrl(raw: string): URL {
  const url = new URL(raw);
  assert.equal(url.protocol, "https:");
  return url;
}

function httpsUrlsIn(text: string): URL[] {
  return [...text.matchAll(/https:\/\/[^\s"'<>]+/g)].map(match =>
    httpsUrl(match[0])
  );
}

function hasHttpsPath(
  text: string,
  hostname: string,
  pathname: string
): boolean {
  return httpsUrlsIn(text).some(
    url => url.hostname === hostname && url.pathname === pathname
  );
}

function hasHttpsHost(text: string, hostname: string): boolean {
  return httpsUrlsIn(text).some(url => url.hostname === hostname);
}

test("recognizes agent discovery paths and ignores marketing paths", () => {
  assert.equal(isEstateLlmsTxtPath("/llms.txt"), true);
  assert.equal(isEstateLlmsTxtPath("/.well-known/llms.txt"), true);
  assert.equal(isEstateLlmsTxtPath("/llms.txt/"), true);
  assert.equal(isEstateOpenApiPath("/openapi.json"), true);
  assert.equal(isEstateOpenApiPath("/openapi.json/"), true);
  assert.equal(isEstateAgentDiscoveryPath("/llms.txt"), true);
  assert.equal(isEstateAgentDiscoveryPath("/openapi.json"), true);
  assert.equal(isEstateLlmsTxtPath("/robots.txt"), false);
  assert.equal(isEstateOpenApiPath("/pricing"), false);
  assert.equal(isEstateAgentDiscoveryPath("/"), false);
});

test("llms.txt points agents at Payment Links and unpaid POST x402", () => {
  for (const brand of BRANDS) {
    const text = renderEstateLlmsTxt(brand);
    assert.ok(
      hasHttpsPath(text, new URL(sisterOrigin(brand)).hostname, "/api/x402")
    );
    assert.ok(hasHttpsPath(text, "authichain.com", "/api/x402"));
    assert.ok(text.includes("POST https://authichain.com/api/v1/agent-verify"));
    assert.ok(hasHttpsPath(text, "authichain.com", "/api/x402/health"));
    assert.ok(text.includes("paidVerify.bound false"));
    assert.ok(text.includes(`$${x402PriceUsd()} USDC`));
    assert.ok(
      text.includes(
        "An empty JSON body is the unpaid HTTP 402. A non-UUID sealId is HTTP 400 before payment."
      )
    );
    assert.ok(
      hasHttpsPath(text, new URL(sisterOrigin(brand)).hostname, "/mcp")
    );
    assert.ok(hasHttpsPath(text, "authichain.com", "/mcp"));
    assert.ok(hasHttpsPath(text, "authichain.com", "/openapi.json"));
    assert.ok(
      hasHttpsPath(text, new URL(sisterOrigin(brand)).hostname, "/protocol/jwks.json")
    );
    assert.ok(
      hasHttpsPath(text, new URL(sisterOrigin(brand)).hostname, "/protocol/issuer.json")
    );
    assert.ok(
      hasHttpsPath(text, new URL(sisterOrigin(brand)).hostname, "/.well-known/jwks.json")
    );
    assert.ok(
      hasHttpsPath(text, new URL(sisterOrigin(brand)).hostname, "/api/verify")
    );
    assert.ok(text.includes(`${sisterOrigin(brand)}/qron/r/{object_id}`));
    assert.ok(text.includes("https://authichain.com/qron/r/{object_id}"));
    assert.ok(text.includes("does not verify the signature"));
    assert.ok(text.includes("POST https://authichain.com/api/v1/attestation/verify"));
    assert.ok(text.includes(PASSPORT));
    assert.ok(text.includes(DPP));
    assert.equal(text.includes(FARM), false);
    assert.equal(httpsUrl(PASSPORT).hostname, "authichain.com");
    assert.equal(httpsUrl(DPP).hostname, "authichain.com");
    assert.doesNotMatch(text, /GET \/api\/checkout/);
    assert.equal(text.toLowerCase().includes("facilitator.payai"), false);
  }
});

test("QRON llms.txt also lists Starter and Creator Payment Links from plans.ts", () => {
  const text = renderEstateLlmsTxt("qron");
  assert.ok(text.includes(planPaymentLink("starter") ?? ""));
  assert.ok(text.includes(planPaymentLink("creator") ?? ""));
  assert.ok(text.includes(`$${planUsd("starter")}`));
  assert.ok(text.includes(`$${planUsd("creator")}`));
  assert.ok(text.includes("# QRON"));
  assert.ok(
    !renderEstateLlmsTxt("govchain").includes(
      planPaymentLink("starter") ?? "NOPE"
    )
  );
});

test("openapi.json declares x-payment-info and Payment Links, not GET checkout", () => {
  for (const brand of BRANDS) {
    const spec = renderEstateOpenApi(brand);
    assert.equal(spec.openapi, "3.1.0");
    assert.equal(
      spec.paths["/api/v1/agent-verify"],
      undefined,
      "sisters must not advertise a path they 404"
    );
    assert.match(
      spec.info.description,
      /POST https:\/\/authichain\.com\/api\/v1\/agent-verify/
    );
    assert.deepEqual(spec.servers, [{ url: sisterOrigin(brand) }]);
    const post = spec.paths["/api/x402"] as {
      get?: { responses: { "200": unknown } };
      post: {
        "x-payment-info": { protocols: string[]; price: { amount: string } };
        responses: { "400": unknown; "402": unknown };
        requestBody: {
          content: {
            "application/json": {
              schema: { properties: Record<string, { format?: string }> };
            };
          };
        };
      };
    };
    assert.ok(post.get?.responses["200"]);
    assert.deepEqual(post.post["x-payment-info"].protocols, ["x402"]);
    assert.equal(
      post.post["x-payment-info"].price.amount,
      String(x402PriceUsd())
    );
    assert.ok(post.post.responses["400"]);
    assert.ok(post.post.responses["402"]);
    const props =
      post.post.requestBody.content["application/json"].schema.properties;
    assert.deepEqual(Object.keys(props), ["sealId"]);
    assert.equal(props.sealId.format, "uuid");
    assert.ok(spec.paths["/protocol/jwks.json"]);
    assert.ok(spec.paths["/protocol/issuer.json"]);
    assert.ok(spec.paths["/.well-known/jwks.json"]);
    assert.ok(spec.paths["/api/verify"]);
    const scan = spec.paths["/qron/r/{object_id}"] as {
      get?: { summary?: string };
    };
    assert.match(scan.get?.summary ?? "", /authichain\.com\/qron\/r/);
    assert.match(scan.get?.summary ?? "", /does not verify/);
    assert.equal(spec.info["x-human-checkout"].passportPaymentLink, PASSPORT);
    assert.equal(spec.info["x-human-checkout"].dppPaymentLink, DPP);
    assert.equal(spec.info["x-human-checkout"].farmPaymentLink, undefined);
    assert.equal(
      spec.info["x-human-checkout"].passportUsd,
      planUsd("strainchain_passport")
    );
    assert.equal(
      spec.info["x-human-checkout"].dppUsd,
      planUsd("dpp_readiness")
    );
    assert.equal(
      spec.info["x-human-checkout"].farmUsd,
      planUsd("strainchain_farm")
    );
    const body = JSON.stringify(spec);
    assert.equal(body.includes("/api/checkout"), false);
    assert.ok(hasHttpsHost(body, "authichain.com"));
  }
});

test("tryHandleEstateAgentDiscovery answers GET and ignores other paths", async () => {
  const llms = tryHandleEstateAgentDiscovery(
    new Request("https://qron.space/llms.txt"),
    "qron"
  );
  assert.ok(llms);
  assert.equal(llms.status, 200);
  assert.match(llms.headers.get("content-type") ?? "", /text\/plain/);
  assert.ok((await llms.text()).includes("POST https://qron.space/api/x402"));

  const spec = tryHandleEstateAgentDiscovery(
    new Request("https://strainchain.io/openapi.json"),
    "strainchain"
  );
  assert.ok(spec);
  assert.equal(spec.status, 200);
  assert.match(spec.headers.get("content-type") ?? "", /application\/json/);
  const body = (await spec.json()) as { openapi: string };
  assert.equal(body.openapi, "3.1.0");

  assert.equal(
    tryHandleEstateAgentDiscovery(
      new Request("https://govchain.us/pricing"),
      "govchain"
    ),
    null
  );
  assert.equal(
    tryHandleEstateAgentDiscovery(
      new Request("https://qron.space/llms.txt", { method: "POST" }),
      "qron"
    ),
    null
  );
});
