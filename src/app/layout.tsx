import type { Metadata } from 'next';
<<<<<<< HEAD

export const metadata: Metadata = {
  title: 'AuthiChain',
  description: 'AI-powered product authentication on the blockchain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
=======
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ReferralTracker } from '@/components/ReferralTracker';
import { ThemeManager } from '@/components/ThemeManager';
import { TRPCProvider } from '@/components/TRPCProvider';
import React, { Suspense } from 'react';
import { ThirdwebClientProvider } from '@/components/ThirdwebClientProvider';


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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'AuthiChain | Cryptographically Verified Product Identity',
    description: 'The global standard for cryptographically-verified product identity, industrial provenance, and AI-generated QR art.',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space',
    siteName: 'AuthiChain',
    images: [
      {
        url: '/media/samples/01_flux_qron_space.png',
        width: 1200,
        height: 1200,
        alt: 'AuthiChain — Verified Product Identity',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AuthiChain | Verified Product Identity',
    description: 'Cryptographically-signed AI QR codes. Ed25519 secure, Polygon anchored.',
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
        <TRPCProvider>
          <ThirdwebClientProvider>
            <Suspense fallback={null}>
              <ReferralTracker />
            </Suspense>
            {children}
          </ThirdwebClientProvider>
        </TRPCProvider>

      </body>
>>>>>>> origin/add-agentz-editable
    </html>
  );
}
