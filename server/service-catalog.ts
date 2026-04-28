/**
 * AuthiChain Service Catalog
 * Defines all purchasable one-time services with Stripe product/price IDs
 */

export interface ServiceDefinition {
  key: ServiceType;
  name: string;
  tagline: string;
  description: string;
  price: number; // in cents
  displayPrice: string;
  stripeProductId: string;
  stripePriceId: string;
  deliverables: string[];
  targetAudience: string[];
  deliveryTime: string;
  icon: string; // Lucide icon name
  featured?: boolean;
}

export type ServiceType =
  | "authenticity_audit"
  | "cinematic_page"
  | "automation_setup"
  | "landing_page"
  | "brand_story_pack"
  | "government_dossier"
  | "sba_disaster_loan"
  | "contract_setup";

export const SERVICE_CATALOG: Record<ServiceType, ServiceDefinition> = {
  authenticity_audit: {
    key: "authenticity_audit",
    name: "Authenticity Intelligence Audit",
    tagline: "Your fastest path to trust infrastructure",
    description:
      "A comprehensive forensic analysis of your supply chain risks, counterfeit exposure, and trust layer opportunities. Delivered as a premium 1-2 page intelligence report with actionable recommendations.",
    price: 25000,
    displayPrice: "$250",
    stripeProductId: "prod_U92VgF7580wUWf",
    stripePriceId: "price_1TAkQNGqTruSqV8TjpR71cUz",
    deliverables: [
      "Forensic supply chain risk map",
      "Counterfeit exposure score",
      "Trust layer upgrade plan",
      "Sample QRON cinematic verification",
      "Product mockup with AuthiChain integration",
    ],
    targetAudience: [
      "Local businesses",
      "Cannabis dispensaries",
      "Collectibles shops",
      "Boutiques",
      "Maker studios",
      "Small e-commerce brands",
    ],
    deliveryTime: "24-48 hours",
    icon: "Shield",
    featured: true,
  },

  cinematic_page: {
    key: "cinematic_page",
    name: "QRON Cinematic Product Page",
    tagline: "Premium verification that feels futuristic",
    description:
      "A cinematic verification page for your product that includes a QR code, provenance story, verification badge, and a stunning landing page. Makes your brand feel premium and futuristic.",
    price: 9900,
    displayPrice: "$99",
    stripeProductId: "prod_U92V0a4F7YKPyM",
    stripePriceId: "price_1TAkQbGqTruSqV8T9r0Uo1KS",
    deliverables: [
      "Custom QR code",
      "Cinematic landing page",
      "Provenance story",
      "Verification badge",
    ],
    targetAudience: [
      "Shopify sellers",
      "Etsy makers",
      "Local artisans",
      "Small brands",
    ],
    deliveryTime: "24 hours",
    icon: "Film",
  },

  automation_setup: {
    key: "automation_setup",
    name: "AI Automation Setup",
    tagline: "Automate your business workflows with AI",
    description:
      "Custom AI automation setup tailored to your business. We configure automated posting, lead management, inbox triage, and reporting systems that run on autopilot.",
    price: 29900,
    displayPrice: "$299",
    stripeProductId: "prod_U92VOcRexFKpM3",
    stripePriceId: "price_1TAkQpGqTruSqV8TSRM3LwaB",
    deliverables: [
      "Automated posting system",
      "Lead scraping & management",
      "Inbox triage automation",
      "Automated reporting dashboard",
    ],
    targetAudience: [
      "Small businesses",
      "Creators",
      "Shopify stores",
      "Realtors",
      "Local services",
    ],
    deliveryTime: "3-5 business days",
    icon: "Bot",
  },

  landing_page: {
    key: "landing_page",
    name: "Authenticity Landing Page",
    tagline: "Instant digital trust for your products",
    description:
      "A digital authenticity layer for your products with a QR code, trust badge, cinematic landing page, and simple verification flow. Walk-in ready for any retail business.",
    price: 9900,
    displayPrice: "$99",
    stripeProductId: "prod_U92VAeVfxK5dCE",
    stripePriceId: "price_1TAkR2GqTruSqV8TR0ea5Zxm",
    deliverables: [
      "Custom QR code",
      "Trust badge",
      "Branded landing page",
      "Simple verification flow",
    ],
    targetAudience: [
      "Dispensaries",
      "Boutiques",
      "Resale shops",
      "Collectibles stores",
    ],
    deliveryTime: "24 hours",
    icon: "Globe",
  },

  brand_story_pack: {
    key: "brand_story_pack",
    name: "Brand Story Intelligence Pack",
    tagline: "Your brand narrative, elevated with trust",
    description:
      "A complete brand narrative package that weaves authenticity into your story. Includes a trust narrative, QRON cinematic identity, product authenticity arc, and a sample verification experience.",
    price: 49900,
    displayPrice: "$499",
    stripeProductId: "prod_U92WUhyDGedEUK",
    stripePriceId: "price_1TAkREGqTruSqV8T26Rh7gaF",
    deliverables: [
      "Brand trust story",
      "Trust narrative document",
      "QRON cinematic identity",
      "Product authenticity arc",
      "Sample verification experience",
    ],
    targetAudience: [
      "Small brands",
      "Creators",
      "Local businesses",
      "Etsy sellers",
      "Shopify stores",
    ],
    deliveryTime: "3-5 business days",
    icon: "BookOpen",
  },

  government_dossier: {
    key: "government_dossier",
    name: "Government-Ready Intelligence Dossier",
    tagline: "Enterprise-grade trust infrastructure proposal",
    description:
      "A comprehensive intelligence package designed for government and institutional buyers. Includes a counterfeit risk map, trust infrastructure proposal, pilot plan, and cinematic dossier presentation.",
    price: 250000,
    displayPrice: "$2,500",
    stripeProductId: "prod_U92W7q8TWzFsEj",
    stripePriceId: "price_1TAkRTGqTruSqV8T5TbFgn3Y",
    deliverables: [
      "Counterfeit risk map",
      "Trust infrastructure proposal",
      "Pilot implementation plan",
      "Cinematic dossier presentation",
    ],
    targetAudience: [
      "Local government",
      "County offices",
      "Tribal governments",
      "Law enforcement",
      "Economic development boards",
    ],
    deliveryTime: "5-10 business days",
    icon: "Building2",
    featured: true,
  },

  sba_disaster_loan: {
    key: "sba_disaster_loan",
    name: "SBA Disaster Loan Assistant",
    tagline: "Expert AI-powered loan application preparation",
    description:
      "A complete preparation package for SBA Natural Disaster Loans (EIDL/Physical Damage). We use AI to analyze your business data, prepare the required economic injury statements, and generate a comprehensive application dossier.",
    price: 49900,
    displayPrice: "$499",
    stripeProductId: "prod_SBA_LOAN_001",
    stripePriceId: "price_SBA_LOAN_001",
    deliverables: [
      "Economic injury statement draft",
      "Business debt schedule (SBA Form 2202)",
      "Personal financial statement (SBA Form 413) advisor",
      "Disaster loan application dossier",
      "Submission readiness checklist",
    ],
    targetAudience: [
      "Small business owners",
      "Agricultural cooperatives",
      "Private non-profits",
      "Affected entrepreneurs",
    ],
    deliveryTime: "3-5 business days",
    icon: "CloudLightning",
    featured: true,
  },

  contract_setup: {
    key: "contract_setup",
    name: "AuthiChain Contract Pilot — Setup Fee",
    tagline: "Custom integration + compliance reporting onboarding",
    description:
      "One-time implementation fee for AuthiChain Contract Pilot customers (signed Service Agreement). Covers METRC/DSCSA compliance reporting setup, custom API integration, dedicated onboarding, and Stripe subscription provisioning at the Professional tier ($499/mo).",
    price: 250000,
    displayPrice: "$2,500",
    // Stripe IDs are populated by scripts/setup-stripe-products.ts.
    stripeProductId: "",
    stripePriceId: "",
    deliverables: [
      "METRC / DSCSA compliance reporting configuration",
      "Custom API integration & webhook setup",
      "Dedicated onboarding session",
      "Provisioning of recurring B2B Professional subscription",
    ],
    targetAudience: [
      "Manufacturers",
      "Dispensaries",
      "Brand-protection directors",
      "Compliance officers",
    ],
    deliveryTime: "5-10 business days",
    icon: "FileSignature",
  },
};

export const SERVICE_LIST = Object.values(SERVICE_CATALOG);
export const SERVICE_KEYS = Object.keys(SERVICE_CATALOG) as ServiceType[];
