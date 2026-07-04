import type { Metadata } from 'next';
import { VsPage, type ComparisonRow } from '../_VsPage';

export const metadata: Metadata = {
  title: 'AuthiChain vs Circularise: Which Is Better for Product Authentication? (2026)',
  description:
    'AuthiChain vs Circularise compared — product authentication and EU DPP for every brand vs enterprise material-traceability. Pricing, onboarding, and features side by side.',
  alternates: { canonical: 'https://authichain.com/vs/circularise' },
  openGraph: {
    title: 'AuthiChain vs Circularise — Product Authentication & DPP Compared',
    description:
      'Self-serve authentication and EU Digital Product Passports vs enterprise material traceability. Full feature comparison.',
    url: 'https://authichain.com/vs/circularise',
    images: ['/og?title=AuthiChain%20vs%20Circularise&brand=authichain'],
  },
};

const rows: ComparisonRow[] = [
  { feature: 'Product authentication (anti-counterfeit)', authichain: true, competitor: 'Limited' },
  { feature: 'EU Digital Product Passport export', authichain: true, competitor: true },
  { feature: 'On-chain cryptographic anchoring', authichain: true, competitor: true },
  { feature: 'Bitcoin L1 finality', authichain: true, competitor: false },
  { feature: 'AI image analysis (5-agent consensus)', authichain: true, competitor: false },
  { feature: 'Self-serve onboarding < 1 day', authichain: true, competitor: false },
  { feature: 'Serves SMB + enterprise', authichain: true, competitor: false },
  { feature: 'Transparent public pricing', authichain: true, competitor: false },
  { feature: 'NFT certificates of authenticity', authichain: true, competitor: false },
  { feature: 'Starts at', authichain: '$49/mo', competitor: 'Enterprise quote' },
];

const reasons = [
  {
    title: 'Authentication + Compliance in One',
    desc: 'Circularise specializes in material traceability for large manufacturers. AuthiChain covers both anti-counterfeit authentication and EU DPP compliance — for brands of any size.',
  },
  {
    title: 'Open to Every Brand',
    desc: 'No enterprise-only gate. A single-product luxury maker or a cannabis dispensary can self-serve onboard the same day as a Fortune 500 supply chain.',
  },
  {
    title: 'Strongest Proof Layer',
    desc: 'AI consensus plus dual anchoring on Polygon and Bitcoin L1 gives customs, auditors, and customers verifiable, tamper-proof provenance in a single scan.',
  },
];

export default function Page() {
  return (
    <VsPage
      competitor="Circularise"
      slug="circularise"
      competitorSummary="Circularise is an enterprise blockchain platform focused on supply-chain transparency and material traceability for large manufacturers."
      rows={rows}
      reasons={reasons}
    />
  );
}
