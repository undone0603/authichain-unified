import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AuthiChain | Enterprise Authentication Protocol',
  description: 'Industrial-grade Ed25519 cryptographic signing and blockchain anchoring for the visual internet.',
  openGraph: {
    title: 'AuthiChain Protocol',
    description: 'The global standard for cryptographically-verified product identity.',
    images: [
      {
        url: '/media/samples/03_flux_authichain.png',
        width: 1200,
        height: 1200,
        alt: 'AuthiChain Enterprise Protocol',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AuthiChain | Enterprise Authentication',
    description: 'Government-grade cryptographic signatures for industrial assets.',
    images: ['/media/samples/03_flux_authichain.png'],
  },
};

export default function AuthiChainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
