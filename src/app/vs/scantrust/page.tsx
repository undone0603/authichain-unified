import type { Metadata } from 'next';
import { VsPage, type ComparisonRow } from '../_VsPage';

export const metadata: Metadata = {
  title: 'AuthiChain vs Scantrust: Which Is Better for Product Authentication? (2026)',
  description:
    'AuthiChain vs Scantrust compared feature-by-feature — blockchain anchoring, EU DPP compliance, pricing, and onboarding speed. See why brands switch to AuthiChain.',
  alternates: { canonical: 'https://authichain.com/vs/scantrust' },
  openGraph: {
    title: 'AuthiChain vs Scantrust — Product Authentication Compared',
    description:
      'Blockchain-anchored authentication with transparent pricing and sub-day onboarding vs Scantrust. Full feature comparison.',
    url: 'https://authichain.com/vs/scantrust',
    images: ['/og?title=AuthiChain%20vs%20Scantrust&brand=authichain'],
  },
};

const rows: ComparisonRow[] = [
  { feature: 'On-chain cryptographic anchoring', authichain: 'Certificate contract live on Polygon', competitor: 'Has shipped blockchain integrations (Cardano, Hyperledger)' },
  { feature: 'AI image analysis (5-agent consensus)', authichain: 'In development', competitor: '—' },
  { feature: 'EU Digital Product Passport export', authichain: 'In development', competitor: true },
  { feature: 'Self-serve onboarding < 1 day', authichain: 'In development', competitor: 'Yes (self-serve signup)' },
  { feature: 'NFT certificates of authenticity', authichain: 'In development', competitor: '—' },
  { feature: 'No minimum enterprise contract', authichain: true, competitor: 'Self-serve plans available' },
  { feature: 'Starts at', authichain: 'Contact for pricing', competitor: 'From €230/yr (e-label)' },
];

const reasons = [
  {
    title: 'Tamper-Proof by Design',
    desc: 'AuthiChain\'s certificate contract is live on Polygon. Signed, publicly verifiable certificates are in development.',
  },
  {
    title: 'Live in a Day, Not a Quarter',
    desc: 'Import your catalog and issue authenticated codes the same day.',
  },
  {
    title: 'Pricing You Can Actually See',
    desc: 'Pricing: contact us at authichain.com/contact.',
  },
];

export default function Page() {
  return (
    <VsPage
      competitor="Scantrust"
      slug="scantrust"
      competitorSummary="Scantrust is an established secure-QR and brand-protection platform focused on enterprise anti-counterfeiting."
      rows={rows}
      reasons={reasons}
    />
  );
}
