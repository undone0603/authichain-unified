/**
 * /battery-passport — the offer page for the buyer with the nearest hard
 * deadline: small e-bike / e-scooter (LMT) and industrial battery brands that
 * must ship an EU battery passport from 18 Feb 2027.
 *
 * Sells the existing $299 EU DPP Readiness Audit (price_1TwmD8…) — no new SKU,
 * no new price. Checkout is tagged utm_campaign=battery-passport so the
 * Command Center and Stripe metadata show which sales this page produced.
 *
 * Truth rules: deliverables are exactly the dpp_readiness plan features in
 * src/lib/plans.ts; regulatory facts are dated and hedged (not legal advice);
 * no customer logos, testimonials or counts.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateFooter,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing.ts";
import { planById } from "../../../src/lib/plans";

export const BATTERY_PASSPORT_PATH = "/battery-passport";
export const BATTERY_PASSPORT_CANONICAL = `https://authichain.com${BATTERY_PASSPORT_PATH}`;
export const BATTERY_CHECKOUT_ACTION = "/api/checkout/dpp";
export const BATTERY_UTM = {
  utm_source: "site",
  utm_medium: "offer-page",
  utm_campaign: "battery-passport",
} as const;
/** Battery Regulation (EU) 2023/1542, Art. 77: passport required from this date. */
export const BATTERY_PASSPORT_DEADLINE = "2027-02-18";

const PATHS = new Set([BATTERY_PASSPORT_PATH, `${BATTERY_PASSPORT_PATH}/`]);

export function isBatteryPassportPath(pathname: string): boolean {
  return PATHS.has(pathname);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

/** Whole days from `now` until the deadline (UTC), floored at 0. */
export function daysUntilDeadline(now: Date = new Date()): number {
  const end = Date.parse(`${BATTERY_PASSPORT_DEADLINE}T00:00:00Z`);
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

function checkoutForm(id: string, label: string): string {
  const hidden = Object.entries(BATTERY_UTM)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  return `<form class="checkout-email-form" action="${BATTERY_CHECKOUT_ACTION}" method="get" id="${id}">
  <label class="checkout-email-label" for="${id}-email">Work email
    <input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbrand.com">
  </label>
  ${hidden}
  <p class="checkout-email-hint">Opens Stripe checkout. Your email is used for the receipt and your readiness assessment. Not a newsletter.</p>
  <button class="btn btn-primary" type="submit">${esc(label)}</button>
</form>`;
}

const CHECKLIST: Array<{ tier: string; who: string; items: string[] }> = [
  {
    tier: "Public",
    who: "Anyone who scans the QR code",
    items: [
      "Unique battery identifier and model",
      "Manufacturer identity and place/date of manufacture",
      "Battery category, chemistry and weight",
      "Rated capacity, voltage and expected lifetime",
      "Carbon footprint information (where required for the category)",
      "Recycled content and end-of-life / collection information",
    ],
  },
  {
    tier: "Interested parties",
    who: "Repairers, remanufacturers, recyclers",
    items: [
      "Dismantling information and part numbers",
      "Safety measures for handling",
      "Detailed composition data",
    ],
  },
  {
    tier: "Authorities",
    who: "Market surveillance and the Commission",
    items: ["Test reports proving compliance", "Conformity documentation"],
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Which batteries need a passport?",
    a: "From 18 February 2027, the EU Battery Regulation requires a digital battery passport for light means of transport (LMT) batteries such as e-bike and e-scooter packs, industrial batteries above 2 kWh, and electric-vehicle batteries placed on the EU market.",
  },
  {
    q: "We are not based in the EU. Does this apply to us?",
    a: "The obligation follows the product, not the company's location: batteries placed on the EU market need a passport, whoever makes them. Your EU importer or distributor will ask you for the data.",
  },
  {
    q: "What exactly do I get for $299?",
    a: "A written readiness assessment for your battery line (which data you already have, what is missing, and who in your supply chain holds it), self-serve activation of your AuthiChain workspace, and 50 workspace generations to publish your first QR-linked passport. The $299 is credited toward AuthiChain Basic if you continue.",
  },
  {
    q: "Is this legal advice or a certification?",
    a: "No. It is a readiness assessment and a working passport you control. Confirm your final obligations against the Regulation and your notified body or counsel.",
  },
  {
    q: "Do I have to book a call?",
    a: "No. Checkout is self-serve. Questions go to the contact page and get a written answer.",
  },
];

export function renderBatteryPassportPage(now: Date = new Date()): string {
  const plan = planById("dpp_readiness");
  const price = plan?.price ?? 299;
  const days = daysUntilDeadline(now);
  const title = `EU Battery Passport for e-bike, e-scooter & industrial batteries — ready before 18 Feb 2027 | AuthiChain`;
  const description = `From 18 Feb 2027 every LMT, industrial (>2 kWh) and EV battery sold in the EU needs a QR-linked digital passport. Get a written readiness assessment and publish your first passport for $${price}, self-serve.`;
  const checklist = CHECKLIST.map(
    g => `<article class="estate-card card">
      <h3>${esc(g.tier)}</h3>
      <p class="bp-who">${esc(g.who)}</p>
      <ul>${g.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
    </article>`
  ).join("");
  const deliverables = (plan?.features ?? [])
    .map(f => `<li>${esc(f)}</li>`)
    .join("");
  const faq = FAQ.map(
    f =>
      `<details class="bp-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`
  ).join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "EU Battery Passport Readiness",
        serviceType: "EU Digital Battery Passport readiness assessment",
        provider: {
          "@type": "Organization",
          name: "AuthiChain",
          url: "https://authichain.com",
        },
        areaServed: "European Union",
        url: BATTERY_PASSPORT_CANONICAL,
        offers: {
          "@type": "Offer",
          price: String(price),
          priceCurrency: "USD",
          url: BATTERY_PASSPORT_CANONICAL,
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${BATTERY_PASSPORT_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${BATTERY_PASSPORT_CANONICAL}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .bp-countdown { display:inline-flex; gap:.5rem; align-items:baseline; padding:.35rem .8rem; border:1px solid var(--border); border-radius:999px; margin-bottom:1rem; }
    .bp-countdown strong { font-size:1.15rem; font-variant-numeric: tabular-nums; }
    .bp-who { color: var(--text-dim); margin:-.25rem 0 .5rem; font-size:.92rem; }
    .estate-card ul, .bp-list { margin:.25rem 0 0 1.1rem; }
    .estate-card li, .bp-list li { margin:.3rem 0; line-height:1.55; }
    .bp-faq { border-top:1px solid var(--border); padding:.9rem 0; }
    .bp-faq summary { cursor:pointer; font-weight:650; }
    .bp-faq p { margin:.6rem 0 0; line-height:1.65; }
    .bp-note { font-size:.9rem; color: var(--text-dim); }
    .bp-price { font-size:2rem; font-weight:750; }
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [
      { href: "/dpp", label: "EU DPP" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
    ],
    { href: "#get-started", label: `Get ready — $${price}` }
  )}
<main id="main">
  <header class="estate-hero hero" id="hero">
    <div class="wrap hero-content">
      <p class="estate-badge hero-badge">EU Battery Regulation · Digital Battery Passport</p>
      <p class="bp-countdown"><strong>${days}</strong> <span>days until 18 February 2027</span></p>
      <h1>Your e-bike, e-scooter or industrial battery needs a passport to be sold in the EU.</h1>
      <p class="estate-lede hero-sub">From 18 February 2027, every LMT battery, every industrial battery over 2 kWh and every EV battery placed on the EU market must carry a QR code linking to a digital passport. AuthiChain tells you exactly what data you're missing and gets your first passport published, for a one-time $${price}. No sales call.</p>
      <div class="estate-actions hero-cta">${checkoutForm("hero-checkout", `Start my battery passport — $${price}`)}</div>
    </div>
  </header>

  <section class="estate-section" id="checklist">
    <div class="wrap">
      <h2>What a battery passport has to hold</h2>
      <p class="section-sub">Three audiences see different layers of the same record. Use this list to check what you already have before you buy anything.</p>
      <div class="estate-grid">${checklist}</div>
      <p class="bp-note">Summary of the Battery Regulation's passport content (Annex XIII), grouped by who can see it. Not legal advice; confirm against the Regulation for your category.</p>
    </div>
  </section>

  <section class="estate-section" id="what-you-get">
    <div class="wrap">
      <h2>What you get</h2>
      <p class="bp-price">$${price} <span class="bp-note">one-time</span></p>
      <ul class="bp-list">${deliverables}</ul>
      <p class="section-sub">Every passport AuthiChain publishes is signed and publicly verifiable, so a scan proves the record came from you and hasn't been altered.</p>
    </div>
  </section>

  <section class="estate-section" id="faq">
    <div class="wrap">
      <h2>Questions</h2>
      ${faq}
    </div>
  </section>

  <section class="estate-cta cta-section" id="get-started">
    <div class="wrap">
      <h2>Start before your importer asks for it</h2>
      <p class="section-sub">Enter your work email to open Stripe checkout. You'll get your readiness assessment and workspace access by email.</p>
      <div class="estate-actions">${checkoutForm("cta-checkout", `Start my battery passport — $${price}`)}</div>
    </div>
  </section>
</main>
${estateFooter(
  "authichain",
  [
    {
      heading: "Start",
      links: [
        { href: BATTERY_PASSPORT_PATH, label: "Battery passport" },
        { href: "/pricing", label: "Pricing" },
      ],
    },
    {
      heading: "Read",
      links: [
        { href: "/dpp", label: "EU DPP" },
        {
          href: "/p/battery-passport-qr-code-requirements",
          label: "Battery QR requirements",
        },
      ],
    },
    { heading: "Company", links: [{ href: "/contact", label: "Contact" }] },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. Not legal advice. No call booking — checkout or a written answer."
)}
</body>
</html>`;
}

export function tryHandleBatteryPassport(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isBatteryPassportPath(new URL(request.url).pathname)) return null;
  return new Response(
    request.method === "HEAD" ? null : renderBatteryPassportPage(),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
