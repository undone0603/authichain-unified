/**
 * Brand Configuration Utility for the AuthiChain Ecosystem.
 */

export type BrandId = 'qron' | 'authichain' | 'govchain' | 'strainchain';

export interface BrandConfig {
  id: BrandId;
  name: string;
  tagline: string;
  domain: string;
  primaryColor: string;
}

export const BRANDS: Record<BrandId, BrandConfig> = {
  qron: {
    id: 'qron',
    name: 'QRON',
    tagline: 'Creative Layer of the AuthiChain Protocol',
    domain: 'qron.space',
    primaryColor: '#c9a227',
  },
  authichain: {
    id: 'authichain',
    name: 'AuthiChain',
    tagline: 'Enterprise Authentication Protocol',
    domain: 'authichain.com',
    primaryColor: '#c9a227',
  },
  govchain: {
    id: 'govchain',
    name: 'GovChain',
    tagline: 'Government Authentication Protocol',
    domain: 'govchain.us',
    primaryColor: '#1a3a6b',
  },
  strainchain: {
    id: 'strainchain',
    name: 'StrainChain',
    tagline: 'Cannabis Supply Chain Compliance',
    domain: 'strainchain.us',
    primaryColor: '#2d6a4f',
  },
};

/**
 * Allowed brand domains - exact match against hostname.
 * Prevents incomplete URL substring sanitization (CodeQL js/incomplete-url-substring-sanitization).
 */
const ALLOWED_DOMAINS: Record<string, BrandId> = {
  'govchain.us': 'govchain',
  'www.govchain.us': 'govchain',
  'strainchain.us': 'strainchain',
  'www.strainchain.us': 'strainchain',
  'authichain.com': 'authichain',
  'www.authichain.com': 'authichain',
  'qron.space': 'qron',
  'www.qron.space': 'qron',
};

export function getBrandFromHost(host: string): BrandConfig {
  // Extract hostname only (strip port if present)
  const hostname = host.split(':')[0].toLowerCase();
  // Exact domain lookup prevents substring-match spoofing
  const brandId = ALLOWED_DOMAINS[hostname];
  if (brandId) return BRANDS[brandId];
  return BRANDS.qron; // Default to QRON.space
}
