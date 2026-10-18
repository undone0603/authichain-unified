import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stellar Seal Star Map | Living QR by QRON',
  description: 'Turn a star map into a scannable Living QR. Free preview. Signed version with editable redirects and AuthiChain certificate.',
  openGraph: {
    title: 'Stellar Seal Star Map | Living QR by QRON',
    description: 'Generate a Living QR that looks like a star map. It still scans on any phone.',
    type: 'website',
  },
};

export default function StellarSealLayout({ children }: { children: React.ReactNode }) {
  return children;
}
