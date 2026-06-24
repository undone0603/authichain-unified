import type { Metadata } from 'next';
import { Palette, ScanLine, ShieldCheck, Sparkles, Download, Layers } from 'lucide-react';
import { BrandLanding } from '../_home/BrandLanding';

export const metadata: Metadata = {
  title: 'AI QR Art | QRON',
  description: 'Generate cryptographically-signed, scannable AI QR art in seconds — 11 illusion-diffusion styles, Ed25519-signed and Polygon-anchored.',
};

export default function QrCodesPage() {
  return (
    <BrandLanding
      brandId="qron"
      themeClass="theme-artistic"
      eyebrow="AI QR Art"
      headline="QR Codes That Are Actually Art."
      subhead="Turn any URL into a scannable work of art. 11 illusion-diffusion styles, rendered in seconds, every one cryptographically signed and still scannable."
      primaryCta={{ label: 'Buy Generations', href: '/pricing' }}
      secondaryCta={{ label: 'Try the Generator', href: '/' }}
      stats={[
        { value: '11', label: 'Art styles' },
        { value: '~5s', label: 'Per render' },
        { value: 'Ed25519', label: 'Signed' },
        { value: '100%', label: 'Scannable' },
      ]}
      features={[
        {
          icon: <Palette className="h-6 w-6" />,
          title: 'Illusion-Diffusion Styles',
          desc: 'From cosmic to cyberpunk, holographic to hand-painted — pick a style and get a QR that doubles as brand art.',
        },
        {
          icon: <ScanLine className="h-6 w-6" />,
          title: 'Guaranteed Scannable',
          desc: 'Every generation is validated for scannability across phone cameras before you download it — art that still works.',
        },
        {
          icon: <ShieldCheck className="h-6 w-6" />,
          title: 'Cryptographically Signed',
          desc: 'Each QRON is Ed25519-signed and anchored on Polygon, so the destination is verifiable and tamper-evident.',
        },
        {
          icon: <Sparkles className="h-6 w-6" />,
          title: 'Iconic Brand Presets',
          desc: 'One-click presets tuned for recognizable brand aesthetics, or steer it with your own creative prompt.',
        },
        {
          icon: <Download className="h-6 w-6" />,
          title: 'Print-Ready Exports',
          desc: 'Download high-resolution art ready for packaging, posters, business cards, or on-chain inscription.',
        },
        {
          icon: <Layers className="h-6 w-6" />,
          title: 'Bitcoin Ordinals',
          desc: 'Inscribe your favorite QRONs permanently on Bitcoin L1 for a transferable, collectible digital artifact.',
        },
      ]}
      closingLine="AI-Generated QR Art That Scans."
    />
  );
}
