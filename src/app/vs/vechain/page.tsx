import type { Metadata } from 'next';
import { VsPage, type ComparisonRow } from '../_VsPage';

export const metadata: Metadata = {
  title: 'AuthiChain vs VeChain: Which Is Better for Product Authentication? (2026)',
  description:
    'AuthiChain vs VeChain compared — turnkey product authentication vs a general-purpose L1 blockchain. Pricing, EU DPP, onboarding, and AI verification side by side.',
  alternates: { canonical: 'https://authichain.com/vs/vechain' },
  openGraph: {
    title: 'AuthiChain vs VeChain — Product Authentication Compared',
    description:
      'Turnkey, application-ready authentication vs building on the VeChain protocol. Full feature comparison.',
    url: 'https://authichain.com/vs/vechain',
    images: ['/og?title=AuthiChain%20vs%20VeChain&brand=authichain'],
  },
};

const rows: ComparisonRow[] = [
  { feature: 'Turnkey product (no dev team required)', authichain: true, competitor: 'Via ToolChain or partners' },
  { feature: 'On-chain anchoring', authichain: 'Certificate contract live on Polygon', competitor: true },
  { feature: 'AI image analysis (5-agent consensus)', authichain: 'In development', competitor: '—' },
  { feature: 'EU Digital Product Passport export', authichain: 'In development', competitor: 'Via partners' },
  { feature: 'Self-serve onboarding < 1 day', authichain: 'In development', competitor: '—' },
  { feature: 'No native token / crypto to buy', authichain: true, competitor: 'Gas can be sponsored (VIP-191)' },
  { feature: 'Starts at', authichain: 'Contact for pricing', competitor: '—' },
];

const reasons = [
  {
    title: 'A Product, Not a Protocol',
    desc: 'AuthiChain is building the brand-facing layer: seals, certificates, and public verification.',
  },
  {
    title: 'No Token Volatility or Gas UX',
    desc: 'Pay in USD by card through Stripe.',
  },
  {
    title: 'AI + Multi-Chain Assurance',
    desc: 'Our goal: multi-agent AI verification before each certificate is anchored on Polygon.',
  },
];

export default function Page() {
  return (
    <VsPage
      competitor="VeChain"
      slug="vechain"
      competitorSummary="VeChain is a general-purpose enterprise L1 blockchain often used as infrastructure for supply-chain and authentication solutions."
      rows={rows}
      reasons={reasons}
    />
  );
}
