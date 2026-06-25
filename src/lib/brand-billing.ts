/**
 * Brand-aware billing helpers — the single entry point that lets one billing
 * code path (checkout, webhook provisioning, dunning, win-back, referral) serve
 * QRON, AuthiChain, StrainChain, and GovChain.
 *
 * Brand resolution order:
 *   1. `x-brand` request header (set by src/middleware.ts on every request)
 *   2. Host / x-forwarded-host → resolveBrand()
 *   3. DEFAULT_BRAND
 */

import { BRANDS, resolveBrand, DEFAULT_BRAND, type BrandId, type BrandBilling } from '@shared/brands';

export type { BrandId, BrandBilling };

function isBrandId(value: string | null | undefined): value is BrandId {
  return !!value && Object.prototype.hasOwnProperty.call(BRANDS, value);
}

/** Billing config for a brand (never throws — falls back to DEFAULT_BRAND). */
export function getBrandBilling(brandId: BrandId): BrandBilling {
  return (BRANDS[brandId] ?? BRANDS[DEFAULT_BRAND]).billing;
}

/** Resolve the active brand id from an incoming request. */
export function getBrandIdFromRequest(req: Request): BrandId {
  const explicit = req.headers.get('x-brand');
  if (isBrandId(explicit)) return explicit;
  const host = req.headers.get('host') ?? req.headers.get('x-forwarded-host');
  return resolveBrand(host);
}

/** Resolve the active brand id from a metadata bag (e.g. Stripe session/sub). */
export function getBrandIdFromMetadata(metadata: Record<string, unknown> | null | undefined): BrandId {
  const brand = metadata?.brand;
  return isBrandId(typeof brand === 'string' ? brand : undefined) ? (brand as BrandId) : DEFAULT_BRAND;
}

/** Convenience: brand id + its billing config from a request. */
export function getBrandBillingFromRequest(req: Request): { brandId: BrandId; billing: BrandBilling } {
  const brandId = getBrandIdFromRequest(req);
  return { brandId, billing: getBrandBilling(brandId) };
}
