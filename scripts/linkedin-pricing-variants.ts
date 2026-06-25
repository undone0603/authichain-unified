/**
 * scripts/linkedin-pricing-variants.ts
 *
 * LinkedIn post variants and pricing tier configs for A/B testing.
 *
 * LinkedIn Variants:
 *   A: Technical focus (blockchain security, compliance, audit trail)
 *   B: Storytelling (customer success story, emotional hook)
 *
 * Pricing Variants:
 *   A: Standard pricing ($29, $199, $999)
 *   B: Charm pricing ($24, $179, $899)
 */

import { createClient } from '@supabase/supabase-js';

export interface LinkedInVariant {
  name: string;
  text: string;
  imageUrl?: string;
  hashtags: string[];
  cta: string;
  description: string;
}

export interface PricingTier {
  name: string;
  price: number;
  features: string[];
}

export interface PricingVariant {
  name: string;
  tiers: Record<string, PricingTier>;
  description: string;
}

// ═════════════════════════════════════════════════════════════════════════
// LINKEDIN POST VARIANTS
// ═════════════════════════════════════════════════════════════════════════

export const linkedinVariants = {
  // VARIANT A: Technical / Security Focus
  post_a: {
    name: 'post_a',
    text: `🔐 **The Blockchain Authentication Breakthrough**

In a world of supply chain chaos, one tech is changing everything: **blockchain-backed product authentication**.

What makes this different?

✓ **Immutable Verification** — Every product sealed on the blockchain. No spoofing. No counterfeits.
✓ **Compliance First** — Audit trails that pass any regulatory scrutiny (SOC 2, ISO 27001, GDPR)
✓ **Zero-Trust Architecture** — Distributed ledger means no single point of failure
✓ **AI-Powered Scanning** — 99.2% accuracy in seconds

🏛️ **Real Impact**: Government agencies are already preventing $2M+ in procurement fraud per year using blockchain verification.

The companies adopting this NOW are locking in massive competitive advantage.

**The question isn't "if" — it's "when" will you implement it?**

#BlockchainAuthentication #SupplyChain #Enterprise #CyberSecurity #ProductVerification`,
    hashtags: [
      '#BlockchainAuthentication',
      '#SupplyChain',
      '#Enterprise',
      '#CyberSecurity',
      '#ProductVerification',
      '#Compliance',
      '#Innovation',
    ],
    cta: 'Learn More About Zero-Counterfeiting →',
    description: 'Technical angle: blockchain security, compliance, audit trail. Best for CTOs, security leads.',
  },

  // VARIANT B: Storytelling / ROI Focus
  post_b: {
    name: 'post_b',
    text: `📍 **A $2.1M Fraud Stopped in 60 Days**

A government agency was losing money to counterfeit parts. Vendors were gaming the system. No one could verify what was real.

Then they implemented blockchain-backed product verification.

**What happened in the first 60 days?**
- 🛑 Caught a $2.1M counterfeit procurement attempt
- ✅ Every supplier part now verifiable in seconds
- 🎯 Buyer confidence through the roof
- 💰 ROI in under 3 months

This isn't theoretical. This is happening *right now* across government, manufacturing, and luxury brands.

The gap between companies implementing this and those sleeping on it is growing every day. One group is preventing losses. The other is bleeding money.

**Which group will you be in?**

If your supply chain isn't verifiable, you're already losing.

#SupplyChain #Authentication #Government #Blockchain #RealResults`,
    hashtags: [
      '#SupplyChain',
      '#Authentication',
      '#Government',
      '#Blockchain',
      '#RealResults',
      '#ProductVerification',
      '#TrustMatters',
    ],
    cta: 'See How We Stopped $2.1M in Fraud →',
    description: 'Story angle: real customer win, pain-point relief, urgency. Best for decision-makers, ops.',
  },
};

// ═════════════════════════════════════════════════════════════════════════
// PRICING TIER VARIANTS
// ═════════════════════════════════════════════════════════════════════════

export const pricingVariants: Record<string, PricingVariant> = {
  // VARIANT A: Standard Pricing
  pricing_a: {
    name: 'pricing_a',
    description: 'Round numbers, standard pricing structure',
    tiers: {
      starter: {
        name: 'Starter',
        price: 29,
        features: [
          'Up to 100 QR codes/month',
          'AI visual authentication (basic)',
          'Email support',
          'Web dashboard',
          'Basic analytics',
        ],
      },
      pro: {
        name: 'Professional',
        price: 199,
        features: [
          'Unlimited QR codes',
          'AI visual authentication (advanced)',
          'Blockchain certificates (ERC-721)',
          'Priority support',
          'Advanced analytics',
          'Custom branding',
          'API access',
          'Integrations (Zapier, Make)',
        ],
      },
      enterprise: {
        name: 'Enterprise',
        price: 999,
        features: [
          'Everything in Pro',
          'Dedicated account manager',
          'Custom contract terms',
          'SLA guarantee (99.9%)',
          'White-label solution',
          'Multi-tenant support',
          'Custom integrations',
          'On-premise option',
          'Advanced compliance (HIPAA, FedRAMP)',
        ],
      },
    },
  },

  // VARIANT B: Charm Pricing (Psychological Pricing)
  pricing_b: {
    name: 'pricing_b',
    description: 'Charm pricing (.99 effect), anchoring on lower tiers',
    tiers: {
      starter: {
        name: 'Starter',
        price: 24,
        features: [
          'Up to 100 QR codes/month',
          'AI visual authentication (basic)',
          'Email support',
          'Web dashboard',
          'Basic analytics',
        ],
      },
      pro: {
        name: 'Professional',
        price: 179,
        features: [
          'Unlimited QR codes',
          'AI visual authentication (advanced)',
          'Blockchain certificates (ERC-721)',
          'Priority support',
          'Advanced analytics',
          'Custom branding',
          'API access',
          'Integrations (Zapier, Make)',
        ],
      },
      enterprise: {
        name: 'Enterprise',
        price: 899,
        features: [
          'Everything in Pro',
          'Dedicated account manager',
          'Custom contract terms',
          'SLA guarantee (99.9%)',
          'White-label solution',
          'Multi-tenant support',
          'Custom integrations',
          'On-premise option',
          'Advanced compliance (HIPAA, FedRAMP)',
        ],
      },
    },
  },
};

/**
 * Insert LinkedIn and pricing variants into ab_test_variants
 */
export async function seedLinkedInAndPricingVariants(testId: number, variantType: 'linkedin' | 'pricing' | 'all' = 'all') {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  console.log(`\n📊 Seeding variants for test #${testId}...`);

  const variants: any[] = [];

  // LinkedIn variants
  if (variantType === 'linkedin' || variantType === 'all') {
    console.log('   → LinkedIn posts');
    variants.push(
      {
        ab_test_id: testId,
        variant_name: 'A',
        variant_type: 'linkedin_post',
        template_name: linkedinVariants.post_a.name,
        linkedin_text: linkedinVariants.post_a.text,
        metadata: {
          hashtags: linkedinVariants.post_a.hashtags,
          cta: linkedinVariants.post_a.cta,
          angle: 'technical',
          description: linkedinVariants.post_a.description,
        },
      },
      {
        ab_test_id: testId,
        variant_name: 'B',
        variant_type: 'linkedin_post',
        template_name: linkedinVariants.post_b.name,
        linkedin_text: linkedinVariants.post_b.text,
        metadata: {
          hashtags: linkedinVariants.post_b.hashtags,
          cta: linkedinVariants.post_b.cta,
          angle: 'storytelling',
          description: linkedinVariants.post_b.description,
        },
      }
    );
  }

  // Pricing variants
  if (variantType === 'pricing' || variantType === 'all') {
    console.log('   → Pricing tiers');
    variants.push(
      {
        ab_test_id: testId,
        variant_name: 'A',
        variant_type: 'pricing',
        template_name: pricingVariants.pricing_a.name,
        pricing_json: pricingVariants.pricing_a.tiers,
        metadata: {
          strategy: 'standard',
          description: pricingVariants.pricing_a.description,
          prices: { starter: 29, pro: 199, enterprise: 999 },
        },
      },
      {
        ab_test_id: testId,
        variant_name: 'B',
        variant_type: 'pricing',
        template_name: pricingVariants.pricing_b.name,
        pricing_json: pricingVariants.pricing_b.tiers,
        metadata: {
          strategy: 'charm',
          description: pricingVariants.pricing_b.description,
          prices: { starter: 24, pro: 179, enterprise: 899 },
        },
      }
    );
  }

  if (variants.length === 0) {
    console.log('   No variants to seed');
    return;
  }

  const { error } = await supabase
    .from('ab_test_variants')
    .upsert(variants, { onConflict: 'ab_test_id,variant_name' });

  if (error) {
    console.error('❌ Failed to seed variants:', error);
    throw error;
  }

  console.log(`✅ Seeded ${variants.length} variant(s)`);
}

// CLI execution
if (require.main === module) {
  const testId = parseInt(process.argv[2], 10) || 1;
  const variantType = (process.argv[3] as 'linkedin' | 'pricing' | 'all') || 'all';
  seedLinkedInAndPricingVariants(testId, variantType).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

// Export for testing
export { linkedinVariants, pricingVariants };
