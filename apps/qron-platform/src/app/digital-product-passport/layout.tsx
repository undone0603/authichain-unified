import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StrainChain | Industrial Digital Product Passports',
  description: 'EU-compliant Digital Product Passports (DPP) with AI-generated QR art and blockchain-verified industrial data.',
  openGraph: {
    title: 'StrainChain Industrial Protocol',
    description: 'The standard for industrial provenance and EU DPP compliance.',
    images: [
      {
        url: '/media/samples/04_flux_ev_industry.png',
        width: 1200,
        height: 1200,
        alt: 'StrainChain Industrial Passport',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StrainChain | Industrial DPP',
    description: 'Automated compliance and provenance for agriculture and high-value assets.',
    images: ['/media/samples/04_flux_ev_industry.png'],
  },
};

export default function StrainChainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
