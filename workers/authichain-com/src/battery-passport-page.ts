/**
 * /battery-passport — the offer page for the buyer with the nearest hard
 * deadline: small e-bike / e-scooter (LMT) and industrial battery brands that
 * must ship an EU battery passport from 18 Feb 2027.
 *
 * Sells the existing $299 EU DPP Readiness (price_1TwmD8…) — no new SKU,
 * no new price. Checkout is tagged utm_campaign=battery-passport so the
 * Command Center and Stripe metadata show which sales this page produced.
 *
 * Truth rules: the $299 list on this page is the workspace, self-serve
 * activation, and 50 generations. Regulatory facts are dated and hedged (not legal advice).
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
import {
  CONSISTENCY_TOLERANCE,
  GAP_MAP_DISCLAIMER,
  annexXiiiRows,
  type AnnexRow,
  type Placing,
} from "./battery-gap-map";
import { LEAD_FORM_CSS, batteryLeadFormSection } from "./battery-lead-form";

export const BATTERY_PASSPORT_PATH = "/battery-passport";
export const BATTERY_PASSPORT_CANONICAL = `https://authichain.com${BATTERY_PASSPORT_PATH}`;
export const BATTERY_CHECKOUT_ACTION =
  "https://authichain.com/checkout/dpp_readiness";
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
      ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" })[
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
  return `<form class="checkout-email-form" action="${BATTERY_CHECKOUT_ACTION}" method="post" id="${id}">
  <label class="checkout-email-label" for="${id}-email">Work email
    <input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbrand.com">
  </label>
  ${hidden}
  <p class="checkout-email-hint">Opens Stripe checkout. Your email is used for the receipt and workspace activation. Not a newsletter.</p>
  <button class="btn btn-primary" type="submit">${esc(label)}</button>
</form>`;
}

/** What paid checkout on this page grants. Not the full plan.features list. */
export const PAGE_DELIVERABLES = [
  "AuthiChain workspace",
  "Self-serve activation",
  "50 workspace generations",
] as const;

export function renderBatteryPassportPage(now: Date = new Date()): string {
  const plan = planById("dpp_readiness");
  const price = plan?.price ?? 299;
  const days = daysUntilDeadline(now);
  const title = `Free EU Battery Passport gap map | AuthiChain`;
  const description = `Score data gaps for the 18 February 2027 battery passport. Workspace + 50 generations $${price}. Not a registry filing.`;
  const deliverables = PAGE_DELIVERABLES.map(f => `<li>${esc(f)}</li>`).join("");

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
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .bp-countdown { display:inline-flex; gap:.5rem; align-items:baseline; padding:.35rem .8rem; border:1px solid var(--border); border-radius:999px; margin-bottom:1rem; }
    .bp-countdown strong { font-size:1.15rem; font-variant-numeric: tabular-nums; }
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
      <p class="estate-badge hero-badge">Free tool · EU Battery Regulation</p>
      <p class="bp-countdown"><strong>${days}</strong> <span>days until 18 February 2027</span></p>
      <h1>Free EU Battery Passport gap map</h1>
      <p class="estate-lede hero-sub">Your e-bike, e-scooter or industrial battery needs a passport to be sold in the EU. Map the public-tier gaps in your browser — nothing is sent or stored. From 18 February 2027.</p>
      <div class="estate-actions hero-cta">
        ${checkoutForm("hero-checkout", `Get passport-ready — $${price}`)}
      </div>
    </div>
  </header>

  <section class="estate-section" id="what-you-get">
    <div class="wrap">
      <h2>What you get</h2>
      <p class="bp-price">$${price} <span class="bp-note">one-time</span></p>
      <ul class="bp-list">${deliverables}</ul>
      <p class="bp-note">A published workspace record is a signed proof only when its Ed25519 signature and a mainnet anchor both check out. Until then, a scan is not an Article 77 passport. This page supports, and does not replace, the passport issued by the operator placing the battery on the EU market. Not legal advice. Not a certification. Not a registry filing.</p>
    </div>
  </section>

  <section class="estate-cta cta-section" id="get-started">
    <div class="wrap">
      <h2>Start before your importer asks for it</h2>
      <p class="section-sub">Enter your work email to open Stripe checkout. After payment, workspace activation is sent by email.</p>
      <div class="estate-actions">${checkoutForm("cta-checkout", `Get passport-ready — $${price}`)}</div>
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
    { heading: "Company", links: [{ href: "/contact", label: "Contact" }] },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. Not legal advice. Checkout is self-serve."
)}
</body>
</html>`;
}
