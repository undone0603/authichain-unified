import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ReferralTracker } from '@/components/ReferralTracker';
import { FunnelTracker } from '@/components/FunnelTracker';
import { ThemeManager } from '@/components/ThemeManager';
import { TRPCProvider } from '@/components/TRPCProvider';
import React, { Suspense } from 'react';
import { ThirdwebProvider } from 'thirdweb/react';
import { SiteNav } from '@/components/SiteNav';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'QRON | Cryptographically Verified AI QR Art',
    template: '%s | AuthiChain Protocol',
  },
  description: 'The global standard for cryptographically-verified product identity, industrial provenance, and AI-generated QR art.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://authichain.com'),
  keywords: [
    'QR code authentication', 'blockchain product verification', 'NFT certificates',
    'supply chain traceability', 'AI QR art', 'government records', 'document sealing',
    'Polygon NFT', 'AuthiChain', 'QRON', 'GovChain', 'StrainChain',
  ],
  authors: [{ name: 'AuthiChain Inc.', url: 'https://authichain.com' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/media/hero-qron-art.png',
  },
  openGraph: {
    title: 'QRON | Verified AI QR Art',
    description: 'Transform your brand with cryptographically-signed AI QR codes. Ed25519 secure, Polygon anchored.',
    url: 'https://qron.space',
    siteName: 'QRON Space',
    images: [
      {
        url: '/media/samples/01_flux_qron_space.png',
        width: 1200,
        height: 1200,
        alt: 'AuthiChain QRON Artistic AI',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@qron_space',
    creator: '@qron_space',
    title: 'QRON | Verified AI QR Art',
    description: 'Transform your brand with cryptographically-signed AI QR codes.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeManager>
          <TRPCProvider>
            <Suspense fallback={null}>
              <SiteNav />
            </Suspense>
            <Suspense fallback={null}>
              <ReferralTracker />
            </Suspense>
            <FunnelTracker />
            <ThirdwebProvider>
              {children}
            </ThirdwebProvider>
          </TRPCProvider>
        </ThemeManager>
      </body>
    </html>
  );
}
