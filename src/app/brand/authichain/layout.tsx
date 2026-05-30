import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AuthiChain — Physical Commerce Authentication',
  description:
    'Enterprise authentication infrastructure for verifying physical goods. Ed25519 cryptographic signatures, blockchain-anchored provenance, and AI-powered QR codes across 10+ industry verticals.',
  metadataBase: new URL('https://authichain.com'),
  openGraph: {
    title: 'AuthiChain — Physical Commerce Authentication',
    description: 'Verify anything physical. Authenticate everything digital.',
    url: 'https://authichain.com',
    siteName: 'AuthiChain',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AuthiChain — Physical Commerce Authentication',
    description: 'Enterprise authentication for physical goods. Ed25519, blockchain, AI QR.',
  },
  keywords: ['authentication', 'blockchain', 'QR code', 'supply chain', 'NFT certificate', 'provenance'],
};

export default function AuthichainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
