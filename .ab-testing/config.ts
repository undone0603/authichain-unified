/**
 * .ab-testing/config.ts
 *
 * Global A/B testing configuration for AuthiChain.
 * Define test parameters, email templates, LinkedIn hooks, pricing strategies here.
 */

export interface AbTestConfig {
  name: string;
  description: string;
  type: 'email' | 'linkedin' | 'pricing' | 'multi';
  hypothesis: string;
  primaryMetric: string;
  sampleSizePerVariant: number;
  durationDays?: number;
  segments?: string[]; // 'gov', 'enterprise', 'smb', 'luxury'
  excludeSegments?: string[];
}

/**
 * Active A/B Tests
 * Update this config as new tests start
 */
export const activeTests: Record<string, AbTestConfig> = {
  email_subject_lines: {
    name: 'Email Subject Lines A/B',
    description: 'Professional vs. ROI-focused email subject lines',
    type: 'email',
    hypothesis:
      'Conversational, ROI-focused subject lines (e.g., "Your $2M Opportunity") drive 15% higher open rates than professional subject lines (e.g., "Proposal: Blockchain Authentication")',
    primaryMetric: 'conversion_rate',
    sampleSizePerVariant: 100,
    durationDays: 30,
    segments: ['enterprise', 'gov'],
  },

  linkedin_angles: {
    name: 'LinkedIn Post Angles',
    description: 'Technical focus vs. storytelling customer success',
    type: 'linkedin',
    hypothesis:
      'Customer success storytelling drives 30% higher engagement than technical deep-dives',
    primaryMetric: 'engagement_rate',
    sampleSizePerVariant: 50,
    durationDays: 14,
    excludeSegments: [],
  },

  pricing_tiers: {
    name: 'Pricing Strategy: Standard vs. Charm',
    description: 'Round numbers vs. psychological pricing ($X.99)',
    type: 'pricing',
    hypothesis:
      'Charm pricing ($24, $179, $899) increases conversion rate by 8% vs. standard pricing ($29, $199, $999)',
    primaryMetric: 'conversion_rate',
    sampleSizePerVariant: 150,
    durationDays: 30,
    excludeSegments: [],
  },
};

/**
 * Email Template Metadata
 * Used by email sending system to select variant templates
 */
export const emailTemplateMetadata = {
  proposal_a: {
    name: 'Professional Blockchain Proposal',
    variant: 'A',
    tone: 'formal',
    focus: 'technical_benefits',
    openRateTarget: 0.25, // 25%
    clickRateTarget: 0.05, // 5%
  },
  proposal_b: {
    name: 'ROI-Focused $2M Opportunity',
    variant: 'B',
    tone: 'conversational',
    focus: 'roi_social_proof',
    openRateTarget: 0.35, // 35% (target improvement)
    clickRateTarget: 0.12, // 12% (target improvement)
  },
};

/**
 * LinkedIn Content Metadata
 * Used when scheduling posts via workflows
 */
export const linkedinContentMetadata = {
  post_a: {
    angle: 'technical',
    focus: 'blockchain_security',
    hashtags: [
      '#BlockchainAuthentication',
      '#SupplyChain',
      '#Enterprise',
      '#CyberSecurity',
    ],
    targetAudience: 'CTOs, security leads, compliance officers',
    engagementTarget: 0.05, // 5% target engagement rate
  },
  post_b: {
    angle: 'storytelling',
    focus: 'customer_success',
    hashtags: ['#SupplyChain', '#Authentication', '#RealResults'],
    targetAudience: 'Decision-makers, business leaders, ops directors',
    engagementTarget: 0.07, // 7% target engagement rate
  },
};

/**
 * Pricing Tier Variants
 * Switch between these based on test variant assignment
 */
export const pricingTierVariants = {
  standard: {
    name: 'Standard Pricing',
    strategy: 'round_numbers',
    tiers: {
      starter: { price: 29, annual: 290 },
      pro: { price: 199, annual: 1990 },
      enterprise: { price: 999, annual: 9990 },
    },
    conversionTarget: 0.08, // 8%
  },
  charm: {
    name: 'Charm Pricing',
    strategy: 'psychological',
    tiers: {
      starter: { price: 24, annual: 240 },
      pro: { price: 179, annual: 1790 },
      enterprise: { price: 899, annual: 8990 },
    },
    conversionTarget: 0.10, // 10% (expected lift from charm pricing)
  },
};

/**
 * Statistical Significance Thresholds
 * Standard A/B testing parameters
 */
export const statisticalConfig = {
  minSamplePerVariant: 30, // Minimum before declaring winner
  significanceLevel: 0.05, // p-value threshold (95% confidence)
  powerLevel: 0.80, // Statistical power (80%)
  minimumDetectableEffect: 0.05, // 5% minimum difference to detect
};

/**
 * Test Scheduling & Rollout
 */
export const rolloutConfig = {
  // When should tests automatically stop?
  autoStopCriteria: {
    minDaysElapsed: 7,
    maxDaysElapsed: 60,
    minSamplePerVariant: 30,
    pValueThreshold: 0.05,
  },

  // How to handle winner rollout
  winnerRollout: {
    gradual: false, // Gradually shift traffic vs. immediate full rollout
    gradualDurationDays: 7, // If gradual, over how many days
    notifyStakeholders: true,
    updateEmailTemplateDefault: true,
    updatePricingPageDefault: true,
  },
};

/**
 * Integration Hooks
 * These are called when variants are assigned, results tracked, etc.
 */
export const integrationHooks = {
  onVariantAssigned: async (leadId: number, variant: 'A' | 'B', testId: number) => {
    // Log to analytics / data warehouse
    console.log(`Lead ${leadId} assigned to variant ${variant} for test ${testId}`);
  },

  onResultsTracked: async (leadId: number, testId: number, metrics: Record<string, any>) => {
    // Send to analytics platform (Mixpanel, Amplitude, etc.)
    console.log(`Results tracked for lead ${leadId}: ${JSON.stringify(metrics)}`);
  },

  onWinnerDeclared: async (testId: number, winner: 'A' | 'B', pValue: number) => {
    // Notify team, trigger rollout automation
    console.log(`🎉 Test ${testId} winner: Variant ${winner} (p=${pValue})`);
    // Could send Slack message, create task, etc.
  },
};

/**
 * Segment Definitions
 * Used to target tests to specific customer groups
 */
export const segmentDefinitions = {
  gov: {
    description: 'Government agencies (DoD, DHS, FDA, USDA)',
    nadicsFilter: ['541511', '541512', '334111'],
    estimatedSize: 50,
  },
  enterprise: {
    description: 'Enterprise manufacturing, supply chain',
    revenueCriteria: '$10M+',
    estimatedSize: 150,
  },
  smb: {
    description: 'Small & medium business',
    revenueCriteria: '$100K–$10M',
    estimatedSize: 400,
  },
  luxury: {
    description: 'Luxury brands, premium manufacturers',
    industryFilter: ['luxury', 'premium', 'designer'],
    estimatedSize: 58,
  },
};

/**
 * Reporting Configuration
 */
export const reportingConfig = {
  recipientEmails: ['analytics@authichain.io', 'product@authichain.io'],
  reportFrequency: 'weekly', // 'daily', 'weekly', 'on-demand'
  reportDay: 'monday', // 'monday', 'friday', etc.
  reportTime: '09:00 UTC',
  slackChannel: '#ab-testing-reports',
  includeMetrics: [
    'conversion_rate',
    'email_open_rate',
    'email_click_rate',
    'linkedin_engagement',
    'average_deal_size',
    'revenue_per_variant',
    'statistical_significance',
  ],
};

export default {
  activeTests,
  emailTemplateMetadata,
  linkedinContentMetadata,
  pricingTierVariants,
  statisticalConfig,
  rolloutConfig,
  integrationHooks,
  segmentDefinitions,
  reportingConfig,
};
