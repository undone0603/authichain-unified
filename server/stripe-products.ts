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
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL || "",
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
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || "",
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
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || "",
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
  }
}

export function getStripePriceId(plan: PlanKey, billing: "monthly" | "annual"): string | null {
  const product = STRIPE_PRODUCTS[plan];
  const id = billing === "annual" ? product.stripePriceIdAnnual : product.stripePriceIdMonthly;
  return id?.trim() ? id.trim() : null;
}
