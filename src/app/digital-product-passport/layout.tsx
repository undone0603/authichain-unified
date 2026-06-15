import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Digital Product Passport | AuthiChain',
    template: '%s | AuthiChain',
  },
  description:
    'AuthiChain industrial Digital Product Passport platform — blockchain-anchored, EU 2024/1789 compliant. Battery passports, supply chain traceability, and AI art QR codes.',
  alternates: {
    canonical: '/digital-product-passport',
  },
  openGraph: {
    siteName: 'AuthiChain',
    images: [
      {
        url: '/media/samples/03_flux_authichain.png',
        width: 1200,
        height: 630,
        alt: 'AuthiChain Digital Product Passport',
      },
    ],
  },
};

export default function DPPLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
