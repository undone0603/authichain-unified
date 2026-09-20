/**
 * Apex /pricing HTML for authichain.com, qron.space, and strainchain.io.
 *
 * Landing workers own marketing HTML and 404 unknown paths, so the Next.js
 * `src/app/pricing/page.tsx` never answers those apexes. AuthiChain and QRON
 * render the same customer-facing catalogue as `src/lib/plans.ts` (`listedPlans`)
 * with live Payment Links or GET /api/checkout/dpp. AuthiChain also shows
 * `PAYMENT_LINKS.authichain.starter` ($299/mo). StrainChain offers the live
 * Payment Link in `PAYMENT_LINKS.strainchain.basic` plus purchasable catalogue
 * SKUs from `listedPlans("strainchain")` (Passport $49, Farm $149) via
 * GET /api/checkout/plan/:planId. Do not invent prices here.
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

/** Canonical AuthiChain Starter money path — live Stripe Payment Link, $299/mo. */
export const AUTHICHAIN_STARTER = PAYMENT_LINKS.authichain.starter;

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
  origin: PricingOrigin
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
  if (plan.brand === "strainchain" && plan.stripe_price_id) {
    const path = `/api/checkout/plan/${encodeURIComponent(plan.id)}`;
    return {
      href: `https://authichain.com${path}`,
      label: plan.cta,
      external: true,
    };
  }
  if (plan.price === 0) {
    return {
      href: origin === "qron" ? "/generate" : "/onboard",
      label: plan.cta,
      external: false,
    };
  }
  return {
    href:
      origin === "authichain" ? "/contact" : "https://authichain.com/contact",
    label: "Contact",
    external: origin !== "authichain",
  };
}

function authichainStarterCard(): string {
  const offer = AUTHICHAIN_STARTER;
  const { amount, period } = splitListedPrice(offer.price);
  const features = [
    "Live Stripe Payment Link — published AuthiChain Starter checkout",
    "Monthly subscription at the listed $299/mo price",
    "Operator intake on /onboard",
    "EU DPP Readiness remains the one-time audit path",
  ]
    .map(f => `<li>${esc(f)}</li>`)
    .join("");
  return `<article class="price-card">
  <h3>${esc(offer.name)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">${esc(period)}</div>
  <p class="section-sub" style="margin-bottom:16px">Monthly AuthiChain subscription via the published Stripe Payment Link. The listed price is $299/mo — no invented figure.</p>
  <ul class="price-features">${features}</ul>
  <a class="btn btn-outline" style="width:100%;text-align:center" href="${esc(offer.url)}" target="_blank" rel="noopener">Start ${esc(offer.name)}</a>
</article>`;
}

function cataloguePricingGrid(
  origin: Exclude<PricingOrigin, "strainchain">
): string {
  const plans = listedPlans("qron");
  const starter = origin === "authichain" ? authichainStarterCard() : "";
  const cards = plans
    .map(plan => {
      const cta = planCheckoutCta(plan, origin);
      const featured = Boolean(
        origin === "authichain" ? plan.id === "dpp_readiness" : plan.highlighted
      );
      const suffix = plan.price_suffix ?? (plan.price === 0 ? "" : " one-time");
      const amount = plan.price === 0 ? "Free" : `$${plan.price}`;
      const rel = cta.external ? ` target="_blank" rel="noopener"` : "";
      const features = plan.features.map(f => `<li>${esc(f)}</li>`).join("");
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
  return `<div class="pricing-grid">${starter}${cards}</div>`;
}

function strainchainBasicCard(): string {
  const offer = STRAINCHAIN_BASIC;
  const { amount, period } = splitListedPrice(offer.price);
  const features = [
    "Live Stripe Payment Link — StrainChain Basic monthly checkout",
    "Seed-to-shelf provenance for legal cannabis markets",
    "Operator intake on /onboard",
    "Public genetics library on /genetics",
  ]
    .map(f => `<li>${esc(f)}</li>`)
    .join("");
  return `<article class="price-card featured">
  <h3>${esc(offer.name)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">${esc(period)}</div>
  <p class="section-sub" style="margin-bottom:16px">Monthly StrainChain subscription via the published Stripe Payment Link. The listed price is $199/mo — no invented figure.</p>
  <ul class="price-features">${features}</ul>
  <a class="btn btn-primary" style="width:100%;text-align:center" href="${esc(offer.url)}" target="_blank" rel="noopener">Start ${esc(offer.name)}</a>
</article>`;
}

function strainchainCatalogueCards(): string {
  return listedPlans("strainchain")
    .map(plan => {
      const cta = planCheckoutCta(plan, "strainchain");
      const suffix = plan.price_suffix ?? " one-time";
      const rel = cta.external ? ` target="_blank" rel="noopener"` : "";
      const features = plan.features.map(f => `<li>${esc(f)}</li>`).join("");
      return `<article class="price-card">
  <h3>${esc(plan.name)}</h3>
  <div class="price-amount">$${plan.price}</div>
  <div class="price-period">${esc(suffix)}</div>
  <p class="section-sub" style="margin-bottom:16px">${esc(plan.description)}</p>
  <ul class="price-features">${features}</ul>
  <a class="btn btn-outline" style="width:100%;text-align:center" href="${esc(cta.href)}"${rel}>${esc(cta.label)}</a>
</article>`;
    })
    .join("");
}

function strainchainPricingGrid(): string {
  return `<div class="pricing-grid">${strainchainBasicCard()}${strainchainCatalogueCards()}</div>`;
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
    const catalogueOffers = listedPlans("strainchain").map(p => {
      const cta = planCheckoutCta(p, "strainchain");
      return {
        "@type": "Offer" as const,
        name: p.name,
        description: p.description,
        price: p.price,
        priceCurrency: "USD" as const,
        url: cta.href,
      };
    });
    return {
      brand: "strainchain",
      title: "Pricing — StrainChain",
      description:
        "StrainChain Basic is $199/month via a live Stripe Payment Link. Passport — Per Cultivar is $49 one-time and Farm Plan is $149/month via Stripe Checkout.",
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
        "StrainChain Basic is the live $199/mo Payment Link. Passport and Farm Plan use the published Stripe prices — no invented figure.",
      secondary: { href: "/onboard", label: "Request demo", primary: false },
      plansNote:
        "StrainChain Basic is the live Payment Link. Passport and Farm Plan are listed because they now have Stripe price IDs. Checkout opens Stripe via GET /api/checkout/plan/:planId.",
      ctaTitle: `Start ${basic.name}`,
      ctaLede:
        "The $199/month Payment Link remains the featured money path. Passport ($49) and Farm Plan ($149/mo) checkout on the published price IDs.",
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
        ...catalogueOffers,
      ],
    };
  }

  const isAuthichain = origin === "authichain";
  const starter = AUTHICHAIN_STARTER;
  const catalogueOffers = listedPlans("qron")
    .filter(p => p.price > 0)
    .map(p => ({
      "@type": "Offer" as const,
      name: p.name,
      description: p.description,
      price: p.price,
      priceCurrency: "USD" as const,
      url: isAuthichain
        ? "https://authichain.com/pricing"
        : "https://qron.space/pricing",
    }));
  const offers = isAuthichain
    ? [
        {
          "@type": "Offer" as const,
          name: starter.name,
          description: "AuthiChain Starter monthly subscription",
          price: usdAmount(starter.price),
          priceCurrency: "USD" as const,
          url: starter.url,
        },
        ...catalogueOffers,
      ]
    : catalogueOffers;

  if (isAuthichain) {
    return {
      brand: "authichain",
      title: "Pricing — AuthiChain",
      description:
        "Live AuthiChain prices from the published plan catalogue. AuthiChain Starter is $299/mo via a live Stripe Payment Link. EU DPP Readiness is $299 via Stripe checkout.",
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
        "These figures come from the AuthiChain plan catalogue and the published AuthiChain Starter Payment Link. The primary money path is still EU DPP Readiness via live Stripe checkout.",
      secondary: { href: "/onboard", label: "Onboard", primary: false },
      plansNote:
        "AuthiChain Starter is the live $299/mo Payment Link. Catalogue plans with a Stripe price or Payment Link stay listed. Theater subscriptions without a Payment Link use Contact.",
      ctaTitle: "Start EU DPP Readiness",
      ctaLede:
        "GET /api/checkout/dpp opens the live Stripe session. AuthiChain Starter is the monthly Payment Link on this page.",
      footerStart: [
        { href: "/api/checkout/dpp", label: "DPP checkout" },
        { href: starter.url, label: starter.name },
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
      {
        href: "https://authichain.com/api/checkout/dpp",
        label: "DPP checkout",
      },
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
      {
        href: "https://authichain.com/api/checkout/dpp",
        label: "DPP checkout",
      },
    ],
    footerMore: [
      { href: "https://authichain.com/x402", label: "x402 agent pay" },
    ],
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
  actions: [
    { href: page.primary.href, label: page.primary.label, primary: true },
  ],
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
        {
          href: "https://strainchain.io/onboard",
          label: "StrainChain onboard",
        },
      ],
    },
    {
      heading: "More",
      links: page.footerMore,
    },
  ],
  origin === "strainchain"
    ? "StrainChain Basic, Passport, and Farm Plan are live checkout"
    : "Prices from the published AuthiChain plan catalogue"
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
  origin: PricingOrigin
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
