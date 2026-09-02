  import { BrandLanding,type LandingFeature } from '@/app/_home/BrandLanding';
  import { BRANDS,type BrandId } from '@shared/brands';
  import { notFound } from 'next/navigation';

interface LandingPageProps {
  params: Promise<{ brandId: string }>;
}

/**
 * Dynamic brand landing pages: `/landing/:brandId`
 *
 * Renders a conversion-focused landing page for any configured brand.
 * The page uses the shared BrandLanding component with brand-specific
 * features and CTAs.
 *
 * Landing pages are proxied through the authichain-com Cloudflare Worker,
 * which dispatches /landing/* requests to this route.
 */
export default async function LandingPage({ params }: LandingPageProps) {
  const { brandId } = await params;

  // Validate the brand exists
  if (!BRANDS[brandId as BrandId]) {
    notFound();
  }

  const _unused_brand_27 = BRANDS[brandId as BrandId];

  // Generate brand-specific landing page content
  const content = getLandingContent(brandId as BrandId);

  return (
    <BrandLanding
      brandId={brandId as BrandId}
      themeClass={content.themeClass}
      eyebrow={content.eyebrow}
      headline={content.headline}
      subhead={content.subhead}
      features={content.features}
      stats={content.stats}
      closingLine={content.closingLine}
      primaryCta={content.primaryCta}
      secondaryCta={content.secondaryCta}
    />
  );
}

interface LandingContent {
  themeClass?: string;
  eyebrow: string;
  headline?: string;
  subhead?: string;
  features: LandingFeature[];
  stats?: Array<{ value: string; label: string }>;
  closingLine: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

/**
 * Get landing page content for a brand.
 *
 * This could be extended to:
 * - Call an agent to generate copy dynamically
 * - Fetch from a database
 * - Use A/B testing variants
 */
function getLandingContent(brandId: BrandId): LandingContent {
  const baseContent: Record<BrandId, LandingContent> = {
    authichain: {
      eyebrow: 'Product Authentication',
      headline: 'Every Product Verified. Every Transaction Trusted.',
      subhead:
        'Blockchain-powered authentication with AI verification. NFT certificates, QR scanning, and supply chain transparency in minutes.',
      features: [
        {
          icon: '🔐',
          title: 'ERC-721 Certificates',
          desc: 'Immutable product seals on Polygon blockchain. Cryptographic proof of authenticity with full provenance.',
        },
        {
          icon: '📱',
          title: 'AI QR Verification',
          desc: '5-agent consensus (Guardian, Archivist, Sentinel, Scout, Arbiter) verifies authenticity in 2.1 seconds.',
        },
        {
          icon: '📊',
          title: 'Supply Chain Audit',
          desc: '22 supply chain events tracked immutably: manufacturing, customs, QA, distribution, retail receipt.',
        },
        {
          icon: '🌍',
          title: 'Multi-Standard Compliance',
          desc: 'EU DPP, CSRD, EUDR, FDA DSCSA, USMCA, ISO 22005. One integration covers every requirement.',
        },
        {
          icon: '⚡',
          title: '$0.004 Per Seal',
          desc: 'Industry-leading pricing. No setup fees. Monthly plans from $49 (Starter) to $1,999 (Enterprise).',
        },
        {
          icon: '✅',
          title: 'Zero Dependencies',
          desc: 'Open protocol. Offline verification. No vendor lock-in. Run the verifier on your own machine.',
        },
      ],
      stats: [
        { value: '2.1s', label: 'Verification Time' },
        { value: '5', label: 'AI Agents' },
        { value: '22+', label: 'Supply Events' },
      ],
      closingLine:
        'Start protecting your products today. First seal included. No credit card required.',
      primaryCta: { label: 'Get Started Free', href: '/onboard' },
      secondaryCta: { label: 'Book a Demo', href: 'mailto:hello@authichain.com' },
    },
    qron: {
      eyebrow: 'AI QR Art',
      headline: 'Transform QR Codes Into Stunning Artwork.',
      subhead:
        'Generate custom QR art that scans perfectly. 11 illusion-diffusion styles, rendered in seconds. Cosmic to cyberpunk.',
      features: [
        {
          icon: '🎨',
          title: '11 AI Styles',
          desc: 'Cosmic, cyberpunk, watercolor, oil painting, and more. Every QR code is visually unique.',
        },
        {
          icon: '📱',
          title: '100% Scannable',
          desc: 'Perfect error correction. Works on every device. No scanning failures, guaranteed.',
        },
        {
          icon: '⚡',
          title: 'Generate in Seconds',
          desc: 'Real-time diffusion. Batch processing. API access for automation.',
        },
        {
          icon: '📊',
          title: 'Real-Time Analytics',
          desc: 'Track scans, location data, device info. See your QR codes in action.',
        },
        {
          icon: '🎯',
          title: 'Brand Personalization',
          desc: 'Custom color palettes, your logo, branded styling. Make every QR code yours.',
        },
        {
          icon: '📦',
          title: 'Batch Downloads',
          desc: 'Generate 1,000+ QR codes at once. SVG, PNG, and PDF formats.',
        },
      ],
      stats: [
        { value: '11', label: 'AI Styles' },
        { value: '100%', label: 'Scannable' },
        { value: '1000s', label: 'Per Batch' },
      ],
      closingLine: 'Turn your links into art. Free credits included with signup.',
      primaryCta: { label: 'Generate QR Art', href: '/qr-codes' },
      secondaryCta: { label: 'View Gallery', href: '/gallery' },
    },
    strainchain: {
      eyebrow: 'Cannabis Compliance',
      headline: 'Cannabis Supply Chain Compliance. Simplified.',
      subhead:
        'Track every gram from seed to sale. Blockchain compliance exports for USMCA, tracking regulations, and state requirements.',
      features: [
        {
          icon: '📋',
          title: 'Track & Trace',
          desc: 'Seed-to-sale compliance. Full provenance trail. State tracking requirements automated.',
        },
        {
          icon: '⚖️',
          title: 'Regulatory Exports',
          desc: 'USMCA, state MRB systems, track & trace platforms. One-click compliance reporting.',
        },
        {
          icon: '✅',
          title: 'Batch Testing',
          desc: 'Lab results, COA management, potency tracking. Immutable testing records.',
        },
        {
          icon: '📱',
          title: 'Consumer QR Codes',
          desc: 'Show consumers what they\'re buying. Lab results, strain info, sourcing in seconds.',
        },
        {
          icon: '💰',
          title: 'Lower Costs',
          desc: 'Reduce compliance overhead. No double-entry. Automated exports save hours per month.',
        },
        {
          icon: '🌍',
          title: 'Multi-State Support',
          desc: 'Operate in multiple states. Unified tracking across jurisdictions.',
        },
      ],
      stats: [
        { value: '50+', label: 'States Supported' },
        { value: '1-Click', label: 'Compliance' },
        { value: '100%', label: 'Traceable' },
      ],
      closingLine: 'Get compliant without the complexity. No setup fees.',
      primaryCta: { label: 'Start Tracking', href: '/dashboard' },
      secondaryCta: { label: 'Schedule Demo', href: 'mailto:hello@strainchain.com' },
    },
    govchain: {
      eyebrow: 'Government Blockchain',
      headline: 'Public Records on Blockchain. Transparent & Auditable.',
      subhead:
        'Verifiable government data. Compliance reporting, procurement transparency, and public accountability with cryptographic proof.',
      features: [
        {
          icon: '🏛️',
          title: 'Public Records',
          desc: 'Government data on blockchain. Immutable, auditable, and publicly verifiable.',
        },
        {
          icon: '📊',
          title: 'Procurement Tracking',
          desc: 'Contract awards, bids, spending. Full transparency. Real-time compliance reporting.',
        },
        {
          icon: '✅',
          title: 'Compliance Exports',
          desc: 'FCPA, FAR, SAM.gov integration. Automated reporting saves audit time.',
        },
        {
          icon: '🔐',
          title: 'Digital Signatures',
          desc: 'Legally binding signatures on blockchain. Meets eSign Act requirements.',
        },
        {
          icon: '📈',
          title: 'Performance Metrics',
          desc: 'Track agency KPIs. Public dashboards. Citizens can verify government performance.',
        },
        {
          icon: '🌍',
          title: 'Multi-Agency Ops',
          desc: 'Coordinate across departments. Shared data layer. No silos.',
        },
      ],
      stats: [
        { value: '100%', label: 'Transparent' },
        { value: 'Real-Time', label: 'Reporting' },
        { value: 'Blockchain', label: 'Immutable' },
      ],
      closingLine: 'Make government data public. Build trust with blockchain.',
      primaryCta: { label: 'Get Started', href: '/dashboard' },
      secondaryCta: { label: 'Contact Us', href: 'mailto:hello@govchain.us' },
    },
  };

  return baseContent[brandId];
}

/**
 * Generate static metadata for the landing page.
 */
export async function generateMetadata({ params }: LandingPageProps) {
  const { brandId } = await params;
  const brand = BRANDS[brandId as BrandId];

  if (!brand) {
    return {
      title: 'Not Found',
    };
  }

  return {
    title: `${brand.displayName} — ${brand.tagline}`,
    description: brand.description,
    openGraph: {
      title: brand.displayName,
      description: brand.description,
      type: 'website',
    },
  };
}

/**
 * Pregenerate landing pages for all brands.
 */
export async function generateStaticParams() {
  return (Object.keys(BRANDS) as BrandId[]).map((brandId) => ({
    brandId,
  }));
}
