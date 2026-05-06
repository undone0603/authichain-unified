import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ReferralTracker } from '@/components/ReferralTracker';
import { Suspense } from 'react';
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
    default: 'AuthiChain Protocol | Verifiable Truth',
    template: '%s | AuthiChain Protocol',
  },
  description: 'The global standard for cryptographically-verified product identity, industrial provenance, and AI-generated QR art.',
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
