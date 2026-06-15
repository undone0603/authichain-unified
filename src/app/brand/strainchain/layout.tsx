import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StrainChain — Cannabis Supply Chain on the Blockchain',
  description:
    'From seed to sale, every gram tracked on-chain. Metrc-compliant cannabis authentication across 23 states. Genetic mapping, geo-fencing, real-time COA verification.',
  metadataBase: new URL('https://strainchain.io'),
  openGraph: {
    title: 'StrainChain — Seed to Sale. Every Gram. On Chain.',
    description: 'Blockchain-native cannabis compliance for cultivators, processors, and dispensaries.',
    url: 'https://strainchain.io',
    siteName: 'StrainChain',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StrainChain — Cannabis Supply Chain Authentication',
    description: 'Every gram tracked on-chain. Metrc-compliant. 23 states. From seed to sale.',
  },
  keywords: ['cannabis', 'supply chain', 'Metrc', 'blockchain', 'compliance', 'seed to sale', 'dispensary', 'cultivation'],
};

export default function StrainchainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
