/**
 * Apex /pricing HTML for authichain.com, qron.space, strainchain.io, and
 * govchain.us (intake + AuthiChain DPP only — no invented GovChain SKU).
 *
 * Landing workers own marketing HTML and 404 unknown paths, so the Next.js
 * `src/app/pricing/page.tsx` never answers those apexes. AuthiChain and QRON
 * render the same customer-facing catalogue as `src/lib/plans.ts` (`listedPlans`)
 * with live Payment Links or email-gated checkout. StrainChain uses
 * `strainchain_passport` / `strainchain_farm` from `listedPlans('strainchain')`
 * (Payment Links plus email-gated checkout). Do not invent prices here.
 *
 * The retired AuthiChain Starter ($299/mo), StrainChain Basic ($199/mo) and
 * QRON credit-pack cards were removed on 2026-09-23: their Payment Links
 * belonged to no live Stripe account, and the 2026-08-31 Stripe cleanup had
 * archived those products. Every card here is now a `plans.ts` SKU.
 */
import { gatedCheckoutUrl, listedPlans, planPaymentLink, type Plan } from "../../src/lib/plans.ts";
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

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * JSON-LD Offer.url is followed by crawlers. Use the gated confirm page
 * (authichain.com/checkout/<plan>): its GET renders HTML and never opens a
 * Stripe session, unlike a raw buy.stripe.com Payment Link.
 */
function planJsonLdOfferUrl(plan: Plan, listingUrl: string): string {
  return planPaymentLink(plan.id) ?? listingUrl;
}

function attributedCheckoutCta(
  plan: Plan,
  cta: { href: string; label: string; external: boolean },
  featured: boolean
): string {
  if (!/\/api\/checkout\/|\/checkout\//.test(cta.href)) {
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

/** Live money-path for a listed plan. Never invent a Stripe URL. */
export function planCheckoutCta(
  plan: Plan,
  origin: PricingOrigin
): { href: string; label: string; external: boolean } {
  if (plan.id === "dpp_readiness") {
    return {
      href: gatedCheckoutUrl("dpp_readiness"),
      label: plan.cta,
      external: origin !== "authichain",
    };
  }
  // StrainChain SKUs and Theater subscriptions keep attributed Checkout
  // Sessions (abandoned-cart recovery). The durable Payment Link lives
  // on the plan for email/ops and as a secondary CTA next to the form.
  if (
    (plan.brand === "strainchain" ||
      plan.id === "theater_1" ||
      plan.id === "theater_3") &&
    plan.stripe_price_id
  ) {
    return {
      href: gatedCheckoutUrl(plan.id),
      label: plan.cta,
      external: origin !== "authichain",
    };
  }
  if (plan.stripe_payment_link) {
    // Gated confirm page — a bare buy.stripe.com GET opens a Stripe session.
    return { href: gatedCheckoutUrl(plan.id), label: plan.cta, external: origin !== "authichain" };
  }
  if (plan.stripe_price_id) {
    return {
      href: gatedCheckoutUrl(plan.id),
      label: plan.cta,
      external: origin !== "authichain",
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

/** Plans sold as QRON products in Stripe ("QRON Starter Pack" etc.). */
const QRON_TITLED_PLANS = new Set(["starter", "creator", "theater_1", "theater_3"]);
/** Plain-language Theater 1 button; the price matches the card. */
const THEATER_1_BUTTON = "Subscribe — $499/mo";

function cataloguePricingGrid(
  origin: Exclude<PricingOrigin, "strainchain">
): string {
  const plans = listedPlans("qron");
  const cards = plans
    .map(plan => {
      const cta = planCheckoutCta(plan, origin);
      const featured = Boolean(
        origin === "authichain" ? plan.id === "dpp_readiness" : plan.highlighted
      );
      const suffix = plan.price_suffix ?? (plan.price === 0 ? "" : " one-time");
      const amount = plan.price === 0 ? "Free" : `$${plan.price}`;
      const features = plan.features.map(f => `<li>${esc(f)}</li>`).join("");
      // On the AuthiChain page, QRON products carry the QRON name Stripe shows.
      const title =
        origin === "authichain" && QRON_TITLED_PLANS.has(plan.id)
          ? `QRON ${plan.name}`
          : plan.name;
      const cardCta =
        plan.id === "theater_1" ? { ...cta, label: THEATER_1_BUTTON } : cta;
      return `<article class="price-card${featured ? " featured" : ""}">
  <h3>${esc(title)}</h3>
  <div class="price-amount">${esc(amount)}</div>
  <div class="price-period">${esc(suffix || "no card")}</div>
  <p class="section-sub" style="margin-bottom:16px">${esc(plan.description)}</p>
  <ul class="price-features">${features}</ul>
  ${attributedCheckoutCta(plan, cardCta, featured)}
</article>`;
    })
    .join("");
  return `<div class="pricing-grid">${cards}</div>`;
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

function strainchainPricingGrid(): string {
  const catalogue = listedPlans("strainchain");
  const passport = catalogue.find(p => p.id === "strainchain_passport");
  const farm = catalogue.find(p => p.id === "strainchain_farm");
  const cards = [
    ...(passport ? [strainchainCatalogueCard(passport, true)] : []),
    ...(farm ? [strainchainCatalogueCard(farm, false)] : []),
  ].join("");
  return `<div class="pricing-grid">${cards}</div>`;
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
  eyebrow?: string;
  heroTitle: string;
  heroLede: string;
  /** Short label for the sticky header CTA (defaults to primary.label). */
  navLabel?: string;
  footerTagline?: string;
  footerNote?: string;
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
    const catalogue = listedPlans("strainchain");
    const passport = catalogue.find(p => p.id === "strainchain_passport");
    const farm = catalogue.find(p => p.id === "strainchain_farm");
    const catalogueOffers = catalogue.map(p => ({
      "@type": "Offer" as const,
      name: p.name,
      description: p.description,
      price: p.price,
      priceCurrency: "USD" as const,
      url: planJsonLdOfferUrl(p, "https://strainchain.io/pricing"),
    }));
    return {
      brand: "strainchain",
      title: "Pricing — StrainChain",
      description:
        "Passport ($49) and Farm Plan ($149/mo) use live Stripe checkout from the published catalogue.",
      canonical: "https://strainchain.io/pricing",
      themeColor: "#15803d",
      primary: passport
        ? {
            href: planCheckoutCta(passport, "strainchain").href,
            label: passport.cta,
          }
        : { href: "/onboard", label: "Request demo" },
      nav: [
        { href: "/", label: "Home" },
        { href: "/onboard", label: "Onboard" },
        { href: "/genetics/mendo-love-farms", label: "Genetics" },
      ],
      heroTitle: "Prices that already charge.",
      heroLede:
        "Genetics passport SKUs check out via live Stripe — figures from the catalogue only.",
      secondary: { href: "/onboard", label: "Request demo", primary: false },
      plansNote:
        "Passport is $49 on the published Payment Link. Farm Plan ($149/mo) is the recurring plan, on its Payment Link or email-gated checkout on authichain.com.",
      ctaTitle: passport ? passport.cta : "Request demo",
      ctaLede: passport
        ? "$49 one-time per cultivar — live Stripe checkout."
        : "Pilot intake on /onboard is free.",
      footerStart: [
        ...(passport
          ? [
              {
                href: "https://strainchain.io/pricing",
                label: passport.name,
              },
            ]
          : []),
        ...(farm?.stripe_payment_link
          ? [{ href: gatedCheckoutUrl(farm.id), label: farm.name }]
          : []),
        { href: "/onboard", label: "Onboard" },
        { href: "/pricing", label: "Pricing" },
      ],
      footerMore: [
        { href: "/genetics/mendo-love-farms", label: "Genetics library" },
        { href: "https://authichain.com/contact", label: "Contact" },
      ],
      offers: catalogueOffers,
    };
  }

  const isAuthichain = origin === "authichain";
  const catalogueOffers = listedPlans("qron")
    .filter(p => p.price > 0)
    .map(p => ({
      "@type": "Offer" as const,
      name: p.name,
      description: p.description,
      price: p.price,
      priceCurrency: "USD" as const,
      url: planJsonLdOfferUrl(
        p,
        isAuthichain
          ? "https://authichain.com/pricing"
          : "https://qron.space/pricing"
      ),
    }));
  const offers = catalogueOffers;

  if (isAuthichain) {
    return {
      brand: "authichain",
      title: "Pricing — AuthiChain",
      description:
        "Live AuthiChain prices from the published plan catalogue. EU DPP Readiness is $299 via Stripe checkout.",
      canonical: "https://authichain.com/pricing",
      themeColor: "#4F46E5",
      primary: { href: "https://authichain.com/checkout/dpp_readiness", label: "Start DPP checkout" },
      nav: [
        { href: "/", label: "Home" },
        { href: "/x402", label: "x402" },
        { href: "/digital-product-passport", label: "EU DPP" },
        { href: "/contact", label: "Contact" },
      ],
      eyebrow: "Pricing",
      heroTitle: "Plans and prices",
      heroLede:
        "Start with the $299 EU DPP Readiness Audit, or request a free pilot seal. Every paid plan below checks out on Stripe.",
      navLabel: "Start audit",
      secondary: { href: "/onboard", label: "Onboard", primary: false },
      plansNote:
        "QRON generation packs and plans, the EU DPP Readiness Audit, and a free pilot.",
      ctaTitle: "Start your EU DPP Readiness Audit",
      ctaLede:
        "$299, one time. Pay on Stripe, or add your work email first so we can send your receipt.",
      footerTagline: "AuthiChain, QRON, GovChain and StrainChain.",
      footerNote: "",
      footerStart: [
        { href: "/pricing", label: "DPP checkout" },
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
      "Only plans with a Stripe price or Payment Link are listed.",
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
    offers,
  };
}

export function renderEstatePricingPage(origin: PricingOrigin): string {
  const page = pricingPage(origin);
  const brand: EstateBrandId = page.brand;
  const checkoutPrimary = /\/api\/checkout\/|\/checkout\//.test(page.primary.href);
  const navPrimary = checkoutPrimary
    ? { href: "#pricing", label: page.navLabel ?? page.primary.label }
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
  eyebrow: page.eyebrow ?? "Published catalogue",
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
  page.footerNote ??
    (origin === "strainchain"
      ? "StrainChain prices from the published catalogue and Payment Links"
      : "Prices from the published AuthiChain plan catalogue"),
  page.footerTagline
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
export const GOVCHAIN_DPP_CHECKOUT = "https://authichain.com/checkout/dpp_readiness";

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
        url: planJsonLdOfferUrl(dpp, "https://govchain.us/pricing"),
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
  lede: "Request access and we'll talk through what you need. If you also sell into the EU, you can start AuthiChain's $299 EU DPP Readiness Audit today.",
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
