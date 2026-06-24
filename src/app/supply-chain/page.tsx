import type { Metadata } from 'next';
import { Boxes, MapPin, FlaskConical, ClipboardCheck, ShieldCheck, QrCode } from 'lucide-react';
import { BrandLanding } from '../_home/BrandLanding';

export const metadata: Metadata = {
  title: 'Supply-Chain Provenance | StrainChain',
  description: 'Compliance-grade, seed-to-sale blockchain provenance: QR-anchored custody events, lab-cert hashing, and digital product passports.',
};

export default function SupplyChainPage() {
  return (
    <BrandLanding
      brandId="strainchain"
      themeClass="theme-agricultural"
      eyebrow="Supply-Chain Provenance"
      headline="Prove Every Hand-Off, On-Chain."
      subhead="Track products from origin to shelf with QR-anchored custody events, lab-certificate hashing, and verifiable digital product passports."
      primaryCta={{ label: 'See Plans', href: '/pricing' }}
      secondaryCta={{ label: 'Open Dashboard', href: '/dashboard' }}
      stats={[
        { value: 'QR', label: 'Anchored events' },
        { value: 'METRC', label: 'Synced' },
        { value: 'COA', label: 'Hashed' },
        { value: 'DPP', label: 'Per package' },
      ]}
      features={[
        {
          icon: <Boxes className="h-6 w-6" />,
          title: 'End-to-End Custody',
          desc: 'Record every hand-off — cultivation, processing, transport, retail — as an immutable, QR-anchored chain of custody.',
        },
        {
          icon: <MapPin className="h-6 w-6" />,
          title: 'Geo-Tagged Events',
          desc: 'Capture location and timestamp at each step so origin and movement are independently verifiable.',
        },
        {
          icon: <FlaskConical className="h-6 w-6" />,
          title: 'Lab-Certificate Hashing',
          desc: 'Anchor COAs and test results on-chain — an altered or expired certificate is caught in a single scan.',
        },
        {
          icon: <ClipboardCheck className="h-6 w-6" />,
          title: 'Regulator-Ready Records',
          desc: 'METRC and BioTrack integration keeps state reporting in sync with an on-chain backstop for every entry.',
        },
        {
          icon: <QrCode className="h-6 w-6" />,
          title: 'Digital Product Passports',
          desc: 'Each package carries a scannable DPP — origin, testing, and handling history — built for US and EU disclosure rules.',
        },
        {
          icon: <ShieldCheck className="h-6 w-6" />,
          title: 'Tamper-Evident Proof',
          desc: 'Cryptographic seals make counterfeiting and diversion detectable, protecting brand and consumer alike.',
        },
      ]}
      closingLine="Compliance-Grade Provenance, End to End."
    />
  );
}
