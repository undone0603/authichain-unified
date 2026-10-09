import { Palette, ScanLine, Sparkles, Download, Link2 } from 'lucide-react';
import { BrandLanding } from './BrandLanding';

/**
 * QRON marketing home — light-enterprise shell. Generation stays on /generate,
 * the live first-dollar path for qron.space.
 */
export function QronMarketingHome() {
  return (
    <BrandLanding
      brandId="qron"
      eyebrow="Living QR"
      headline="AI QR art that still scans."
      subhead="Turn a URL into a Living QR for packaging and labels. Scannable from any camera."
      primaryCta={{ label: 'Generate Living QR', href: '/generate' }}
      secondaryCta={{ label: 'View pricing', href: '/pricing' }}
      stats={[
        { value: 'Scannable', label: 'Any camera' },
        { value: 'Editable', label: 'Redirects' },
      ]}
      features={[
        {
          icon: <Sparkles className="h-6 w-6" />,
          title: 'Living QR generation',
          desc: 'Create a signed QR that can change destination later, so packaging does not need a reprint when a campaign URL changes.',
        },
        {
          icon: <Palette className="h-6 w-6" />,
          title: 'Illusion-diffusion styles',
          desc: 'From cosmic to cyberpunk — art that remains a working code, validated for phone-camera scannability.',
        },
        {
          icon: <ScanLine className="h-6 w-6" />,
          title: 'Guaranteed scannable',
          desc: 'Works with any standard camera app. No special reader required.',
        },
        {
          icon: <Download className="h-6 w-6" />,
          title: 'Print-ready exports',
          desc: 'High-resolution art for packaging, posters, and labels.',
        },
        {
          icon: <Link2 className="h-6 w-6" />,
          title: 'Estate conversion path',
          desc: 'qron.space/generate is proxied to the AuthiChain app. That is how a stranger starts.',
        },
      ]}
      closingLine="Generate a Living QR."
    />
  );
}
