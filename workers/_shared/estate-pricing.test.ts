import { test } from "node:test";
import assert from "node:assert/strict";
import { listedPlans, planPaymentLink, PLANS } from "../../src/lib/plans.ts";
import { PAYMENT_LINKS } from "../../server/payment-links.ts";
import {
  GOVCHAIN_DPP_CHECKOUT,
  isPricingPath,
  planCheckoutCta,
  renderEstatePricingPage,
  renderGovchainPricingPage,
  tryHandleEstatePricing,
  tryHandleGovchainPricing,
} from "./estate-pricing.ts";

test("pricing paths are exact /pricing only", () => {
  assert.equal(isPricingPath("/pricing"), true);
  assert.equal(isPricingPath("/pricing/"), true);
  assert.equal(isPricingPath("/pricing/pro"), false);
  assert.equal(isPricingPath("/"), false);
});

test("DPP uses the live checkout path, never an invented URL", () => {
  const dpp = listedPlans("qron").find(p => p.id === "dpp_readiness");
  assert.ok(dpp);
  assert.equal(dpp.price, 299);
  assert.equal(planCheckoutCta(dpp, "authichain").href, "https://authichain.com/checkout/dpp_readiness");
  assert.equal(
    planCheckoutCta(dpp, "qron").href,
    "https://authichain.com/checkout/dpp_readiness"
  );
});

test("theater stays in the catalogue and off public pricing HTML", () => {
  const theater1 = PLANS.find(p => p.id === "theater_1");
  const theater3 = PLANS.find(p => p.id === "theater_3");
  assert.ok(theater1?.stripe_payment_link);
  assert.ok(theater3?.stripe_payment_link);
  assert.equal(theater1.price, 499);
  assert.equal(theater3.price, 1499);
  assert.equal(theater1.listed, false);
  assert.equal(theater3.listed, false);
  assert.equal(listedPlans("qron").some(p => p.id === "theater_1"), false);
  assert.equal(listedPlans("qron").some(p => p.id === "theater_3"), false);
  assert.equal(new URL(theater1.stripe_payment_link).hostname, "buy.stripe.com");
  assert.equal(new URL(theater3.stripe_payment_link).hostname, "buy.stripe.com");

  const authHtml = renderEstatePricingPage("authichain");
  assert.equal(authHtml.includes("theater_1"), false);
  assert.equal(authHtml.includes("theater_3"), false);
  assert.equal(authHtml.includes("buy.stripe.com"), false);
  assert.equal(authHtml.includes("$499"), false);
  assert.equal(authHtml.includes("$1,499"), false);

  const qronHtml = renderEstatePricingPage("qron");
  assert.equal(qronHtml.includes("theater_1"), false);
  assert.equal(qronHtml.includes("theater_3"), false);
});

test("starter and creator link the gated confirm page, not the raw Payment Link", () => {
  const starter = listedPlans("qron").find(p => p.id === "starter");
  const creator = listedPlans("qron").find(p => p.id === "creator");
  assert.ok(starter?.stripe_payment_link);
  assert.ok(creator?.stripe_payment_link);
  assert.equal(
    planCheckoutCta(starter, "qron").href,
    "https://authichain.com/checkout/starter"
  );
  assert.equal(
    planCheckoutCta(creator, "authichain").href,
    "https://authichain.com/checkout/creator"
  );
});

function hasDeadLink(html: string): boolean {
  return html
    .split("buy.stripe.com/")
    .slice(1)
    .some(rest => {
      const slug = rest.slice(0, 40);
      return ["1Nu", "1Nv", "aIM0"].some(m => slug.includes(m));
    });
}

test("PAYMENT_LINKS only points at live catalogue Payment Links", () => {
  const live = new Set(
    [...listedPlans("qron"), ...listedPlans("strainchain")]
      .map(p => planPaymentLink(p.id))
      .filter(Boolean)
  );
  for (const group of Object.values(PAYMENT_LINKS)) {
    for (const offer of Object.values(group)) {
      assert.ok(live.has(offer.url), `${offer.name} → ${offer.url}`);
    }
  }
});

test("authichain /pricing HTML cites catalogue prices and money paths", () => {
  const html = renderEstatePricingPage("authichain");
  assert.match(html, /<title>Pricing — AuthiChain<\/title>/);
  assert.doesNotMatch(html, /AuthiChain Starter/);
  assert.equal(hasDeadLink(html), false);
  assert.match(html, /\$299/);
  assert.match(html, /\$29/);
  assert.match(html, /\$99/);
  assert.match(html, /href="\/x402"/);
  assert.match(html, /Start DPP Readiness Audit/);
  assert.match(html, /name="email"/);
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
  assert.doesNotMatch(html, /href="(?:https:\/\/[^"]*)?\/api\/checkout\//);
  assert.doesNotMatch(html, /GET \/api\/checkout/);
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  const dppPay =
    planPaymentLink("dpp_readiness") ?? "";
  const starterPay =
    planPaymentLink("starter") ?? "";
  const creatorPay =
    planPaymentLink("creator") ?? "";
  assert.equal(html.includes(`"url":"${dppPay}"`), true);
  assert.equal(html.includes(`"url":"${starterPay}"`), true);
  assert.equal(html.includes(`"url":"${creatorPay}"`), true);
  const acLdStart = html.indexOf("application/ld+json");
  const acLd = html.slice(acLdStart, html.indexOf("</script>", acLdStart));
  assert.equal(acLd.includes("/api/checkout"), false);
  assert.match(html, /id="checkout-need-email-banner"/);
  assert.match(html, /need_email/);
  assert.doesNotMatch(html, /\$2,990/);
  assert.doesNotMatch(html, /\$0\.004/);
  assert.doesNotMatch(html, /Publish one passport/);
  assert.doesNotMatch(html, /Start a Farm Plan/);
});

test("qron /pricing HTML does not advertise the AuthiChain Starter Payment Link", () => {
  const html = renderEstatePricingPage("qron");
  assert.equal(hasDeadLink(html), false);
  assert.doesNotMatch(html, /AuthiChain Starter/);
});

test("qron /pricing HTML cites catalogue prices and generate", () => {
  const html = renderEstatePricingPage("qron");
  assert.match(html, /<title>Pricing — QRON<\/title>/);
  assert.match(html, /href="\/generate"/);
  assert.match(html, /https:\/\/authichain\.com\/checkout\/dpp_readiness/);
  assert.doesNotMatch(html, /\$2,990/);
});

test("qron /pricing lists the packs, not the retired credit bundles", () => {
  const html = renderEstatePricingPage("qron");
  assert.match(html, /Starter Pack/);
  assert.match(html, /Creator Pack/);
  assert.doesNotMatch(html, /QRON generation credits/);
  assert.doesNotMatch(html, /\$9\.99/);
  assert.equal(hasDeadLink(html), false);
});

test("tryHandleEstatePricing answers GET /pricing and ignores other paths", async () => {
  const hit = tryHandleEstatePricing(
    new Request("https://authichain.govchain.us/pricing"),
    "authichain"
  );
  assert.ok(hit);
  assert.equal(hit.status, 200);
  assert.match(hit.headers.get("content-type") ?? "", /text\/html/);
  const hitHtml = await hit.text();
  assert.match(hitHtml, /Start DPP Readiness Audit/);
  assert.equal(hasDeadLink(hitHtml), false);

  assert.equal(
    tryHandleEstatePricing(
      new Request("https://authichain.govchain.us/pricing/pro"),
      "authichain"
    ),
    null
  );
  assert.equal(
    tryHandleEstatePricing(
      new Request("https://qron.space/pricing", { method: "POST" }),
      "qron"
    ),
    null
  );
});

test("strainchain origin lists only the passport catalogue SKUs", () => {
  const ids = listedPlans("strainchain")
    .map(p => p.id)
    .sort();
  assert.deepEqual(ids, ["strainchain_farm", "strainchain_passport"]);
});

test("strainchain catalogue plans use live plan checkout on authichain.com", () => {
  const passport = listedPlans("strainchain").find(
    p => p.id === "strainchain_passport"
  );
  assert.ok(passport);
  assert.equal(
    planCheckoutCta(passport, "strainchain").href,
    "https://authichain.com/checkout/strainchain_passport"
  );
  assert.equal(
    passport.stripe_payment_link,
    "https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"
  );
});

test("strainchain /pricing HTML cites passport and farm prices", () => {
  const html = renderEstatePricingPage("strainchain");
  const passport = listedPlans("strainchain").find(
    p => p.id === "strainchain_passport"
  );
  assert.ok(passport?.stripe_payment_link);
  assert.match(html, /<title>Pricing — StrainChain<\/title>/);
  assert.equal(hasDeadLink(html), false);
  assert.doesNotMatch(html, /\$199/);
  assert.doesNotMatch(html, /StrainChain Basic/);
  assert.match(html, /\$49/);
  assert.match(html, /\$149/);
  assert.match(html, /Publish one passport/);
  assert.match(html, /Start a Farm Plan/);
  assert.match(
    html,
    /https:\/\/authichain\.com\/checkout\/strainchain_passport/
  );
  assert.match(
    html,
    /https:\/\/authichain\.com\/checkout\/strainchain_farm/
  );
  assert.ok(
    html.includes('href="https://authichain.com/checkout/strainchain_passport"')
  );
  const passportPay = planPaymentLink(passport!.id) ?? "";
  assert.equal(html.includes(`"url":"${passportPay}"`), true);
  const strainLdStart = html.indexOf("application/ld+json");
  const strainLd = html.slice(
    strainLdStart,
    html.indexOf("</script>", strainLdStart)
  );
  assert.equal(strainLd.includes("/api/checkout"), false);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /href="\/genetics\/mendo-love-farms"/);
  assert.doesNotMatch(html, /GET \/api\/checkout/);
  assert.doesNotMatch(html, /\$2,990/);
});

test("govchain /pricing uses absolute AuthiChain DPP checkout and no invented SKU", () => {
  const dpp = listedPlans("qron").find(p => p.id === "dpp_readiness");
  assert.ok(dpp);
  const html = renderGovchainPricingPage();
  assert.match(html, /<title>Pricing — GovChain<\/title>/);
  assert.match(html, /No GovChain self-serve price/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /name="email"/);
  assert.match(
    html,
    new RegExp(
      `action="${GOVCHAIN_DPP_CHECKOUT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`
    )
  );
  assert.match(html, /id="checkout-need-email-banner"/);
  assert.equal(
    GOVCHAIN_DPP_CHECKOUT,
    "https://authichain.com/checkout/dpp_readiness"
  );
  assert.match(html, new RegExp(`\\$${dpp.price}`));
  assert.match(html, /href="https:\/\/authichain\.govchain\.us\/pricing"/);
  assert.doesNotMatch(html, /href="\/api\/checkout\//);
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  const dppPay = planPaymentLink(dpp!.id) ?? "";
  assert.equal(html.includes(`"url":"${dppPay}"`), true);
  const govLdStart = html.indexOf("application/ld+json");
  const govLd = html.slice(govLdStart, html.indexOf("</script>", govLdStart));
  assert.equal(govLd.includes("/api/checkout"), false);
  assert.doesNotMatch(html, /GovChain Starter/);
  assert.doesNotMatch(html, /\$199\/mo/);
  assert.doesNotMatch(html, /\$2,990/);
});

test("tryHandleGovchainPricing answers GET /pricing and ignores other paths", async () => {
  const hit = tryHandleGovchainPricing(
    new Request("https://govchain.us/pricing")
  );
  assert.ok(hit);
  assert.equal(hit.status, 200);
  assert.match(await hit.text(), /href="\/onboard"/);
  assert.equal(
    tryHandleGovchainPricing(new Request("https://govchain.us/onboard")),
    null
  );
  assert.equal(
    tryHandleGovchainPricing(
      new Request("https://govchain.us/pricing", { method: "POST" })
    ),
    null
  );
});

test("tryHandleEstatePricing answers GET /pricing for strainchain.io", async () => {
  const hit = tryHandleEstatePricing(
    new Request("https://strainchain.io/pricing"),
    "strainchain"
  );
  assert.ok(hit);
  assert.equal(hit.status, 200);
  assert.match(hit.headers.get("content-type") ?? "", /text\/html/);
  const html = await hit.text();
  const farm = listedPlans("strainchain").find(
    p => p.id === "strainchain_farm"
  );
  assert.ok(farm?.stripe_payment_link);
  assert.ok(html.includes(planPaymentLink(farm!.id)!));
  assert.equal(hasDeadLink(html), false);
});

test("authichain pricing uses buyer copy and QRON titles; held strings unchanged", () => {
  const html = renderEstatePricingPage("authichain");
  assert.match(html, />Plans and prices</);
  assert.doesNotMatch(html, /primary money path/);
  assert.doesNotMatch(html, /Prices that already charge/);
  assert.match(html, /QRON Starter Pack/);
  assert.match(html, /QRON Creator Pack/);
  assert.doesNotMatch(html, /Theater 1/);
  assert.doesNotMatch(html, /Theater 3/);
  assert.doesNotMatch(html, /\$499/);
  assert.match(html, />Start audit</);
  assert.match(html, /AuthiChain, QRON, GovChain and StrainChain\./);
  assert.doesNotMatch(html, /Prices from the published AuthiChain plan catalogue/);
  // Held: trial card, DPP card, Basic line. Theater is not listed.
  assert.match(html, /Free Trial/);
  assert.match(html, /Try Free for 7 Days/);
  assert.match(html, /\$299 credited toward AuthiChain Basic/);
  // No new plan prices.
  assert.doesNotMatch(html, /\$1,499|\$199\/mo/);
});

test("qron pricing does not list Theater", () => {
  const html = renderEstatePricingPage("qron");
  assert.doesNotMatch(html, /Subscribe — \$499\/mo/);
  assert.doesNotMatch(html, /Initialize Theater 1/);
  assert.doesNotMatch(html, /Contact for Theater 3/);
  assert.doesNotMatch(html, /theater_1/);
});
