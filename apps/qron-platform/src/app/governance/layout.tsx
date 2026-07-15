import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GovChain | AuthiChain Ecosystem Governance',
  description: 'The Protocol DAO. Stake $QRON to govern the Truth Network, unlock rewards, and vote on industrial standard updates.',
  openGraph: {
    title: 'GovChain Protocol DAO',
    description: 'Autonomous governance for the AuthiChain ecosystem.',
    images: [
      {
        url: '/media/samples/08_flux_governance.png',
        width: 1200,
        height: 1200,
        alt: 'GovChain Governance DAO',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GovChain | Protocol Governance',
    description: 'Decentralized consensus for the standard of verifiable truth.',
    images: ['/media/samples/08_flux_governance.png'],
  },
};

export default function GovChainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
