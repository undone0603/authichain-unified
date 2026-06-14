export const SUBSCRIPTION_PLANS = {
  starter: {
    name: "Starter",
    monthlyPrice: 49,
    annualPrice: 470,
    monthlyQuota: 100,
    perAuthCost: "0.49",
    paymentLink: "https://buy.stripe.com/7sY00j87n5xcfWObDC1Nu3r",
    features: [
      "100 authentications/month",
      "Basic AI image analysis",
      "QR code generation",
      "Certificate issuance",
      "Email support",
      "1 team member",
      "Basic analytics dashboard",
    ],
    highlighted: false,
    badge: null,
  },
  professional: {
    name: "Professional",
    monthlyPrice: 199,
    annualPrice: 1910,
    monthlyQuota: 2500,
    perAuthCost: "0.08",
    paymentLink: "https://buy.stripe.com/28E4gzbjze3I7qi4ba1Nu3s",
    features: [
      "2,500 authentications/month",
      "Advanced AI + blockchain verification",
      "NFT marketplace access",
      "Supply chain tracking",
      "AI Autopilot (balanced mode)",
      "Email campaigns (5,000/mo)",
      "Referral program",
      "Priority support (4hr SLA)",
      "5 team members",
      "Revenue analytics",
    ],
    highlighted: true,
    badge: "Most Popular",
  },
  enterprise: {
    name: "Enterprise",
    monthlyPrice: 799,
    annualPrice: 7670,
    monthlyQuota: 25000,
    perAuthCost: "0.03",
    paymentLink: "https://buy.stripe.com/6oU5kDfzP7Fk6medLK1Nu3t",
    features: [
      "25,000 authentications/month",
      "Full AI suite with custom models",
      "White-label solutions",
      "Custom API access & webhooks",
      "AI Autopilot (all modes)",
      "Unlimited email campaigns",
      "Advanced fraud detection",
      "Dedicated account manager",
      "Custom integrations",
      "Unlimited team members",
      "99.9% uptime SLA",
      "On-premise deployment option",
    ],
    highlighted: false,
    badge: "Best Value",
  },
} as const;

// High-ticket plans sold via direct sales engagement, not Stripe checkout.
// These do NOT participate in the subscription router's plan enum.
export const HIGH_TICKET_PLANS = {
  medtech: {
    name: "MedTech Enterprise",
    monthlyPrice: 12500,
    annualPrice: 150000,
    monthlyQuota: 50000,
    perAuthCost: "0.25",
    features: [
      "50,000 authentications/month",
      "ISO 13485 Compliance Module",
      "Clinical Trial Fraud Prevention AI",
      "FIPS 140-2 HSM Crypto Module",
      "W3C Verifiable Credentials",
      "Blockchain-anchored Proof of Purity",
      "Priority 24/7 Concierge Support",
      "Dedicated Technical Account Lead",
      "On-premise / Hybrid Cloud Deployment",
      "Full API & Webhook Integration",
    ],
    highlighted: false,
    badge: "High-Ticket",
    contactSales: true,
  },
} as const;

export const ADDON_PRICING = {
  extraAuthentications: {
    name: "Extra Authentications",
    price: 0.25,
    unit: "per authentication",
    description: "Pay-as-you-go beyond your plan limit",
  },
  nftMinting: {
    name: "NFT Minting",
    price: 2.50,
    unit: "per NFT",
    description: "Mint authentication certificates as NFTs",
  },
  physicalQrPack: {
    name: "Holographic QR Pack",
    price: 75,
    unit: "per 50 stickers",
    description: "Tamper-proof holographic QR stickers",
  },
  nfcTagPack: {
    name: "NFC Tag Pack",
    price: 150,
    unit: "per 50 tags",
    description: "Secure NFC authentication tags",
  },
  whiteLabel: {
    name: "White-Label License",
    price: 2499,
    unit: "per month",
    description: "Full rebrandable platform for resellers",
  },
  apiAccess: {
    name: "API Access",
    price: 299,
    unit: "per month",
    description: "RESTful API with 10,000 calls/month",
  },
} as const;

export const INDUSTRY_SOLUTIONS = {
  luxury: {
    name: "Luxury & Fashion",
    tagline: "Protect brand integrity at every touchpoint",
    startingPrice: 199,
    targetBuyers: ["Brand Protection Directors", "COOs", "Supply Chain VPs"],
  },
  pharmaceutical: {
    name: "Pharmaceutical & Healthcare",
    tagline: "DSCSA-compliant drug supply chain verification",
    startingPrice: 799,
    targetBuyers: ["Chief Compliance Officers", "VP Supply Chain", "Quality Directors"],
  },
  agriculture: {
    name: "Agriculture & Food Safety",
    tagline: "Farm-to-table traceability with blockchain proof",
    startingPrice: 199,
    targetBuyers: ["Quality Assurance Managers", "Supply Chain Directors"],
  },
  art: {
    name: "Art & Collectibles",
    tagline: "Immutable provenance for every masterpiece",
    startingPrice: 49,
    targetBuyers: ["Gallery Owners", "Auction Houses", "Independent Artists"],
  },
  cannabis: {
    name: "Cannabis & Hemp",
    tagline: "Seed-to-sale compliance and strain verification",
    startingPrice: 199,
    targetBuyers: ["Dispensary Owners", "Compliance Officers", "Cultivators"],
  },
  electronics: {
    name: "Electronics & Components",
    tagline: "Eliminate counterfeit components from your supply chain",
    startingPrice: 499,
    targetBuyers: ["Procurement Directors", "Quality Engineers", "Supply Chain VPs"],
  },
  medtech: {
    name: "Medical Device (ISO)",
    tagline: "High-stakes authentication for life-saving hardware",
    startingPrice: 12500,
    targetBuyers: ["Quality Directors", "Regulatory Affairs", "Chief Med Officers"],
  },
} as const;

/**
 * B2B licensing / white-label tiers (distinct from the SaaS SUBSCRIPTION_PLANS).
 * One-time setup fee + monthly recurring, each a live Stripe payment link.
 * Source of truth for the tier definitions: agentz/core/licensing.py (LICENSE_TIERS).
 * Links are managed idempotently by scripts/stripe-tier-links.py.
 */
export const LICENSING_TIERS = [
  {
    key: "verify_api",
    name: "Verify API License",
    setupPrice: 2500,
    monthlyPrice: 499,
    idealFor: "SMB brands & single-site sellers wanting authentication checks",
    setupLink: "https://buy.stripe.com/14A14n2N30cScKC5fe1Ny03",
    monthlyLink: "https://buy.stripe.com/9B6eVdevL8Jo25Y8rq1Ny06",
    highlighted: false,
    badge: null as string | null,
    features: [
      "REST verification API (scan → authenticity score)",
      "5,000 verifications/mo included, then metered",
      "Polygon-anchored certificate of authenticity",
    ],
  },
  {
    key: "white_label",
    name: "White-Label Trust Portal",
    setupPrice: 10000,
    monthlyPrice: 2500,
    idealFor: "Mid-market brands & marketplaces reselling trust under their own name",
    setupLink: "https://buy.stripe.com/dRm28r0EVe3IaCu3761Ny04",
    monthlyLink: "https://buy.stripe.com/eVqaEX3R74t84e6azy1Ny07",
    highlighted: true,
    badge: "Most Popular",
    features: [
      "Fully rebrandable verification portal (your domain, your logo)",
      "NFT / ERC-721 certificate minting under your brand",
      "Customer-facing scan + story-mode provenance pages",
      "50,000 verifications/mo included",
    ],
  },
  {
    key: "vertical",
    name: "Enterprise Vertical License",
    setupPrice: 25000,
    monthlyPrice: 7500,
    idealFor: "Enterprises, govt agencies & vertical operators (luxury, cannabis, pharma)",
    setupLink: "https://buy.stripe.com/aFadR91IZ3p4bGygXW1Ny05",
    monthlyLink: "https://buy.stripe.com/5kQ14n4VbaRw6me8rq1Ny08",
    highlighted: false,
    badge: "35% rev-share option",
    features: [
      "Dedicated white-label vertical deployment (e.g. StrainChain / GovChain)",
      "Unlimited verifications + SLA",
      "Custom AutoFlow classification for your category",
      "Quarterly business review; annual revenue audit right",
    ],
  },
] as const;

export type PlanKey = keyof typeof SUBSCRIPTION_PLANS;
export type AddonKey = keyof typeof ADDON_PRICING;
export type IndustryKey = keyof typeof INDUSTRY_SOLUTIONS;
export type LicensingTier = (typeof LICENSING_TIERS)[number];
