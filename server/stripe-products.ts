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
} as const;

export type PlanKey = keyof typeof STRIPE_PRODUCTS;

export function getPlanPrice(plan: PlanKey, billing: "monthly" | "annual"): number {
  const product = STRIPE_PRODUCTS[plan];
  return billing === "annual" ? product.priceAnnual : product.priceMonthly;
}

export function getPlanQuota(plan: PlanKey): number {
  switch (plan) {
    case "starter": return 500;
    case "professional": return 5000;
    case "enterprise": return 999999;
    case "medtech": return 50000;
  }
}
