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
  { feature: 'Product authentication (anti-counterfeit)', authichain: true, competitor: '—' },
  { feature: 'EU Digital Product Passport export', authichain: 'In development', competitor: true },
  { feature: 'On-chain cryptographic anchoring', authichain: 'Certificate contract live on Polygon', competitor: true },
  { feature: 'AI image analysis (5-agent consensus)', authichain: 'In development', competitor: '—' },
  { feature: 'Self-serve onboarding < 1 day', authichain: 'In development', competitor: false },
  { feature: 'Serves SMB + enterprise', authichain: true, competitor: '—' },
  { feature: 'NFT certificates of authenticity', authichain: 'In development', competitor: '—' },
  { feature: 'Starts at', authichain: 'Contact for pricing', competitor: 'Enterprise quote' },
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
    desc: 'Our goal: AI consensus plus on-chain anchoring, so customs, auditors, and customers can verify provenance in a single scan.',
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
