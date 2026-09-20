import { test } from "node:test";
import assert from "node:assert/strict";
import { listedPlans } from "../../src/lib/plans.ts";
import { PAYMENT_LINKS } from "../../server/payment-links.ts";
import {
  AUTHICHAIN_STARTER,
  isPricingPath,
  planCheckoutCta,
  renderEstatePricingPage,
  STRAINCHAIN_BASIC,
  tryHandleEstatePricing,
} from "./estate-pricing.ts";

test("pricing paths are exact /pricing only", () => {
  assert.equal(isPricingPath("/pricing"), true);
  assert.equal(isPricingPath("/pricing/"), true);
  assert.equal(isPricingPath("/pricing/pro"), false);
  assert.equal(isPricingPath("/"), false);
});

test("DPP uses the live checkout path, never an invented URL", () => {
  const dpp = listedPlans("qron").find((p) => p.id === "dpp_readiness");
  assert.ok(dpp);
  assert.equal(dpp.price, 299);
  assert.equal(
    planCheckoutCta(dpp, "authichain").href,
    "/api/checkout/dpp",
  );
  assert.equal(
    planCheckoutCta(dpp, "qron").href,
    "https://authichain.com/api/checkout/dpp",
  );
});

test("starter and creator keep their published Payment Links", () => {
  const starter = listedPlans("qron").find((p) => p.id === "starter");
  const creator = listedPlans("qron").find((p) => p.id === "creator");
  assert.ok(starter?.stripe_payment_link);
  assert.ok(creator?.stripe_payment_link);
  assert.equal(planCheckoutCta(starter, "qron").href, starter.stripe_payment_link);
  assert.equal(planCheckoutCta(creator, "authichain").href, creator.stripe_payment_link);
});

test("authichain Starter reuses the live Payment Link, not an invented price", () => {
  assert.equal(AUTHICHAIN_STARTER.url, PAYMENT_LINKS.authichain.starter.url);
  assert.equal(AUTHICHAIN_STARTER.price, "$299/mo");
  assert.equal(AUTHICHAIN_STARTER.name, "AuthiChain Starter");
});

test("authichain /pricing HTML cites catalogue prices and money paths", () => {
  const html = renderEstatePricingPage("authichain");
  const starterUrl = AUTHICHAIN_STARTER.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(html, /<title>Pricing — AuthiChain<\/title>/);
  assert.match(html, /AuthiChain Starter/);
  assert.match(html, /\$299\/mo/);
  assert.match(html, new RegExp(starterUrl));
  assert.match(html, /\$299/);
  assert.match(html, /\$29/);
  assert.match(html, /\$99/);
  assert.match(html, /href="\/api\/checkout\/dpp"/);
  assert.match(html, /href="\/x402"/);
  assert.match(html, /Start DPP Readiness Audit/);
  assert.doesNotMatch(html, /\$2,990/);
  assert.doesNotMatch(html, /\$0\.004/);
  assert.doesNotMatch(html, /Publish one passport/);
  assert.doesNotMatch(html, /Start a Farm Plan/);
});

test("qron /pricing HTML does not advertise the AuthiChain Starter Payment Link", () => {
  const html = renderEstatePricingPage("qron");
  assert.doesNotMatch(
    html,
    new RegExp(AUTHICHAIN_STARTER.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.doesNotMatch(html, /AuthiChain Starter/);
});

test("qron /pricing HTML cites catalogue prices and generate", () => {
  const html = renderEstatePricingPage("qron");
  assert.match(html, /<title>Pricing — QRON<\/title>/);
  assert.match(html, /href="\/generate"/);
  assert.match(html, /https:\/\/authichain\.com\/api\/checkout\/dpp/);
  assert.doesNotMatch(html, /\$2,990/);
});

function escapedUrl(url: string): RegExp {
  return new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test("qron /pricing surfaces live credit Payment Links, distinct from packs", () => {
  const html = renderEstatePricingPage("qron");
  assert.match(html, /QRON generation credits/);
  assert.match(html, escapedUrl(PAYMENT_LINKS.qron.credits50.url));
  assert.match(html, escapedUrl(PAYMENT_LINKS.qron.credits250.url));
  assert.match(html, escapedUrl(PAYMENT_LINKS.qron.credits1000.url));
  assert.match(html, /50 Credits/);
  assert.match(html, /\$9\.99/);
  assert.match(html, /Starter Pack/);
  assert.match(html, /Creator Pack/);
});

test("authichain /pricing does not list QRON credit Payment Links", () => {
  const html = renderEstatePricingPage("authichain");
  assert.doesNotMatch(html, escapedUrl(PAYMENT_LINKS.qron.credits50.url));
  assert.doesNotMatch(html, /QRON generation credits/);
});

test("tryHandleEstatePricing answers GET /pricing and ignores other paths", async () => {
  const hit = tryHandleEstatePricing(
    new Request("https://authichain.com/pricing"),
    "authichain",
  );
  assert.ok(hit);
  assert.equal(hit.status, 200);
  assert.match(hit.headers.get("content-type") ?? "", /text\/html/);
  const hitHtml = await hit.text();
  assert.match(hitHtml, /Start DPP Readiness Audit/);
  assert.match(hitHtml, /AuthiChain Starter/);
  assert.match(hitHtml, /https:\/\/buy\.stripe\.com\/28E8wP0EVf7M6mefTS1Nu1p/);

  assert.equal(
    tryHandleEstatePricing(
      new Request("https://authichain.com/pricing/pro"),
      "authichain",
    ),
    null,
  );
  assert.equal(
    tryHandleEstatePricing(
      new Request("https://qron.space/pricing", { method: "POST" }),
      "qron",
    ),
    null,
  );
});

test("strainchain origin reuses the live Basic Payment Link, not catalogue SKUs", () => {
  assert.equal(STRAINCHAIN_BASIC.url, PAYMENT_LINKS.strainchain.basic.url);
  assert.equal(STRAINCHAIN_BASIC.price, "$199/mo");
  assert.equal(listedPlans("strainchain").length, 0);
});

test("strainchain /pricing HTML cites the live Basic Payment Link only", () => {
  const html = renderEstatePricingPage("strainchain");
  assert.match(html, /<title>Pricing — StrainChain<\/title>/);
  assert.match(html, new RegExp(STRAINCHAIN_BASIC.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /\$199/);
  assert.match(html, /StrainChain Basic/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /href="\/genetics\/mendo-love-farms"/);
  assert.doesNotMatch(html, /Publish one passport/);
  assert.doesNotMatch(html, /Start a Farm Plan/);
  assert.doesNotMatch(html, /\$49/);
  assert.doesNotMatch(html, /\$149/);
  assert.doesNotMatch(html, /\$2,990/);
});

test("tryHandleEstatePricing answers GET /pricing for strainchain.io", async () => {
  const hit = tryHandleEstatePricing(
    new Request("https://strainchain.io/pricing"),
    "strainchain",
  );
  assert.ok(hit);
  assert.equal(hit.status, 200);
  assert.match(hit.headers.get("content-type") ?? "", /text\/html/);
  const html = await hit.text();
  assert.match(html, new RegExp(STRAINCHAIN_BASIC.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
