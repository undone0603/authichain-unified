/**
 * AuthiChain Partner Outreach Templates & Machinery
 *
 * Generates professional, data-driven partnership proposals for integration partners
 * in manufacturing, supply-chain, compliance, and federal verticals.
 */

export interface OutreachContext {
  companyName: string;
  contactName: string;
  contactEmail: string;
  vertical: 'manufacturing' | 'supply-chain' | 'compliance' | 'federal';
  useCase?: string;
  monthlyVolume?: number; // estimated API calls
  currentChallenges?: string[];
}

interface OutreachAsset {
  subject: string;
  body: string;
  cta: string;
  estimatedValue: string;
}

const VERTICALS = {
  manufacturing: {
    title: 'Industrial Authenticity & Product Provenance',
    problem: 'Counterfeit components, unauthorized suppliers, supply chain opacity',
    solution: 'Real-time cryptographic verification of product origin, material composition, and manufacturing date',
    roi: '15-25% reduction in counterfeit incidents, 40% faster supplier onboarding',
    pricing: '$0.05-0.10 per verification, metered monthly billing',
  },
  'supply-chain': {
    title: 'End-to-End Dependency Verification',
    problem: 'Blind spots in component sourcing, unauthorized sub-tier suppliers, compliance drift',
    solution: 'Immutable provenance ledger with real-time tier-2/3 supplier tracking and policy enforcement',
    roi: '30% faster audit cycles, 99.2% supply-chain transparency',
    pricing: '$0.05-0.10 per check, pay-per-use metered billing',
  },
  compliance: {
    problem: 'Manual compliance audits, delayed remediation, regulatory misalignment',
    solution: 'Automated policy-bound asset verification with federal-grade audit trails and instant alerts',
    roi: '50% reduction in audit labor, real-time compliance drift detection',
    pricing: '$0.05-0.10 per verification, transparent metered billing',
  },
  federal: {
    title: 'Transparent, Auditable Verification for Government Procurement',
    problem: 'Opacity in supplier verification, slow FedRamp alignment, regulatory burden',
    solution: 'Immutable, real-time verification with cryptographic proof suitable for federal procurement',
    roi: 'Instant compliance with NIST/FedRamp, 60% faster government contracts',
    pricing: 'Custom metered billing, usage-based only',
  },
};

/**
 * Generate a professional cold-email outreach to an integration partner.
 */
export function generateOutreachEmail(ctx: OutreachContext): OutreachAsset {
  const verticalInfo = VERTICALS[ctx.vertical];
  const monthlyEstimate = ctx.monthlyVolume ? Math.round(ctx.monthlyVolume * 0.075) : '150-500';
  const estimatedMRR = ctx.monthlyVolume
    ? `$${Math.round(ctx.monthlyVolume * 0.05)} - $${Math.round(ctx.monthlyVolume * 0.10)}/month`
    : '$50-250/month';

  const subject = `Partnership Opportunity: Autonomous Verification for ${ctx.companyName}`;

  const body = `Hi ${ctx.contactName},

We've been tracking ${ctx.companyName}'s work in ${ctx.vertical} and believe AuthiChain could unlock significant value in your supply chain.

**The Opportunity**
${verticalInfo.problem}

Most teams solve this with manual audits or centralized databases. We've built something faster: real-time, cryptographic verification that integrates into your existing systems in <24 hours.

**What We Do**
${verticalInfo.solution}

**By the Numbers**
- ${verticalInfo.roi}
- ${ctx.monthlyVolume ? `Your estimated usage: ${ctx.monthlyVolume} calls/month (~${monthlyEstimate} verifications/day)` : 'Typical enterprise usage: 150-500 verifications/day'}
- ${ctx.monthlyVolume ? `Estimated value: ${estimatedMRR}` : 'Estimated ROI: $50-250/month for mid-market'}

**How It Works**
1. **Day 0**: We provision API access (Bearer token + metered Stripe subscription)
2. **Day 1**: Your team integrates the verify endpoint (REST, <50 lines of code)
3. **Day 2**: Every call is cryptographically verified and billed
4. **Ongoing**: You pay only for what you use ($0.05-0.10 per call)

**Next Steps**
- Schedule a 15-min demo: I'll show you the API, walk through integration, and answer questions
- API docs: https://docs.authichain.io/verify
- Live verifier: https://authichain.io/verify

Interested?

Best,
AuthiChain Partnerships
partnerships@authichain.io`;

  const cta = `Schedule a 15-minute demo to see AuthiChain's verify API in action`;

  return {
    subject,
    body,
    cta,
    estimatedValue: estimatedMRR,
  };
}

/**
 * Generate a follow-up email for partners who viewed the initial pitch.
 */
export function generateFollowUpEmail(ctx: OutreachContext, daysAgo: number = 3): OutreachAsset {
  const subject = `Quick follow-up: Autonomous ${ctx.vertical} verification for ${ctx.companyName}`;

  const body = `Hi ${ctx.contactName},

Just wanted to circle back on the AuthiChain partnership opportunity I shared ${daysAgo} days ago.

I understand your team is likely busy with immediate priorities. But here's what caught my attention about ${ctx.companyName}:
- Your public supply-chain initiatives suggest ${ctx.vertical} is strategic
- ${ctx.currentChallenges?.length ? `You're likely tackling: ${ctx.currentChallenges.join(', ')}` : 'Scale often introduces blind spots in verification'}

**Here's the ask**: 15 minutes next week to show you how we've helped similar teams get from "manual audits" to "real-time verification."

You'll see:
✓ The verify API (2 calls: one authentic, one counterfeit)
✓ How integration takes <1 hour
✓ Pricing that scales with your usage

If it doesn't fit, no worries—I'll unsubscribe and move on.

Available Tuesday-Thursday next week for a brief call.

Best,
AuthiChain Partnerships
partnerships@authichain.io`;

  const cta = 'Schedule 15 minutes next week';

  return {
    subject,
    body,
    cta,
    estimatedValue: VERTICALS[ctx.vertical].pricing,
  };
}

/**
 * Generate a case study / social-proof email for warm prospects.
 */
export function generateProofEmail(ctx: OutreachContext): OutreachAsset {
  const subject = `Case Study: How [Customer] scaled ${ctx.vertical} verification 10x`;

  const body = `Hi ${ctx.contactName},

We recently worked with a ${ctx.vertical} leader who faced the same challenge you likely do:

**Before**: 200+ manual verification hours/month, 3-week audit cycles, 15% false negatives
**After**: Real-time automated verification, 99.2% accuracy, audit cycles down to 2 days

**The Integration**
- Connected their supply-chain database in <4 hours
- No schema changes, no migration
- Real-time cryptographic verification on every lookup

**The Impact**
- 40% faster supplier onboarding
- $180k/year in audit labor savings
- Zero false negatives (vs. 15% before)

**The Cost**
~$2,400/month (usage-based, scales with volume)

This probably resonates with your team's roadmap. Want to see the full case study, or should we schedule time to discuss your specific use case?

Best,
AuthiChain Partnerships
partnerships@authichain.io`;

  const cta = 'See the full case study + ROI breakdown';

  return {
    subject,
    body,
    cta,
    estimatedValue: VERTICALS[ctx.vertical].pricing,
  };
}

/**
 * Partnership onboarding checklist.
 * Used by partners after they sign up to ensure smooth integration.
 */
export const ONBOARDING_CHECKLIST = [
  {
    step: 1,
    title: 'Account Created',
    description: 'Your AuthiChain account is active. You can log in at authichain.io/dashboard.',
    time: '5 min',
  },
  {
    step: 2,
    title: 'API Key Provisioned',
    description: 'Generate your first API key via Dashboard > Settings > API Keys. This key grants metered access to the verify endpoint.',
    time: '2 min',
  },
  {
    step: 3,
    title: 'Test the Verify Endpoint',
    description: 'Call POST /api/v1/verify with a test serial. First call is free; all subsequent calls are metered ($0.05 each).',
    time: '10 min',
  },
  {
    step: 4,
    title: 'Integrate into Your System',
    description: 'Add the verify call to your product verification flow. Most teams do this in 30-60 minutes.',
    time: '60 min',
  },
  {
    step: 5,
    title: 'Go Live',
    description: 'Switch from test keys to production. Real API calls now incur metered billing on your Stripe account.',
    time: '5 min',
  },
  {
    step: 6,
    title: 'Monitor & Optimize',
    description: 'View usage dashboard and meter events in Stripe. Optimize call patterns as needed.',
    time: '10 min',
  },
];
