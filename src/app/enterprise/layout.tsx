import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enterprise | QRON Protocol',
  description:
    'Government-grade cryptographic QR art and product authentication for enterprise. Multi-region edge delivery with immutable supply chain provenance.',
  openGraph: {
    title: 'QRON for Enterprise — Industrial Scale Authentication',
    description:
      'Cryptographically-signed QR codes with multi-region edge delivery and full supply chain traceability for the world demanding brands.',
    url: 'https://qron.space/enterprise',
    images: [{ url: '/media/samples/01_flux_qron_space.png', width: 1200, height: 1200 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QRON Enterprise',
    description: 'Industrial-scale authenticated QR art for global brands.',
    images: ['/media/samples/01_flux_qron_space.png'],
  },
};

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
