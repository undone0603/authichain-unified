import IndustryShowcase from '@/components/IndustryShowcase';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Industry Showcase | QRON × AuthiChain',
  description: '10 Industry QR Art Pieces — Model A Series by QRON Engine.',
};

export default function IndustriesPage() {
  return <IndustryShowcase />;
}
