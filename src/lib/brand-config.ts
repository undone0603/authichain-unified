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
    tagline: 'Ecosystem Governance & DAO',
    domain: 'govchain.us',
    primaryColor: '#c9a227',
  },
  strainchain: {
    id: 'strainchain',
    name: 'StrainChain',
    tagline: 'Industrial Provenance & DPP',
    domain: 'strainchain.io',
    primaryColor: '#c9a227',
  },
};

/**
 * Returns the brand config based on the hostname.
 */
export function getBrandFromHost(host: string): BrandConfig {
  if (host.includes('govchain.us')) return BRANDS.govchain;
  if (host.includes('strainchain.io')) return BRANDS.strainchain;
  if (host.includes('authichain.com')) return BRANDS.authichain;
  return BRANDS.qron; // Default to QRON.space
}
