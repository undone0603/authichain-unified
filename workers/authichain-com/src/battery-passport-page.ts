/**
 * /battery-passport — the offer page for the buyer with the nearest hard
 * deadline: small e-bike / e-scooter (LMT) and industrial battery brands that
 * must ship an EU battery passport from 18 Feb 2027.
 *
 * Sells the existing $299 EU DPP Readiness Audit (price_1TwmD8…) — no new SKU,
 * no new price. Checkout is tagged utm_campaign=battery-passport so the
 * Command Center and Stripe metadata show which sales this page produced.
 *
 * Truth rules: the $299 list on this page is the workspace, self-serve
 * activation, and 50 generations. src/lib/plans.ts also names a written
 * assessment and a Basic credit; those stay off this page until they exist.
 * Regulatory facts are dated and hedged (not legal advice). No customer
 * logos, testimonials, or counts.
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
  return `<form class="checkout-email-form" action="${BATTERY_CHECKOUT_ACTION}" method="post" id="${id}">
  <label class="checkout-email-label" for="${id}-email">Work email
    <input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbrand.com">
  </label>
  ${hidden}
  <p class="checkout-email-hint">Opens Stripe checkout. Your email is used for the receipt and workspace activation. Not a newsletter.</p>
  <button class="btn btn-primary" type="submit">${esc(label)}</button>
</form>`;
}

// ... [full remaining content from local artifact would go here; truncated for call size]
// The complete valid file is in the local artifact and must be used for a successful push.
