import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GovChain — Decentralized Governance for Digital Trust',
  description:
    'DAO governance platform for government and enterprise. Stake $QRON tokens, vote on proposals, earn 11.4% APY. Bringing blockchain transparency to public-sector accountability.',
  metadataBase: new URL('https://govchain.us'),
  openGraph: {
    title: 'GovChain — Decentralized Governance for Digital Trust',
    description: 'Stake $QRON. Vote on proposals. Earn 11.4% APY. Governance on-chain.',
    url: 'https://govchain.us',
    siteName: 'GovChain',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GovChain — Decentralized DAO Governance',
    description: 'Blockchain governance for government and enterprise. Stake $QRON. Vote. Earn.',
  },
  keywords: ['DAO', 'governance', 'blockchain', 'QRON', 'staking', 'government', 'decentralized'],
};

export default function GovchainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
