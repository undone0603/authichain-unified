import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ReferralTracker } from '@/components/ReferralTracker';
import { ThemeManager } from '@/components/ThemeManager';
import React, { Suspense } from 'react';
import { ThirdwebProvider } from 'thirdweb/react';

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
  metadataBase: new URL('https://qron.space'),
  alternates: {
    canonical: '/',
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
    title: 'QRON | Verified AI QR Art',
    description: 'Transform your brand with cryptographically-signed AI QR codes.',
    images: ['/media/samples/01_flux_qron_space.png'],
    creator: '@AuthiChain',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeManager />
        <ThirdwebProvider>
          <Suspense fallback={null}>
            <ReferralTracker />
          </Suspense>
          {children}
        </ThirdwebProvider>
      </body>
    </html>
  );
}
