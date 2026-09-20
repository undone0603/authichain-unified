/**
 * Apex /pricing HTML for authichain.com and qron.space.
 *
 * Landing workers own marketing HTML and 404 unknown paths, so the Next.js
 * `src/app/pricing/page.tsx` never answers those apexes. This module renders
 * the same customer-facing catalogue as `src/lib/plans.ts` (`listedPlans`)
 * with live Payment Links or GET /api/checkout/dpp. Do not invent prices here.
 */
import { listedPlans, type Plan } from "../../src/lib/plans";
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCtaBand,
  estateCssVars,
  estateFooter,
  estateHero,
  estateNav,
  estateSkipLink,
  type EstateBrandId,
} from "./estate-landing.ts";

export type PricingOrigin = "authichain" | "qron";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Live money-path for a listed plan. Never invent a Stripe URL. */
export function planCheckoutCta(
  plan: Plan,
  origin: PricingOrigin,
): { href: string; label: string; external: boolean } {
  if (plan.id === "dpp_readiness") {
    return {
      href:
        origin === "authichain"
          ? "/api/checkout/dpp"
          : "https://authichain.com/api/checkout/dpp",
      label: plan.cta,
      external: origin !== "authichain",
    };
  }
  if (plan.stripe_payment_link) {
    return { href: plan.stripe_payment_link, label: plan.cta, external: true };
  }
  if (plan.price === 0) {
    return {
      href: origin === "qron" ? "/generate" : "/onboard",
      label: plan.cta,
      external: false,
    };
  }
  return {
    href: origin === "authichain" ? "/contact" : "https://authichain.com/contact",
    label: "Contact",
    external: origin !== "authichain",
  };
}

export function estatePricingGrid(origin: PricingOrigin): string {
  const plans = listedPlans("qron");
  const cards = plans
    .map((plan) => {
      const cta = planCheckoutCta(plan, origin);
      const featured = Boolean(
        origin === "authichain" ? plan.id === "dpp_readiness" : plan.highlighted,
      );
      const suffix = plan.price_suffix ?? (plan.price === 0 ? "" : " one-time");
      const amount = plan.price === 0 ? "Free" : `$${plan.price}`;
      const rel = cta.external ? ` target="_blank" rel="noopener"` : "";
      const features = plan.features
        .map((f) => `<li>${esc(f)}</li>`)
        .join("");
      return `<article class="price-card${featured ? " featured" : ""}">
  <h3>${esc(plan.name)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">${esc(suffix || "trial")}</div>
  <p class="section-sub" style="margin-bottom:16px">${esc(plan.description)}</p>
  <ul class="price-features">${features}</ul>
  <a class="btn ${featured ? "btn-primary" : "btn-outline"}" style="width:100%;text-align:center" href="${esc(cta.href)}"${rel}>${esc(cta.label)}</a>
</article>`;
    })
    .join("");
  return `<div class="pricing-grid">${cards}</div>`;
}

export function renderEstatePricingPage(origin: PricingOrigin): string {
  const brand: EstateBrandId = origin;
  const isAuthichain = origin === "authichain";
  const primary = isAuthichain
    ? { href: "/api/checkout/dpp", label: "Start DPP checkout" }
    : { href: "/generate", label: "Generate Living QR" };
  const nav = isAuthichain
    ? [
        { href: "/", label: "Home" },
        { href: "/x402", label: "x402" },
        { href: "/digital-product-passport", label: "EU DPP" },
        { href: "/contact", label: "Contact" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/generate", label: "Generate" },
        { href: "https://authichain.com/api/checkout/dpp", label: "DPP checkout" },
      ];
  const title = isAuthichain
    ? "Pricing — AuthiChain"
    : "Pricing — QRON";
  const description = isAuthichain
    ? "Live AuthiChain prices from the published plan catalogue. EU DPP Readiness is $299 via Stripe checkout."
    : "Live QRON prices from the published plan catalogue. Starter, Creator, and EU DPP Readiness use Stripe Payment Links or checkout.";

  const offers = listedPlans("qron")
    .filter((p) => p.price > 0)
    .map((p) => ({
      "@type": "Offer",
      name: p.name,
      description: p.description,
      price: p.price,
      priceCurrency: "USD",
      url: isAuthichain
        ? "https://authichain.com/pricing"
        : "https://qron.space/pricing",
    }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${isAuthichain ? "https://authichain.com/pricing" : "https://qron.space/pricing"}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="${isAuthichain ? "#4F46E5" : "#b45309"}">
${ESTATE_FONTS_LINK}
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: title,
    itemListElement: offers,
  }).replace(/<\/script/gi, "<\\/script")}</script>
<style>
${estateCssVars(brand)}
${ESTATE_BASE_CSS}
</style>
</head>
<body>
${estateSkipLink()}
${estateNav(brand, nav, primary)}
<main id="main">
${estateHero({
  eyebrow: "Published catalogue",
  title: isAuthichain ? "Prices that already charge." : "QRON prices that already charge.",
  lede: isAuthichain
    ? "These figures come from the AuthiChain plan catalogue. The primary money path is EU DPP Readiness via live Stripe checkout."
    : "These figures come from the AuthiChain plan catalogue. Generate a Living QR, or buy a pack on the Stripe Payment Link printed on the card.",
  actions: [
    { href: primary.href, label: primary.label, primary: true },
    {
      href: isAuthichain ? "/onboard" : "https://authichain.com/api/checkout/dpp",
      label: isAuthichain ? "Onboard" : "Start DPP checkout",
      primary: false,
    },
  ],
})}
<section class="estate-section" id="pricing">
  <div class="wrap">
    <h2>Plans</h2>
    <p class="section-sub">Only plans with a Stripe price or Payment Link are listed. Theater subscriptions without a Payment Link use Contact.</p>
    ${estatePricingGrid(origin)}
  </div>
</section>
${estateCtaBand({
  title: isAuthichain ? "Start EU DPP Readiness" : "Generate a Living QR",
  lede: isAuthichain
    ? "GET /api/checkout/dpp opens the live Stripe session. No new product surface."
    : "qron.space/generate is proxied to the AuthiChain app. That is the first-dollar path for this brand.",
  actions: [{ href: primary.href, label: primary.label, primary: true }],
})}
</main>
${estateFooter(
  brand,
  [
    {
      heading: "Start",
      links: isAuthichain
        ? [
            { href: "/api/checkout/dpp", label: "DPP checkout" },
            { href: "/onboard", label: "Onboard" },
            { href: "/pricing", label: "Pricing" },
          ]
        : [
            { href: "/generate", label: "Generate Living QR" },
            { href: "/pricing", label: "Pricing" },
            { href: "https://authichain.com/api/checkout/dpp", label: "DPP checkout" },
          ],
    },
    {
      heading: "Estate",
      links: [
        { href: "https://authichain.com", label: "AuthiChain" },
        { href: "https://qron.space/generate", label: "QRON generate" },
        { href: "https://govchain.us/onboard", label: "GovChain onboard" },
        { href: "https://strainchain.io/onboard", label: "StrainChain onboard" },
      ],
    },
    {
      heading: "More",
      links: isAuthichain
        ? [
            { href: "/x402", label: "x402 agent pay" },
            { href: "/contact", label: "Contact" },
          ]
        : [{ href: "https://authichain.com/x402", label: "x402 agent pay" }],
    },
  ],
  "Prices from the published AuthiChain plan catalogue",
)}
</body>
</html>`;
}

export function isPricingPath(pathname: string): boolean {
  return pathname === "/pricing" || pathname === "/pricing/";
}

/** Serve GET/HEAD /pricing from an estate landing worker. */
export function tryHandleEstatePricing(
  request: Request,
  origin: PricingOrigin,
): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isPricingPath(new URL(request.url).pathname)) return null;
  return new Response(renderEstatePricingPage(origin), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
    },
  });
}
