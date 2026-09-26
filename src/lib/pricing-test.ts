/**
 * Monthly /pricing test (docs: the "Revenue tools" project thread, 2026-09-26).
 *
 * One test at a time. Prices are frozen (docs/growth/PRICING_FREEZE_COPY.md),
 * so a test only changes copy, order or CTA wording. Half of visitors get
 * variant "b" from a first-party cookie; checkout links carry the variant as
 * utm_content, which the gated checkout (src/lib/checkout-gate.ts) copies into
 * Stripe session metadata. Results are read from Stripe per utm_content.
 *
 * `active` stays false until Z confirms the flag flip in the project thread.
 */
export const PRICING_TEST = {
  id: "headline_2026_10",
  active: false,
} as const;

export type PricingVariant = "a" | "b";

export const PRICING_TEST_COOKIE = `pt_${PRICING_TEST.id}`;

/** Pure. Reads a stored variant from a cookie header string. */
export function variantFromCookie(cookie: string): PricingVariant | null {
  for (const part of cookie.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === PRICING_TEST_COOKIE && (v === "a" || v === "b")) return v;
  }
  return null;
}

/** Pure. 50/50 assignment from a number in [0, 1). */
export function assignVariant(rand: number): PricingVariant {
  return rand < 0.5 ? "a" : "b";
}

/** The utm_content tag a variant's checkouts carry. */
export function variantTag(v: PricingVariant): string {
  return `pricing_${PRICING_TEST.id}_${v}`;
}

/**
 * Pure. Adds utm_content to a checkout URL unless it already has one.
 * Relative or unparsable hrefs are returned unchanged.
 */
export function tagCheckoutHref(href: string, v: PricingVariant): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (url.searchParams.has("utm_content")) return href;
  url.searchParams.set("utm_content", variantTag(v));
  return url.toString();
}

/** Pure. Variant b's headline, priced from the cheapest listed paid plan. */
export function plainHeadline(fromUsd: number): string {
  return `Verifiable product seals from $${fromUsd}. No sales call.`;
}
