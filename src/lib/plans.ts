// â”€â”€â”€ QRON Plans â€” mapped to real Stripe products/prices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Products and prices are pre-created in the Stripe dashboard.
// priceId values are LIVE; keep in sync with Stripe.

export type PlanId = 'free' | 'starter' | 'creator' | 'studio' | 'business';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  price_suffix?: string;
  description: string;
  generations: number; // 0 = unlimited
  stripe_price_id: string | null;
  stripe_payment_link?: string;
  stripe_mode: 'payment' | 'subscription' | null;
  tier: 'free' | 'pro' | 'enterprise';
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Get started with AI QR codes',
    generations: 10,
    stripe_price_id: null,
    stripe_mode: null,
    tier: 'free',
    features: [
      '10 generations / month',
      'Static & Stereographic modes',
      'Basic styles',
      'Download as PNG',
    ],
    cta: 'Get Started Free',
  },
  {
    id: 'starter',
    name: 'Starter Pack',
    price: 29,
    description: '100 AI QR generations, never expire',
    generations: 100,
    stripe_price_id: 'price_1TGOM9GqTruSqV8TdV7j3DuL',
    stripe_payment_link: 'https://buy.stripe.com/6oUeVfflp9lPgzY76AaIM0c',
    stripe_mode: 'payment',
    tier: 'pro',
    features: [
      '100 generations (one-time)',
      'All free modes',
      'Holographic & Memory modes',
      'Ed25519-signed on AuthiChain',
    ],
    cta: 'Buy Starter Pack',
  },
  {
    id: 'creator',
    name: 'Creator Pack',
    price: 99,
    description: '500 AI QR generations â€” best value',
    generations: 500,
    stripe_price_id: 'price_1TGAiZGqTruSqV8Tb4ZdCVKr',
    stripe_payment_link: 'https://buy.stripe.com/28E00l6OT7dHcjI1MgaIM0d',
    stripe_mode: 'payment',
    tier: 'pro',
    features: [
      '500 generations (one-time)',
      'All Pro modes',
      'Premium styles',
      'Priority generation queue',
      'Ed25519-signed on AuthiChain',
    ],
    cta: 'Buy Creator Pack',
    highlighted: true,
  },
  {
    id: 'studio',
    name: 'Studio Pack',
    price: 299,
    description: '2,000 generations for agencies & studios',
    generations: 2000,
    stripe_price_id: 'price_1TGOMBGqTruSqV8TBxL9yYLU',
    stripe_payment_link: 'https://buy.stripe.com/9B66oJ1uz7dHabA1MgaIM0e',
    stripe_mode: 'payment',
    tier: 'pro',
    features: [
      '2,000 generations (one-time)',
      'All Pro modes',
      'White-label ready',
      'API access (1,000 calls/mo)',
      'Ed25519-signed on AuthiChain',
    ],
    cta: 'Buy Studio Pack',
  },
  {
    id: 'business',
    name: 'Business',
    price: 49,
    price_suffix: '/month',
    description: 'Unlimited generations for growing teams',
    generations: 0,
    stripe_price_id: 'price_1TGOMCGqTruSqV8TpQsP9KY3',
    stripe_payment_link: 'https://buy.stripe.com/bJeeVf7SXapTdnMez2aIM0f',
    stripe_mode: 'subscription',
    tier: 'enterprise',
    features: [
      'Unlimited generations',
      'All modes including Enterprise',
      'API access (1,000 calls/mo)',
      'AuthiChain verification dashboard',
      '5 team seats',
      'Priority support',
    ],
    cta: 'Start Business Plan',
  },
];

// Credit grants per plan (added to generations_limit on purchase)
export const PLAN_CREDITS: Record<PlanId, number> = {
  free: 0,
  starter: 100,
  creator: 500,
  studio: 2000,
  business: 999999, // effectively unlimited
};

// Tier granted per plan
export const PLAN_TIER: Record<PlanId, 'free' | 'pro' | 'enterprise'> = {
  free: 'free',
  starter: 'pro',
  creator: 'pro',
  studio: 'pro',
  business: 'enterprise',
};
