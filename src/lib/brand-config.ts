/**
 * Brand Configuration Utility for the AuthiChain Ecosystem.
 *
 * SINGLE SOURCE OF TRUTH: brand presentation data lives in `shared/brands.ts`
 * (imported by middleware, server, and client alike). This module is a thin
 * compatibility adapter that exposes the legacy `BrandConfig` shape
 * (`{ id, name, tagline, domain, primaryColor }`) used by existing consumers
 * (LeadCapturePopup, /api/test-routing) while sourcing every value from the
 * canonical `BRANDS` map. Do not redefine taglines/colors here — edit
 * `shared/brands.ts` so all surfaces stay in sync.
 */

import { BRANDS as CANONICAL, resolveBrand, type BrandId } from '@shared/brands';

export type { BrandId };

export interface BrandConfig {
  id: BrandId;
  name: string;
  tagline: string;
  domain: string;
  primaryColor: string;
}

function toConfig(id: BrandId): BrandConfig {
  const b = CANONICAL[id];
  return {
    id: b.id,
    name: b.displayName,
    tagline: b.tagline,
    domain: b.domain,
    primaryColor: b.accentHex,
  };
}

export const BRANDS: Record<BrandId, BrandConfig> = {
  qron: toConfig('qron'),
  authichain: toConfig('authichain'),
  govchain: toConfig('govchain'),
  strainchain: toConfig('strainchain'),
};

/**
 * Returns the brand config based on the hostname. Delegates host→brand
 * matching to the canonical `resolveBrand` (exact, subdomain, then preview-URL
 * substring matching) so every surface resolves brands identically.
 */
export function getBrandFromHost(host: string): BrandConfig {
  return BRANDS[resolveBrand(host)];
}
