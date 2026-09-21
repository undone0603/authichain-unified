import { BrandLanding, type LandingFeature } from "@/app/_home/BrandLanding";
import { BRANDS, type BrandId } from "@shared/brands";
import { notFound } from "next/navigation";

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
      eyebrow: "Product Authentication",
      headline: "Issue seals. Bind products. Verify anywhere.",
      subhead:
        "The primary money path is EU DPP Readiness — live Stripe checkout at $299 from the published plan catalogue.",
      features: [
        {
          icon: "🔐",
          title: "Signed seals",
          desc: "Cryptographically signed seals anchored on Polygon. Tamper-evident and publicly verifiable.",
        },
        {
          icon: "📱",
          title: "Issue → Bind → Verify",
          desc: "Issue a seal, bind it to the product, verify from any camera. Agents can pay per call on /x402.",
        },
        {
          icon: "📊",
          title: "EU DPP Readiness",
          desc: "Live $299 Stripe Payment Link from the published catalogue, or email-gated checkout so Stripe can recover the cart. Credited toward AuthiChain Basic on conversion.",
        },
        {
          icon: "🌍",
          title: "Estate pillars",
          desc: "QRON generate, GovChain onboard, StrainChain onboard. No invented customer logos. No live gov-mint promise.",
        },
        {
          icon: "⚡",
          title: "Published prices",
          desc: "Starter $29, Creator $99, EU DPP Readiness $299 — from the AuthiChain plan catalogue, not invented list prices.",
        },
        {
          icon: "✅",
          title: "x402 agent pay",
          desc: "Secondary money path. $0.05 USDC on Base per verification. Public docs at /x402.",
        },
      ],
      stats: [
        { value: "Ed25519", label: "Signed seals" },
        { value: "$299", label: "EU DPP Readiness" },
        { value: "x402", label: "Agent micropayments" },
      ],
      closingLine: "Start EU DPP Readiness on the live checkout path.",
      primaryCta: { label: "Start DPP checkout", href: "/api/checkout/dpp" },
      secondaryCta: { label: "View pricing", href: "/pricing" },
    },
    qron: {
      eyebrow: "AI QR Art",
      headline: "Transform QR Codes Into Stunning Artwork.",
      subhead:
        "Generate custom QR art that scans perfectly. 11 illusion-diffusion styles, rendered in seconds. Cosmic to cyberpunk.",
      features: [
        {
          icon: "🎨",
          title: "11 AI Styles",
          desc: "Cosmic, cyberpunk, watercolor, oil painting, and more. Every QR code is visually unique.",
        },
        {
          icon: "📱",
          title: "100% Scannable",
          desc: "Perfect error correction. Works on every device. No scanning failures, guaranteed.",
        },
        {
          icon: "⚡",
          title: "Generate in Seconds",
          desc: "Real-time diffusion. Batch processing. API access for automation.",
        },
        {
          icon: "📊",
          title: "Real-Time Analytics",
          desc: "Track scans, location data, device info. See your QR codes in action.",
        },
        {
          icon: "🎯",
          title: "Brand Personalization",
          desc: "Custom color palettes, your logo, branded styling. Make every QR code yours.",
        },
        {
          icon: "📦",
          title: "Batch Downloads",
          desc: "Generate 1,000+ QR codes at once. SVG, PNG, and PDF formats.",
        },
      ],
      stats: [
        { value: "11", label: "AI Styles" },
        { value: "100%", label: "Scannable" },
        { value: "1000s", label: "Per Batch" },
      ],
      closingLine:
        "Turn your links into art. Free credits included with signup.",
      primaryCta: { label: "Generate Living QR", href: "/generate" },
      secondaryCta: { label: "View pricing", href: "/pricing" },
    },
    strainchain: {
      eyebrow: "Cannabis Compliance",
      headline: "Cannabis Supply Chain Compliance. Simplified.",
      subhead:
        "Track every gram from seed to sale. Blockchain compliance exports for USMCA, tracking regulations, and state requirements.",
      features: [
        {
          icon: "📋",
          title: "Track & Trace",
          desc: "Seed-to-sale compliance. Full provenance trail. State tracking requirements automated.",
        },
        {
          icon: "⚖️",
          title: "Regulatory Exports",
          desc: "USMCA, state MRB systems, track & trace platforms. One-click compliance reporting.",
        },
        {
          icon: "✅",
          title: "Batch Testing",
          desc: "Lab results, COA management, potency tracking. Immutable testing records.",
        },
        {
          icon: "📱",
          title: "Consumer QR Codes",
          desc: "Show consumers what they're buying. Lab results, strain info, sourcing in seconds.",
        },
        {
          icon: "💰",
          title: "Lower Costs",
          desc: "Reduce compliance overhead. No double-entry. Automated exports save hours per month.",
        },
        {
          icon: "🌍",
          title: "Multi-State Support",
          desc: "Operate in multiple states. Unified tracking across jurisdictions.",
        },
      ],
      stats: [
        { value: "50+", label: "States Supported" },
        { value: "1-Click", label: "Compliance" },
        { value: "100%", label: "Traceable" },
      ],
      closingLine: "Get compliant without the complexity. No setup fees.",
      primaryCta: { label: "Request demo", href: "/onboard" },
      secondaryCta: {
        label: "View genetics library",
        href: "/genetics/mendo-love-farms",
      },
    },
    govchain: {
      eyebrow: "Government Blockchain",
      headline: "Public Records on Blockchain. Transparent & Auditable.",
      subhead:
        "Verifiable government data. Compliance reporting, procurement transparency, and public accountability with cryptographic proof.",
      features: [
        {
          icon: "🏛️",
          title: "Public Records",
          desc: "Government data on blockchain. Immutable, auditable, and publicly verifiable.",
        },
        {
          icon: "📊",
          title: "Procurement Tracking",
          desc: "Contract awards, bids, spending. Full transparency. Real-time compliance reporting.",
        },
        {
          icon: "✅",
          title: "Compliance Exports",
          desc: "FCPA, FAR, SAM.gov integration. Automated reporting saves audit time.",
        },
        {
          icon: "🔐",
          title: "Digital Signatures",
          desc: "Legally binding signatures on blockchain. Meets eSign Act requirements.",
        },
        {
          icon: "📈",
          title: "Performance Metrics",
          desc: "Track agency KPIs. Public dashboards. Citizens can verify government performance.",
        },
        {
          icon: "🌍",
          title: "Multi-Agency Ops",
          desc: "Coordinate across departments. Shared data layer. No silos.",
        },
      ],
      stats: [
        { value: "100%", label: "Transparent" },
        { value: "Real-Time", label: "Reporting" },
        { value: "Blockchain", label: "Immutable" },
      ],
      closingLine: "Make government data public. Build trust with blockchain.",
      primaryCta: { label: "Request access", href: "/onboard" },
      secondaryCta: { label: "Browse opportunities", href: "/opportunities" },
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
      title: "Not Found",
    };
  }

  return {
    title: `${brand.displayName} — ${brand.tagline}`,
    description: brand.description,
    openGraph: {
      title: brand.displayName,
      description: brand.description,
      type: "website",
    },
  };
}

/**
 * Pregenerate landing pages for all brands.
 */
export async function generateStaticParams() {
  return (Object.keys(BRANDS) as BrandId[]).map(brandId => ({
    brandId,
  }));
}
