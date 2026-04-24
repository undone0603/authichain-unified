// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { EcosystemNav } from '@/components/ecosystem-nav';
import { EcosystemFooter } from '@/components/ecosystem-footer';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AuthiChain — Blockchain Product Authentication',
    template: '%s | AuthiChain Ecosystem',
  },
  description:
    'AuthiChain provides blockchain-powered product authentication, QR verification, ' +
    'and government supply chain compliance across AuthiChain, QRON, StrainChain, and GovChain.',
  keywords: [
    'blockchain authentication',
    'product verification',
    'QR code',
    'supply chain',
    'govchain',
    'strainchain',
    'QRON',
  ],
  authors: [{ name: 'AuthiChain', url: 'https://authichain.com' }],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://authichain.com'
  ),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'AuthiChain Ecosystem',
    images: [
      {
        // High-quality Unsplash blockchain hero image (no API key required)
        url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&h=630&fit=crop',
        width: 1200,
        height: 630,
        alt: 'AuthiChain Blockchain Authentication',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@authichain',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0F1E',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="bg-primary text-white antialiased min-h-screen flex flex-col">
        <EcosystemNav />
        <main className="flex-1">{children}</main>
        <EcosystemFooter />
      </body>
    </html>
  );
}
