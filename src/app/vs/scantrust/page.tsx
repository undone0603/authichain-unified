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
  { feature: 'On-chain cryptographic anchoring', authichain: true, competitor: false },
  { feature: 'Bitcoin L1 + Polygon finality', authichain: true, competitor: false },
  { feature: 'AI image analysis (5-agent consensus)', authichain: true, competitor: 'Limited' },
  { feature: 'EU Digital Product Passport export', authichain: true, competitor: true },
  { feature: 'Self-serve onboarding < 1 day', authichain: true, competitor: false },
  { feature: 'Transparent public pricing', authichain: true, competitor: false },
  { feature: 'W3C Verifiable Credentials (you hold keys)', authichain: true, competitor: false },
  { feature: 'NFT certificates of authenticity', authichain: true, competitor: false },
  { feature: 'No minimum enterprise contract', authichain: true, competitor: false },
  { feature: 'Starts at', authichain: '$49/mo', competitor: 'Enterprise quote' },
];

const reasons = [
  {
    title: 'Tamper-Proof by Design',
    desc: 'Every verification is anchored to Bitcoin L1 and Polygon — not a private database you have to trust. Scantrust relies on centralized cloud records that can be altered or lost.',
  },
  {
    title: 'Live in a Day, Not a Quarter',
    desc: 'Import your catalog and issue authenticated codes the same day. No sales gate, no 3–6 month integration project, no compliance consultant on retainer.',
  },
  {
    title: 'Pricing You Can Actually See',
    desc: 'Public plans from $49/mo with no minimum commitment. Scantrust hides pricing behind enterprise sales calls — you find out the cost after weeks of demos.',
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
