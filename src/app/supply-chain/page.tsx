import type { Metadata } from 'next';
import { Boxes, MapPin, FlaskConical, ClipboardCheck, ShieldCheck, QrCode } from 'lucide-react';
import { BrandLanding } from '../_home/BrandLanding';

export const metadata: Metadata = {
  title: 'Supply-Chain Provenance | StrainChain',
  description:
    'A published genetics passport for one cultivar, built from certificates you already have. A scan reads that passport.',
};

export default function SupplyChainPage() {
  return (
    <BrandLanding
      brandId="strainchain"
      themeClass="theme-agricultural"
      eyebrow="Supply-Chain Provenance"
      headline="A passport for one cultivar."
      subhead="A published genetics passport for one cultivar, built from certificates you already have."
      primaryCta={{ label: 'Request demo', href: '/onboard' }}
      secondaryCta={{ label: 'How a passport works', href: 'https://strainchain.io/passport' }}
      stats={[
        { value: '$49', label: 'Passport per cultivar' },
        { value: 'CoA', label: 'Certificates you already have' },
        { value: 'One', label: 'Published record' },
        { value: 'Scan', label: 'Reads that passport' },
      ]}
      features={[
        {
          icon: <Boxes className="h-6 w-6" />,
          title: 'Published passport',
          desc: 'A published genetics passport for one cultivar, built from certificates you already have.',
        },
        {
          icon: <MapPin className="h-6 w-6" />,
          title: 'Cultivar identity',
          desc: 'The digital identity is the passport subject for that cultivar.',
        },
        {
          icon: <FlaskConical className="h-6 w-6" />,
          title: 'Lab results you already have',
          desc: 'The passport carries that certificate panel. A scan reads the passport.',
        },
        {
          icon: <ClipboardCheck className="h-6 w-6" />,
          title: 'Existing certificates',
          desc: 'The passport is built from CoAs you already have.',
        },
        {
          icon: <QrCode className="h-6 w-6" />,
          title: 'Scan the passport',
          desc: 'A scan proves the passport for the identity that was scanned. A copied identifier carries the same passport.',
        },
        {
          icon: <ShieldCheck className="h-6 w-6" />,
          title: 'One price',
          desc: 'Passport — Per Cultivar is $49 once.',
        },
      ]}
      closingLine="One cultivar, one passport."
    />
  );
}
