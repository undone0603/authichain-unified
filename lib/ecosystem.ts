// lib/ecosystem.ts
// Central source-of-truth for all ecosystem app URLs and branding.
// Import this anywhere you need cross-app links.

export const ECOSYSTEM = [
  {
    id:      'authichain',
    name:    'AuthiChain',
    url:     process.env.NEXT_PUBLIC_AUTHICHAIN_URL ?? 'https://authichain.com',
    color:   'accent' as const,
    hex:     '#00FFD1',
    tagline: 'Blockchain Product Authentication',
  },
  {
    id:      'qron',
    name:    'QRON',
    url:     process.env.NEXT_PUBLIC_QRON_URL ?? 'https://qron.io',
    color:   'qron' as const,
    hex:     '#F59E0B',
    tagline: 'AI Living QR Art Platform',
  },
  {
    id:      'strainchain',
    name:    'StrainChain',
    url:     process.env.NEXT_PUBLIC_STRAINCHAIN_URL ?? 'https://strainchain.io',
    color:   'strain' as const,
    hex:     '#22C55E',
    tagline: 'Cannabis Supply Chain Verification',
  },
  {
    id:      'govchain',
    name:    'GovChain',
    url:     process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us',
    color:   'govchain' as const,
    hex:     '#1B4FD8',
    tagline: 'Government Provenance & Compliance',
  },
] as const;

export type EcosystemId = typeof ECOSYSTEM[number]['id'];

export function getEcosystemApp(id: EcosystemId) {
  return ECOSYSTEM.find((app) => app.id === id)!;
}

export const GOVCHAIN_URL =
  process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us';
