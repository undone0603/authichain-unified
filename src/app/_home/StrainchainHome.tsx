import { Sprout, ClipboardCheck, FlaskConical, MapPin, ShieldCheck, Boxes } from 'lucide-react';
import { BrandLanding } from './BrandLanding';

/**
 * StrainChain (strainchain.io) — seed-to-sale cannabis provenance.
 * Uses the agricultural (amber/soil) theme.
 */
export function StrainchainHome() {
  return (
    <BrandLanding
      brandId="strainchain"
      themeClass="theme-agricultural"
      eyebrow="Seed-to-Sale Provenance"
      heroPoints={['Verify in under a second', 'METRC & BioTrack integrated', 'Consumer-facing QR']}
      howItWorks={[
        {
          title: 'Sync your track-and-trace',
          desc: 'Connect METRC or BioTrack — StrainChain keeps state reporting in sync with an immutable on-chain backstop.',
        },
        {
          title: 'Anchor the proof',
          desc: 'Lab certificates and every hand-off are anchored on-chain, so a tampered or expired COA is detectable in a single scan.',
        },
        {
          title: 'Shoppers scan to trust',
          desc: 'A QR on the package shows a verified chain of custody — turning compliance into trust at the shelf.',
        },
      ]}
      featuresHeading="Provenance your regulators and customers both trust"
      featuresIntro="A consumer-facing, tamper-evident layer on top of the track-and-trace you already run."
      audiences={['Dispensaries', 'MSOs', 'Cultivators', 'Processors', 'Testing labs']}
      stats={[
        { value: '38', label: 'Legal Markets' },
        { value: '$199', label: 'Per Location / Mo' },
        { value: '4', label: 'Audit Layers' },
        { value: '<1 s', label: 'Verify Time' },
      ]}
      features={[
        {
          icon: <Sprout className="h-6 w-6" />,
          title: 'Seed-to-Sale Tracking',
          desc: 'Follow every plant from clone to cure to checkout with QR-anchored events the regulator and the consumer can both verify.',
        },
        {
          icon: <ClipboardCheck className="h-6 w-6" />,
          title: 'Compliance-Grade Records',
          desc: 'METRC and BioTrack integration keeps state reporting in sync automatically, with an immutable on-chain backstop for every entry.',
        },
        {
          icon: <FlaskConical className="h-6 w-6" />,
          title: 'Lab-Certificate Hashing',
          desc: 'Anchor COAs and potency results on-chain so a tampered or expired lab cert is detectable in a single scan.',
        },
        {
          icon: <MapPin className="h-6 w-6" />,
          title: 'Geo-Fenced Custody',
          desc: 'Record location at each hand-off — cultivation, processing, transport, dispensary — for a defensible chain of custody.',
        },
        {
          icon: <ShieldCheck className="h-6 w-6" />,
          title: 'Strain NFTs',
          desc: 'Tokenize genetics and batch identity so cultivators can prove lineage and protect premium strains from imitation.',
        },
        {
          icon: <Boxes className="h-6 w-6" />,
          title: 'Digital Product Passports',
          desc: 'Every package carries a verifiable DPP — origin, test results, and handling history — ready for EU and US disclosure rules.',
        },
      ]}
      closingLine="Turn Compliance Into a Competitive Edge."
    />
  );
}
