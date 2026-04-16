// shared/brands.ts
// Multi-tenant brand config. Imported by client (BrandContext) and server
// (brand-middleware), so keep this file free of browser/node-only globals.

export type BrandId = 'authichain' | 'qron' | 'strainchain' | 'govchain';

export interface Brand {
  id:           BrandId;
  displayName:  string;
  domain:       string;            // canonical apex
  aliases:      string[];          // extra hostnames that resolve to this brand
  tagline:      string;
  description:  string;
  /** Tailwind token keys defined in tailwind.config.ts */
  accentToken:  'accent' | 'qron' | 'strain' | 'govchain';
  /** CSS hex fallback for inline styles / email / og */
  accentHex:    string;
  ctaLabel:     string;
  /** Relative path (`/dashboard`) or absolute URL */
  ctaHref:      string;
}

export const BRANDS: Record<BrandId, Brand> = {
  authichain: {
    id:          'authichain',
    displayName: 'AuthiChain',
    domain:      'authichain.com',
    aliases:     ['www.authichain.com'],
    tagline:     'Protect Every Product. Verify Every Transaction.',
    description: 'B2B enterprise product authentication — blockchain-verified seals, AI image analysis, and NFT certificates for supply chains.',
    accentToken: 'accent',
    accentHex:   '#00FFD1',
    ctaLabel:    'Start Authenticating',
    ctaHref:     '/dashboard',
  },
  qron: {
    id:          'qron',
    displayName: 'QRON',
    domain:      'qron.space',
    aliases:     ['www.qron.space', 'qron.io', 'www.qron.io'],
    tagline:     'AI-Generated QR Art That Scans.',
    description: 'Turn any URL into a work of art. 11 illusion-diffusion styles, cosmic to cyberpunk, rendered in seconds and still scannable.',
    accentToken: 'qron',
    accentHex:   '#F59E0B',
    ctaLabel:    'Generate QR Art',
    ctaHref:     '/qr-codes',
  },
  strainchain: {
    id:          'strainchain',
    displayName: 'StrainChain',
    domain:      'strainchain.io',
    aliases:     ['www.strainchain.io'],
    tagline:     'Seed-to-Sale Provenance for Cannabis.',
    description: 'Compliance-grade blockchain tracking for cultivators, processors, and dispensaries. METRC/BioTrack integration, strain NFTs, lab-cert hashing.',
    accentToken: 'strain',
    accentHex:   '#22C55E',
    ctaLabel:    'Explore StrainChain',
    ctaHref:     '/supply-chain',
  },
  govchain: {
    id:          'govchain',
    displayName: 'GovChain',
    domain:      'govchain.us',
    aliases:     ['www.govchain.us'],
    tagline:     'Government Opportunities, Proven On-Chain.',
    description: 'Automated SAM.gov ingestion, AI scoring, proposal drafting, and on-chain proof-of-win NFTs for federal contractors.',
    accentToken: 'govchain',
    accentHex:   '#1B4FD8',
    ctaLabel:    'View Opportunities',
    ctaHref:     '/grants',
  },
};

export const BRAND_IDS: BrandId[] = ['authichain', 'qron', 'strainchain', 'govchain'];

export const DEFAULT_BRAND: BrandId = 'authichain';

/**
 * Maps a hostname (e.g. `qron.space`, `www.qron.space`, `qron-staging.vercel.app`)
 * to a brand id. Returns DEFAULT_BRAND if no match.
 *
 * Matching rules:
 *   1. Exact match against `domain` or any `aliases`
 *   2. Endswith match against `domain` or any `aliases` (so `foo.qron.space` → qron)
 *   3. Substring match against the brand id (so `qron-preview.vercel.app` → qron)
 */
export function resolveBrand(hostname: string | null | undefined): BrandId {
  if (!hostname) return DEFAULT_BRAND;
  const host = hostname.toLowerCase().split(':')[0]; // strip port

  // Pass 1: exact domain or alias
  for (const brand of Object.values(BRANDS)) {
    if (host === brand.domain) return brand.id;
    if (brand.aliases.includes(host)) return brand.id;
  }

  // Pass 2: subdomain of a known domain
  for (const brand of Object.values(BRANDS)) {
    if (host.endsWith('.' + brand.domain)) return brand.id;
    for (const alias of brand.aliases) {
      if (host.endsWith('.' + alias)) return brand.id;
    }
  }

  // Pass 3: brand id anywhere in the hostname (preview URLs)
  for (const brand of Object.values(BRANDS)) {
    if (host.includes(brand.id)) return brand.id;
  }

  return DEFAULT_BRAND;
}
