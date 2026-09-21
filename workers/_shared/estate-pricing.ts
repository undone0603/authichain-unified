/**
 * Apex /pricing HTML for authichain.com, qron.space, strainchain.io, and
 * govchain.us (intake + AuthiChain DPP only — no invented GovChain SKU).
 *
 * Landing workers own marketing HTML and 404 unknown paths, so the Next.js
 * `src/app/pricing/page.tsx` never answers those apexes. AuthiChain and QRON
 * render the same customer-facing catalogue as `src/lib/plans.ts` (`listedPlans`)
 * with live Payment Links or email-gated checkout. AuthiChain also shows
 * `PAYMENT_LINKS.authichain.starter` ($299/mo). StrainChain uses
 * `strainchain_passport` / `strainchain_farm` from `listedPlans('strainchain')`
 * (Passport Payment Link plus email-gated checkout) and the live Basic
 * Payment Link in `PAYMENT_LINKS.strainchain.basic`. Do not invent prices here.
 */
import { listedPlans, type Plan } from "../../src/lib/plans.ts";
import { PAYMENT_LINKS } from "../../server/payment-links.ts";
import {
  CHECKOUT_NEED_EMAIL_BANNER_HTML,
  CHECKOUT_NEED_EMAIL_DECORATE_JS,
  catalogPaymentLinkHtml,
  checkoutEmailFormHtml,
} from "../../src/lib/checkout-email";
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

/** Live QRON generation-credit Payment Links — not Starter/Creator packs. */
export const QRON_CREDITS = [
  PAYMENT_LINKS.qron.credits50,
  PAYMENT_LINKS.qron.credits250,
  PAYMENT_LINKS.qron.credits1000,
] as const;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attributedCheckoutCta(
  plan: Plan,
  cta: { href: string; label: string; external: boolean },
  featured: boolean
): string {
  if (!/\/api\/checkout\//.test(cta.href)) {
    const rel = cta.external ? ` target="_blank" rel="noopener"` : "";
    return `<a class="btn ${featured ? "btn-primary" : "btn-outline"}" style="width:100%;text-align:center" href="${esc(cta.href)}"${rel}>${esc(cta.label)}</a>`;
  }
  const form = checkoutEmailFormHtml({
    action: cta.href,
    label: cta.label,
    buttonClass: featured ? "btn btn-primary" : "btn btn-outline",
  });
  const pay = catalogPaymentLinkHtml({
    planId: plan.id,
    label: `Pay $${plan.price} on Stripe`,
  });
  return pay ? `${form}<div style="margin-top:8px">${pay}</div>` : form;
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
  // StrainChain SKUs keep attributed Checkout Sessions (abandoned-cart
  // recovery). The durable Payment Link lives on the plan for email/ops.
  if (plan.brand === "strainchain" && plan.stripe_price_id) {
    const path = `/api/checkout/plan/${plan.id}`;
    if (origin === "authichain") {
      return { href: path, label: plan.cta, external: false };
    }
    return {
      href: `https://authichain.com${path}`,
      label: plan.cta,
      external: true,
    };
  }
  if (plan.stripe_payment_link) {
    return { href: plan.stripe_payment_link, label: plan.cta, external: true };
  }
  if (plan.stripe_price_id) {
    const path = `/api/checkout/plan/${plan.id}`;
    if (origin === "authichain") {
      return { href: path, label: plan.cta, external: false };
    }
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
      const features = plan.features.map(f => `<li>${esc(f)}</li>`).join("");
      return `<article class="price-card${featured ? " featured" : ""}">
  <h3>${esc(plan.name)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">${esc(suffix || "trial")}</div>
  <p class="section-sub" style="margin-bottom:16px">${esc(plan.description)}</p>
  <ul class="price-features">${features}</ul>
  ${attributedCheckoutCta(plan, cta, featured)}
</article>`;
    })
    .join("");
  return `<div class="pricing-grid">${starter}${cards}</div>`;
}

function strainchainCatalogueCard(plan: Plan, featured: boolean): string {
  const cta = planCheckoutCta(plan, "strainchain");
  const suffix = plan.price_suffix ?? (plan.price === 0 ? "" : " one-time");
  const amount = plan.price === 0 ? "Free" : `$${plan.price}`;
  const features = plan.features.map(f => `<li>${esc(f)}</li>`).join("");
  return `<article class="price-card${featured ? " featured" : ""}">
  <h3>${esc(plan.name)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">${esc(suffix || "per purchase")}</div>
  <p class="section-sub" style="margin-bottom:16px">${esc(plan.description)}</p>
  <ul class="price-features">${features}</ul>
  ${attributedCheckoutCta(plan, cta, featured)}
</article>`;
}

function strainchainBasicCard(): string {
  const offer = STRAINCHAIN_BASIC;
  const { amount, period } = splitListedPrice(offer.price);
  const features = [
    "Live Stripe Payment Link — monthly StrainChain Basic",
    "Seed-to-shelf provenance for legal cannabis markets",
    "Operator intake on /onboard",
    "Public genetics library on /genetics",
  ]
    .map(f => `<li>${esc(f)}</li>`)
    .join("");
  return `<article class="price-card">
  <h3>${esc(offer.name)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">${esc(period)}</div>
  <p class="section-sub" style="margin-bottom:16px">Monthly StrainChain subscription via the published Stripe Payment Link.</p>
  <ul class="price-features">${features}</ul>
  <a class="btn btn-outline" style="width:100%;text-align:center" href="${esc(offer.url)}" target="_blank" rel="noopener">Start ${esc(offer.name)}</a>
</article>`;
}

function strainchainPricingGrid(): string {
  const catalogue = listedPlans("strainchain");
  const passport = catalogue.find(p => p.id === "strainchain_passport");
  const farm = catalogue.find(p => p.id === "strainchain_farm");
  const cards = [
    strainchainBasicCard(),
    ...(passport ? [strainchainCatalogueCard(passport, true)] : []),
    ...(farm ? [strainchainCatalogueCard(farm, false)] : []),
  ].join("");
  return `<div class="pricing-grid">${cards}</div>`;
}

function qronCreditsGrid(): string {
  const cards = QRON_CREDITS.map(offer => {
    const { amount } = splitListedPrice(offer.price);
    return `<article class="price-card">
  <h3>${esc(offer.name)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">one-time</div>
  <p class="section-sub" style="margin-bottom:16px">QRON generation credits for /generate. Not a Starter or Creator pack.</p>
  <ul class="price-features"><li>Spend on qron.space/generate</li><li>Published Stripe Payment Link</li></ul>
  <a class="btn btn-outline" style="width:100%;text-align:center" href="${esc(offer.url)}" target="_blank" rel="noopener">Buy ${esc(offer.name)}</a>
</article>`;
  }).join("");
  return `<h3 style="margin-top:40px">QRON generation credits</h3>
<p class="section-sub">Impulse top-ups next to generation. Packs above are 100/500 generations; these are credit bundles on existing Payment Links.</p>
<div class="pricing-grid">${cards}</div>`;
}

export function estatePricingGrid(origin: PricingOrigin): string {
  if (origin === "strainchain") return strainchainPricingGrid();
  const catalogue = cataloguePricingGrid(origin);
  if (origin === "qron") return catalogue + qronCreditsGrid();
  return catalogue;
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
    const catalogue = listedPlans("strainchain");
    const passport = catalogue.find(p => p.id === "strainchain_passport");
    const catalogueOffers = catalogue.map(p => ({
      "@type": "Offer" as const,
      name: p.name,
      description: p.description,
      price: p.price,
      priceCurrency: "USD" as const,
      url: planCheckoutCta(p, "strainchain").href,
    }));
    return {
      brand: "strainchain",
      title: "Pricing — StrainChain",
      description:
        "StrainChain Basic is $199/month via a live Stripe Payment Link. Passport ($49) and Farm Plan ($149/mo) use live Stripe checkout from the published catalogue.",
      canonical: "https://strainchain.io/pricing",
      themeColor: "#15803d",
      primary: passport
        ? {
            href: planCheckoutCta(passport, "strainchain").href,
            label: passport.cta,
          }
        : { href: basic.url, label: `Start ${basic.name}` },
      nav: [
        { href: "/", label: "Home" },
        { href: "/onboard", label: "Onboard" },
        { href: "/genetics/mendo-love-farms", label: "Genetics" },
      ],
      heroTitle: "Prices that already charge.",
      heroLede:
        "StrainChain Basic uses the published Payment Link. Genetics passport SKUs checkout via live Stripe sessions — figures from the catalogue only.",
      secondary: { href: "/onboard", label: "Request demo", primary: false },
      plansNote:
        "Basic is the $199/mo Payment Link. Passport is $49 on the published Payment Link. Farm Plan uses email-gated live Stripe checkout on authichain.com from the catalogue.",
      ctaTitle: passport ? passport.cta : `Start ${basic.name}`,
      ctaLede: passport
        ? "$49 one-time per cultivar — live Stripe checkout."
        : "The $199/month Payment Link is the chargeable path for strainchain.io.",
      footerStart: [
        ...(passport
          ? [
              {
                href: "https://strainchain.io/pricing",
                label: passport.name,
              },
            ]
          : []),
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
        "EU DPP Readiness is $299 on the published Payment Link, or enter a work email so Stripe can recover the cart. AuthiChain Starter is the monthly Payment Link on this page.",
      footerStart: [
        { href: "/pricing", label: "DPP checkout" },
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
        href: "https://authichain.com/pricing",
        label: "DPP checkout",
      },
    ],
    heroTitle: "QRON prices that already charge.",
    heroLede:
      "These figures come from the AuthiChain plan catalogue. Generate a Living QR, or buy a pack on the Stripe Payment Link printed on the card.",
    secondary: {
      href: "https://authichain.com/pricing",
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
        href: "https://authichain.com/pricing",
        label: "DPP checkout",
      },
    ],
    footerMore: [
      { href: "https://authichain.com/x402", label: "x402 agent pay" },
    ],
    offers: [
      ...offers,
      ...QRON_CREDITS.map(c => ({
        "@type": "Offer" as const,
        name: c.name,
        description: "QRON generation credits",
        price: usdAmount(c.price),
        priceCurrency: "USD" as const,
        url: c.url,
      })),
    ],
  };
}

export function renderEstatePricingPage(origin: PricingOrigin): string {
  const page = pricingPage(origin);
  const brand: EstateBrandId = page.brand;
  const checkoutPrimary = /\/api\/checkout\//.test(page.primary.href);
  const navPrimary = checkoutPrimary
    ? { href: "#pricing", label: page.primary.label }
    : page.primary;

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
${estateNav(brand, page.nav, navPrimary)}
<main id="main">
${CHECKOUT_NEED_EMAIL_BANNER_HTML}
${estateHero({
  eyebrow: "Published catalogue",
  title: page.heroTitle,
  lede: page.heroLede,
  emailCheckout: checkoutPrimary
    ? {
        action: page.primary.href,
        label: page.primary.label,
      }
    : undefined,
  actions: checkoutPrimary
    ? [page.secondary]
    : [
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
  emailCheckout: checkoutPrimary
    ? {
        action: page.primary.href,
        label: page.primary.label,
      }
    : undefined,
  actions: checkoutPrimary
    ? []
    : [{ href: page.primary.href, label: page.primary.label, primary: true }],
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
    ? "StrainChain prices from the published catalogue and Payment Links"
    : "Prices from the published AuthiChain plan catalogue"
)}
${CHECKOUT_NEED_EMAIL_DECORATE_JS}
</body>
</html>`;
}

export function isPricingPath(pathname: string): boolean {
  return pathname === "/pricing" || pathname === "/pricing/";
}

const pricingHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
} as const;

/** Serve GET/HEAD /pricing from an estate landing worker. */
export function tryHandleEstatePricing(
  request: Request,
  origin: PricingOrigin
): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isPricingPath(new URL(request.url).pathname)) return null;
  return new Response(renderEstatePricingPage(origin), {
    headers: pricingHeaders,
  });
}

/** Live AuthiChain DPP checkout — absolute so it works off govchain.us. */
export const GOVCHAIN_DPP_CHECKOUT = "https://authichain.com/api/checkout/dpp";

/**
 * GovChain has no self-serve SKU. /pricing must not invent one and must not
 * reuse the AuthiChain catalogue (relative /api/checkout/dpp 404s here).
 * Intake stays on /onboard; the published money path is AuthiChain DPP.
 */
export function renderGovchainPricingPage(): string {
  const dpp = listedPlans("qron").find(p => p.id === "dpp_readiness");
  if (!dpp) {
    throw new Error("dpp_readiness missing from src/lib/plans.ts catalogue");
  }
  const dppPrice = dpp.price;
  const dppName = dpp.name;
  const dppCta = dpp.cta;
  const dppDesc = dpp.description;
  const features = dpp.features.map(f => `<li>${esc(f)}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pricing — GovChain</title>
<meta name="description" content="GovChain does not publish a self-serve SKU. Request access on /onboard, or start the live EU DPP Readiness checkout at $${dppPrice}.">
<link rel="canonical" href="https://govchain.us/pricing">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#1d4ed8">
${ESTATE_FONTS_LINK}
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Pricing — GovChain",
    itemListElement: [
      {
        "@type": "Offer",
        name: dppName,
        description: dppDesc,
        price: dppPrice,
        priceCurrency: "USD",
        url: GOVCHAIN_DPP_CHECKOUT,
      },
    ],
  }).replace(/<\/script/gi, "<\\/script")}</script>
<style>
${estateCssVars("govchain")}
${ESTATE_BASE_CSS}
</style>
</head>
<body>
${estateSkipLink()}
${estateNav(
  "govchain",
  [
    { href: "/", label: "Home" },
    { href: "/opportunities", label: "Opportunities" },
    { href: "/onboard", label: "Onboard" },
  ],
  { href: "/onboard", label: "Request access" }
)}
<main id="main">
${CHECKOUT_NEED_EMAIL_BANNER_HTML}
${estateHero({
  eyebrow: "Published paths only",
  title: "No GovChain self-serve price.",
  lede: "GovChain does not publish a catalogue SKU. Request access on the live /onboard intake, or start EU DPP Readiness on AuthiChain — the same $299 checkout already used on authichain.com.",
  emailCheckout: {
    action: GOVCHAIN_DPP_CHECKOUT,
    label: dppCta,
  },
  actions: [{ href: "/onboard", label: "Request access", primary: true }],
})}
<section class="estate-section" id="pricing">
  <div class="wrap">
    <h2>How to start</h2>
    <p class="section-sub">These are the two live conversion paths. Nothing here invents a GovChain subscription.</p>
    <div class="pricing-grid">
      <article class="price-card featured">
        <h3>GovChain access</h3>
        <div class="price-amount">Intake</div>
        <div class="price-period">no published SKU</div>
        <p class="section-sub" style="margin-bottom:16px">The same /onboard form production already proxies to the AuthiChain app. Public-sector pricing is not listed as a self-serve plan.</p>
        <a class="btn btn-primary" style="width:100%;text-align:center" href="/onboard">Request access</a>
      </article>
      <article class="price-card">
        <h3>${esc(dppName)}</h3>
        <div class="price-amount">$${dppPrice}</div>
        <div class="price-period">one-time</div>
        <p class="section-sub" style="margin-bottom:16px">${esc(dppDesc)}</p>
        <ul class="price-features">${features}</ul>
        ${checkoutEmailFormHtml({
          action: GOVCHAIN_DPP_CHECKOUT,
          label: dppCta,
          buttonClass: "btn btn-outline",
          formId: "govchain-dpp-card",
          inputId: "govchain-dpp-card-email",
        })}
        <div style="margin-top:8px">${catalogPaymentLinkHtml({
          planId: "dpp_readiness",
          label: `Pay $${dppPrice} on Stripe`,
        })}</div>
      </article>
    </div>
  </div>
</section>
${estateCtaBand({
  title: "Start on a live path",
  lede: "Onboard is the GovChain conversion path. EU DPP Readiness is the published AuthiChain checkout. Enter a work email so Stripe can recover the cart.",
  emailCheckout: {
    action: GOVCHAIN_DPP_CHECKOUT,
    label: dppCta,
  },
  actions: [
    { href: "/onboard", label: "Request access", primary: true },
    {
      href: "https://authichain.com/pricing",
      label: "AuthiChain pricing",
      primary: false,
    },
  ],
})}
</main>
${estateFooter(
  "govchain",
  [
    {
      heading: "Start",
      links: [
        { href: "/onboard", label: "Onboard" },
        { href: "https://authichain.com/pricing", label: "DPP checkout" },
        { href: "/pricing", label: "Pricing" },
      ],
    },
    {
      heading: "Estate",
      links: [
        { href: "https://authichain.com/pricing", label: "AuthiChain pricing" },
        { href: "https://qron.space/generate", label: "QRON generate" },
        {
          href: "https://strainchain.io/onboard",
          label: "StrainChain onboard",
        },
      ],
    },
    {
      heading: "More",
      links: [{ href: "/opportunities", label: "Opportunities" }],
    },
  ],
  "GovChain has no self-serve SKU — onboard or AuthiChain DPP"
)}
${CHECKOUT_NEED_EMAIL_DECORATE_JS}
</body>
</html>`;
}

/** Serve GET/HEAD /pricing on govchain.us with absolute AuthiChain checkout. */
export function tryHandleGovchainPricing(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isPricingPath(new URL(request.url).pathname)) return null;
  return new Response(renderGovchainPricingPage(), {
    headers: pricingHeaders,
  });
}
