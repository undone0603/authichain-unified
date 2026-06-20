/**
 * AuthiChain Stripe Products & Pricing Configuration
 * Centralized product/price definitions for Stripe Checkout
 */

export const STRIPE_PRODUCTS = {
  starter: {
    name: "AuthiChain Starter",
    description: "Essential blockchain authentication for growing brands. 500 verifications/month, AI analysis, QR codes, and basic supply chain tracking.",
    priceMonthly: 4900, // $49.00 in cents
    priceAnnual: 47000, // $470.00/year ($39.17/mo, save 20%)
    features: [
      "500 AI authentications/month",
      "QR code generation",
      "Basic certificates",
      "Email support",
      "1 team member",
    ],
  },
  professional: {
    name: "AuthiChain Professional",
    description: "Advanced authentication suite with NFT certificates, autopilot AI, and full supply chain visibility. 5,000 verifications/month.",
    priceMonthly: 19900, // $199.00 in cents
    priceAnnual: 190800, // $1,908.00/year ($159/mo, save 20%)
    features: [
      "5,000 AI authentications/month",
      "NFT certificate minting",
      "AI Autopilot engine",
      "Supply chain tracking",
      "Email campaigns",
      "Priority support",
      "5 team members",
    ],
  },
  enterprise: {
    name: "AuthiChain Enterprise",
    description: "Full-scale enterprise authentication with white-label solutions, unlimited verifications, dedicated support, and custom integrations.",
    priceMonthly: 79900, // $799.00 in cents
    priceAnnual: 766800, // $7,668.00/year ($639/mo, save 20%)
    features: [
      "Unlimited AI authentications",
      "White-label solution",
      "Custom smart contracts",
      "Dedicated account manager",
      "SLA guarantee",
      "API access",
      "Unlimited team members",
      "Custom integrations",
    ],
  },
  medtech: {
    name: "AuthiChain MedTech Enterprise",
    description: "High-compliance authentication for medical device and pharma supply chains. ISO 13485 Audit Integrity Shield, FIPS 140-2 HSM crypto, and unlimited SKU identification.",
    priceMonthly: 1250000, // $12,500.00 in cents
    priceAnnual: 15000000, // $150,000.00/year in cents
    features: [
      "50,000 AI authentications/month",
      "ISO 13485 Compliance Module",
      "FIPS 140-2 HSM Crypto Module",
      "Clinical Trial Fraud Prevention AI",
      "W3C Verifiable Credentials",
      "Blockchain-anchored Proof of Purity",
      "Priority 24/7 Concierge Support",
      "Dedicated Technical Account Lead",
      "Full API & Webhook Integration",
    ],
  },
  verify_api: {
    name: "Verify API License",
    description: "REST API for product authentication verification. Ideal for SMBs and single-site sellers wanting authentication checks.",
    setupFee: 250000, // $2,500.00 in cents
    priceMonthly: 49900, // $499.00/month
    features: [
      "REST verification API",
      "5,000 verifications/month included",
      "Metered overage charges after quota",
      "Polygon-anchored certificate of authenticity",
      "Email support",
    ],
  },
  white_label: {
    name: "White-Label Trust Portal",
    description: "Fully rebrandable verification portal for mid-market brands and marketplaces. Your domain, your logo, your revenue.",
    setupFee: 1000000, // $10,000.00 in cents
    priceMonthly: 250000, // $2,500.00/month
    features: [
      "Fully rebrandable verification portal",
      "Custom domain & white-label branding",
      "NFT / ERC-721 certificate minting under your brand",
      "Customer-facing scan + story-mode provenance pages",
      "50,000 verifications/month included",
      "Polygon blockchain anchoring",
      "Priority support",
    ],
  },
  vertical: {
    name: "Enterprise Vertical License",
    description: "Dedicated white-label vertical deployment for enterprises, government agencies, and category operators (luxury, cannabis, pharma).",
    setupFee: 2500000, // $25,000.00 in cents
    priceMonthly: 750000, // $7,500.00/month
    features: [
      "Dedicated white-label vertical deployment",
      "Unlimited verifications + SLA",
      "Custom AutoFlow classification for your category",
      "Dedicated account manager",
      "Quarterly business review",
      "Annual revenue audit rights",
      "35% revenue-share option available",
      "24/7 technical support",
    ],
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PRODUCTS;

export function getPlanPrice(plan: PlanKey, billing: "monthly" | "annual"): number {
  const product = STRIPE_PRODUCTS[plan];
  // For licensing tiers with setup fees, return monthly price (setup handled separately)
  if ("setupFee" in product) {
    return product.priceMonthly;
  }
  return billing === "annual" ? product.priceAnnual : product.priceMonthly;
}

export function getPlanSetupFee(plan: PlanKey): number | undefined {
  const product = STRIPE_PRODUCTS[plan];
  return ("setupFee" in product) ? product.setupFee : undefined;
}

export function getPlanQuota(plan: PlanKey): number {
  switch (plan) {
    case "starter": return 500;
    case "professional": return 5000;
    case "enterprise": return 999999;
    case "medtech": return 50000;
    case "verify_api": return 5000;
    case "white_label": return 50000;
    case "vertical": return 999999;
  }
  return 0;
}
