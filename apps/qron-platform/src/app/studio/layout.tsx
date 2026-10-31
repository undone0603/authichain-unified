import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QRON Studio — AI QR Code Art Generator',
  description:
    'Create AI QR art with Static, Stereographic, Holographic, Memory, and Custom modes.',
  openGraph: {
    title: 'QRON Studio — Generate AI QR Art',
    description:
      'Transform any URL into a verified, AI-generated QR artwork. Choose from 5 visual modes and anchor to the blockchain.',
    url: 'https://qron.space/studio',
    images: [{ url: '/media/samples/01_flux_qron_space.png', width: 1200, height: 1200 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QRON Studio',
    description: 'Generate AI QR art in 5 visual modes.',
    images: ['/media/samples/01_flux_qron_space.png'],
  },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
