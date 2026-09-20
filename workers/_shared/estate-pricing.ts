/**
 * Apex /pricing HTML for authichain.com, qron.space, and strainchain.io.
 *
 * Landing workers own marketing HTML and 404 unknown paths, so the Next.js
 * `src/app/pricing/page.tsx` never answers those apexes. AuthiChain and QRON
 * render the same customer-facing catalogue as `src/lib/plans.ts` (`listedPlans`)
 * with live Payment Links or GET /api/checkout/dpp. StrainChain does not use
 * those catalogue SKUs — `strainchain_passport` / `strainchain_farm` have
 * `stripe_price_id: null` on purpose — and instead offers the live Payment Link
 * in `PAYMENT_LINKS.strainchain.basic`. Do not invent prices here.
 */
import { listedPlans, type Plan } from "../../src/lib/plans.ts";
import { PAYMENT_LINKS } from "../../server/payment-links.ts";
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
  type EstateCta,
  type EstateLink,
} from "./estate-landing.ts";

export type PricingOrigin = "authichain" | "qron" | "strainchain";

/** Canonical StrainChain money path — live Stripe Payment Link, $199/mo. */
export const STRAINCHAIN_BASIC = PAYMENT_LINKS.strainchain.basic;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function usdAmount(price: string): number {
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function splitListedPrice(price: string): { amount: string; period: string } {
  const match = price.match(/^(\$\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!match) return { amount: price, period: "" };
  return { amount: match[1], period: match[2].trim() };
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

function cataloguePricingGrid(origin: Exclude<PricingOrigin, "strainchain">): string {
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

function strainchainPricingGrid(): string {
  const offer = STRAINCHAIN_BASIC;
  const { amount, period } = splitListedPrice(offer.price);
  const features = [
    "Live Stripe Payment Link — the only StrainChain checkout today",
    "Seed-to-shelf provenance for legal cannabis markets",
    "Operator intake on /onboard",
    "Public genetics library on /genetics",
  ]
    .map((f) => `<li>${esc(f)}</li>`)
    .join("");
  return `<div class="pricing-grid" style="max-width:360px">
<article class="price-card featured">
  <h3>${esc(offer.name)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">${esc(period)}</div>
  <p class="section-sub" style="margin-bottom:16px">Monthly StrainChain subscription via the published Stripe Payment Link. No other StrainChain SKU is checkoutable yet.</p>
  <ul class="price-features">${features}</ul>
  <a class="btn btn-primary" style="width:100%;text-align:center" href="${esc(offer.url)}" target="_blank" rel="noopener">Start ${esc(offer.name)}</a>
</article>
</div>
<p class="section-sub" style="margin-top:24px">Genetics passport SKUs (Passport — Per Cultivar and Farm Plan) are catalogued with no Stripe price, so they are not offered as checkout. Request a demo on /onboard if you need that scope.</p>`;
}

export function estatePricingGrid(origin: PricingOrigin): string {
  if (origin === "strainchain") return strainchainPricingGrid();
  return cataloguePricingGrid(origin);
}

type PricingPage = {
  brand: EstateBrandId;
  title: string;
  description: string;
  canonical: string;
  themeColor: string;
  primary: EstateCta;
  nav: EstateLink[];
  heroTitle: string;
  heroLede: string;
  secondary: EstateCta;
  plansNote: string;
  ctaTitle: string;
  ctaLede: string;
  footerStart: EstateLink[];
  footerMore: EstateLink[];
  offers: Array<{
    "@type": "Offer";
    name: string;
    description: string;
    price: number;
    priceCurrency: "USD";
    url: string;
  }>;
};

function pricingPage(origin: PricingOrigin): PricingPage {
  if (origin === "strainchain") {
    const basic = STRAINCHAIN_BASIC;
    return {
      brand: "strainchain",
      title: "Pricing — StrainChain",
      description:
        "StrainChain Basic is $199/month via a live Stripe Payment Link. Genetics passport SKUs are not listed until they have a Stripe price.",
      canonical: "https://strainchain.io/pricing",
      themeColor: "#15803d",
      primary: { href: basic.url, label: `Start ${basic.name}` },
      nav: [
        { href: "/", label: "Home" },
        { href: "/onboard", label: "Onboard" },
        { href: "/genetics/mendo-love-farms", label: "Genetics" },
      ],
      heroTitle: "Prices that already charge.",
      heroLede:
        "StrainChain Basic is the live subscription. The buy button opens the published Stripe Payment Link — no invented price.",
      secondary: { href: "/onboard", label: "Request demo", primary: false },
      plansNote:
        "Only the live Payment Link is offered as checkout. Passport and Farm SKUs in the catalogue have no Stripe price yet, so they are not listed here.",
      ctaTitle: `Start ${basic.name}`,
      ctaLede:
        "The $199/month Payment Link is the chargeable path for strainchain.io.",
      footerStart: [
        { href: basic.url, label: basic.name },
        { href: "/onboard", label: "Onboard" },
        { href: "/pricing", label: "Pricing" },
      ],
      footerMore: [
        { href: "/genetics/mendo-love-farms", label: "Genetics library" },
        { href: "https://authichain.com/contact", label: "Contact" },
      ],
      offers: [
        {
          "@type": "Offer",
          name: basic.name,
          description: "StrainChain Basic monthly subscription",
          price: usdAmount(basic.price),
          priceCurrency: "USD",
          url: basic.url,
        },
      ],
    };
  }

  const isAuthichain = origin === "authichain";
  const offers = listedPlans("qron")
    .filter((p) => p.price > 0)
    .map((p) => ({
      "@type": "Offer" as const,
      name: p.name,
      description: p.description,
      price: p.price,
      priceCurrency: "USD" as const,
      url: isAuthichain
        ? "https://authichain.com/pricing"
        : "https://qron.space/pricing",
    }));

  if (isAuthichain) {
    return {
      brand: "authichain",
      title: "Pricing — AuthiChain",
      description:
        "Live AuthiChain prices from the published plan catalogue. EU DPP Readiness is $299 via Stripe checkout.",
      canonical: "https://authichain.com/pricing",
      themeColor: "#4F46E5",
      primary: { href: "/api/checkout/dpp", label: "Start DPP checkout" },
      nav: [
        { href: "/", label: "Home" },
        { href: "/x402", label: "x402" },
        { href: "/digital-product-passport", label: "EU DPP" },
        { href: "/contact", label: "Contact" },
      ],
      heroTitle: "Prices that already charge.",
      heroLede:
        "These figures come from the AuthiChain plan catalogue. The primary money path is EU DPP Readiness via live Stripe checkout.",
      secondary: { href: "/onboard", label: "Onboard", primary: false },
      plansNote:
        "Only plans with a Stripe price or Payment Link are listed. Theater subscriptions without a Payment Link use Contact.",
      ctaTitle: "Start EU DPP Readiness",
      ctaLede:
        "GET /api/checkout/dpp opens the live Stripe session. No new product surface.",
      footerStart: [
        { href: "/api/checkout/dpp", label: "DPP checkout" },
        { href: "/onboard", label: "Onboard" },
        { href: "/pricing", label: "Pricing" },
      ],
      footerMore: [
        { href: "/x402", label: "x402 agent pay" },
        { href: "/contact", label: "Contact" },
      ],
      offers,
    };
  }

  return {
    brand: "qron",
    title: "Pricing — QRON",
    description:
      "Live QRON prices from the published plan catalogue. Starter, Creator, and EU DPP Readiness use Stripe Payment Links or checkout.",
    canonical: "https://qron.space/pricing",
    themeColor: "#b45309",
    primary: { href: "/generate", label: "Generate Living QR" },
    nav: [
      { href: "/", label: "Home" },
      { href: "/generate", label: "Generate" },
      { href: "https://authichain.com/api/checkout/dpp", label: "DPP checkout" },
    ],
    heroTitle: "QRON prices that already charge.",
    heroLede:
      "These figures come from the AuthiChain plan catalogue. Generate a Living QR, or buy a pack on the Stripe Payment Link printed on the card.",
    secondary: {
      href: "https://authichain.com/api/checkout/dpp",
      label: "Start DPP checkout",
      primary: false,
    },
    plansNote:
      "Only plans with a Stripe price or Payment Link are listed. Theater subscriptions without a Payment Link use Contact.",
    ctaTitle: "Generate a Living QR",
    ctaLede:
      "qron.space/generate is proxied to the AuthiChain app. That is the first-dollar path for this brand.",
    footerStart: [
      { href: "/generate", label: "Generate Living QR" },
      { href: "/pricing", label: "Pricing" },
      { href: "https://authichain.com/api/checkout/dpp", label: "DPP checkout" },
    ],
    footerMore: [{ href: "https://authichain.com/x402", label: "x402 agent pay" }],
    offers,
  };
}

export function renderEstatePricingPage(origin: PricingOrigin): string {
  const page = pricingPage(origin);
  const brand: EstateBrandId = page.brand;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${esc(page.canonical)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="${esc(page.themeColor)}">
${ESTATE_FONTS_LINK}
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: page.title,
    itemListElement: page.offers,
  }).replace(/<\/script/gi, "<\\/script")}</script>
<style>
${estateCssVars(brand)}
${ESTATE_BASE_CSS}
</style>
</head>
<body>
${estateSkipLink()}
${estateNav(brand, page.nav, page.primary)}
<main id="main">
${estateHero({
  eyebrow: "Published catalogue",
  title: page.heroTitle,
  lede: page.heroLede,
  actions: [
    { href: page.primary.href, label: page.primary.label, primary: true },
    page.secondary,
  ],
})}
<section class="estate-section" id="pricing">
  <div class="wrap">
    <h2>Plans</h2>
    <p class="section-sub">${esc(page.plansNote)}</p>
    ${estatePricingGrid(origin)}
  </div>
</section>
${estateCtaBand({
  title: page.ctaTitle,
  lede: page.ctaLede,
  actions: [{ href: page.primary.href, label: page.primary.label, primary: true }],
})}
</main>
${estateFooter(
  brand,
  [
    {
      heading: "Start",
      links: page.footerStart,
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
      links: page.footerMore,
    },
  ],
  origin === "strainchain"
    ? "StrainChain Basic is the live Payment Link"
    : "Prices from the published AuthiChain plan catalogue",
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
