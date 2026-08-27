/**
 * Brand-specific feature flags for multi-tenant routing.
 * Keyed by domain (hostname) — must match incoming request host.
 */
export const BRAND_FEATURES = {
  'authichain.com': {
    enable_auth_seals: true,
    enable_certificates: true,
    enable_api_billing: true,
    enable_provenance: false,
    enable_disp_pilot: false,
    default_plan: 'authichain_basic',
    crm_deal_type: 'AuthiChain Subscription',
  },
  'strainchain.io': {
    enable_auth_seals: true,
    enable_certificates: false,
    enable_api_billing: true,
    enable_provenance: true,
    enable_disp_pilot: true,
    default_plan: 'authichain_pro',
    crm_deal_type: 'StrainChain Pilot',
  },
  'govchain.us': {
    enable_auth_seals: true,
    enable_certificates: true,
    enable_api_billing: true,
    enable_provenance: true,
    enable_disp_pilot: false,
    default_plan: 'authichain_enterprise',
    crm_deal_type: 'GovChain Contract',
  },
  'qron.space': {
    enable_auth_seals: false,
    enable_certificates: false,
    enable_api_billing: true,
    enable_provenance: false,
    enable_disp_pilot: false,
    default_plan: 'authichain_basic',
    crm_deal_type: 'QRON Platform',
  },
} as const;

export type BrandDomain = keyof typeof BRAND_FEATURES;
export type BrandConfig = (typeof BRAND_FEATURES)[BrandDomain];

export const SUPPORTED_BRANDS = Object.keys(BRAND_FEATURES) as BrandDomain[];

/** Returns feature config for a brand, or null if unrecognised */
export function getBrandConfig(domain: string): BrandConfig | null {
  return (BRAND_FEATURES as Record<string, BrandConfig>)[domain] ?? null;
}

/** Guard: is this an enabled feature on the brand? */
export function isBrandFeatureEnabled(
  domain: string,
  feature: keyof BrandConfig,
): boolean {
  const cfg = getBrandConfig(domain);
  if (!cfg) return false;
  return Boolean(cfg[feature]);
}
