# A/B Testing Integration Checklist

Complete these steps to activate A/B testing across email, LinkedIn, and pricing channels.

---

## 1. Database Setup ✅

- [ ] Run migration: `drizzle migrate` (runs `015_ab_testing_infrastructure.sql`)
  - Creates: `ab_tests`, `ab_test_results`, `ab_test_variants`, `daily_ab_test_metrics`
  - Adds columns to `leads`: `ab_variant`, `ab_test_id`, `pricing_tier_assigned`, etc.

- [ ] Verify tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE 'ab_%';
  ```

---

## 2. Schema Integration ✅

- [ ] Check `/src/db/schema.ts` for new tables:
  - `abTests`, `abTestResults`, `abTestVariants`, `dailyAbTestMetrics`
  - Updated `leads` with AB test columns

- [ ] Verify TypeScript types compile:
  ```bash
  pnpm check
  ```

---

## 3. Create First Test ✅

Create via Supabase console or script:

```bash
# Supabase console (easiest for first test):
INSERT INTO ab_tests (name, description, type, status, hypothesis, hypothesis_type)
VALUES (
  'Email Subject Lines',
  'Test professional vs. ROI-focused email subject lines',
  'email',
  'draft',
  'ROI-focused subject lines drive 15% higher open rates',
  'email'
);
```

Note the returned `id` (let's say it's `1`).

---

## 4. Seed Email Templates ✅

```bash
pnpm exec ts-node scripts/email-templates-ab.ts 1
```

Populates `ab_test_variants` with:
- Variant A: Professional proposal email
- Variant B: ROI-focused $2M opportunity email

---

## 5. Seed LinkedIn & Pricing (Optional) ✅

```bash
# LinkedIn post variants
pnpm exec ts-node scripts/linkedin-pricing-variants.ts 1 linkedin

# Pricing tier variants
pnpm exec ts-node scripts/linkedin-pricing-variants.ts 1 pricing
```

---

## 6. Assign Variants to Leads ✅

```bash
# Email variants to 500 unassigned leads
pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --limit 500 --email

# Optional: pricing variants
pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --limit 500 --pricing

# Optional: LinkedIn variants
pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --limit 500 --linkedin
```

This randomly assigns each lead to Variant A or B (50/50) and logs to `ab_test_results`.

---

## 7. Email Campaign Integration 🔧

When your email campaign system sends emails:

```typescript
// In your email sending function (e.g., server/routes/email.ts)

import { db } from '../db';
import { leads } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

async function sendProposalEmail(leadId: number) {
  // Get lead + their assigned variant
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });

  if (!lead.ab_variant || !lead.ab_test_id) {
    // No A/B test assigned, use default template
    return sendDefaultEmail(lead);
  }

  // Fetch variant-specific template
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('*')
    .eq('ab_test_id', lead.ab_test_id)
    .eq('variant_name', lead.ab_variant)
    .eq('variant_type', 'email')
    .single();

  if (!variant) {
    return sendDefaultEmail(lead);
  }

  // Replace placeholders
  const subject = variant.subject
    .replace('{{name}}', lead.name || '')
    .replace('{{company}}', lead.company || '')
    .replace('{{industry}}', lead.industry || '');

  const htmlContent = variant.html_content
    .replace('{{name}}', lead.name || '')
    .replace('{{company}}', lead.company || '')
    .replace('{{industry}}', lead.industry || '');

  // Send email via Resend
  const { error } = await resend.emails.send({
    to: lead.email,
    subject,
    html: htmlContent,
    // Add tracking pixel for email_open tracking
    replyTo: 'noreply@authichain.io',
  });

  if (!error) {
    // Log email sent
    await supabase
      .from('ab_test_results')
      .update({
        email_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .eq('ab_test_id', lead.ab_test_id);
  }

  return error;
}
```

---

## 8. Email Open/Click Tracking 🔧

Update your email tracking webhooks (Resend, SendGrid, etc.):

```typescript
// In your email webhook handler (e.g., server/routes/webhooks/email.ts)

import { createClient } from '@supabase/supabase-js';

async function handleEmailOpened(leadEmail: string) {
  const supabase = createClient(...);

  // Find lead by email
  const { data: lead } = await supabase
    .from('leads')
    .select('id, ab_test_id')
    .eq('email', leadEmail)
    .single();

  if (lead?.ab_test_id) {
    // Update ab_test_results
    await supabase
      .from('ab_test_results')
      .update({
        email_opened: true,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', lead.id)
      .eq('ab_test_id', lead.ab_test_id);

    // Also update lead
    await supabase
      .from('leads')
      .update({ email_opened: true })
      .eq('id', lead.id);
  }
}

async function handleEmailClicked(leadEmail: string) {
  const supabase = createClient(...);
  const { data: lead } = await supabase
    .from('leads')
    .select('id, ab_test_id')
    .eq('email', leadEmail)
    .single();

  if (lead?.ab_test_id) {
    await supabase
      .from('ab_test_results')
      .update({
        email_clicked: true,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', lead.id)
      .eq('ab_test_id', lead.ab_test_id);

    await supabase
      .from('leads')
      .update({ email_clicked: true })
      .eq('id', lead.id);
  }
}
```

---

## 9. LinkedIn Post Integration 🔧

When scheduling LinkedIn posts (via `workers/linkedin-autopilot/`):

```typescript
// In LinkedIn posting worker

import { createClient } from '@supabase/supabase-js';
import { linkedinVariants } from '../scripts/linkedin-pricing-variants';

async function postLinkedInVariant(variant: 'A' | 'B', testId: number) {
  const supabase = createClient(...);

  // Get variant text
  const variantConfig = linkedinVariants[`post_${variant.toLowerCase()}`];
  const postText = variantConfig.text;
  const hashtags = variantConfig.hashtags.join(' ');

  // Post to LinkedIn API
  const postData = await linkedinAPI.createPost({
    text: `${postText}\n\n${hashtags}`,
  });

  // Log to ab_test_variants for tracking
  // (LinkedIn engagement updates come from webhook)

  return postData;
}
```

Track LinkedIn engagement via webhook:

```typescript
// LinkedIn engagement webhook (update impressions, likes, comments, shares)

async function handleLinkedInEngagement(postId: string, metrics: any) {
  const supabase = createClient(...);

  // Find test results associated with this post
  const { data: results } = await supabase
    .from('ab_test_results')
    .select('*')
    .ilike('metadata', `%"linkedin_post_id":"${postId}"%`);

  for (const result of results) {
    await supabase
      .from('ab_test_results')
      .update({
        linkedin_impression: metrics.impressions || result.linkedin_impression,
        linkedin_like: metrics.likes || result.linkedin_like,
        linkedin_comment: metrics.comments || result.linkedin_comment,
        linkedin_share: metrics.shares || result.linkedin_share,
        updated_at: new Date().toISOString(),
      })
      .eq('id', result.id);
  }
}
```

---

## 10. Pricing Page Integration 🔧

When rendering pricing page:

```typescript
// In pricing page component (e.g., src/components/Pricing.tsx)

import { createClient } from '@supabase/supabase-js';
import { pricingVariants } from '../scripts/linkedin-pricing-variants';

export async function getPricingTiers(leadId?: number) {
  if (!leadId) {
    // No lead context, use default (Variant A)
    return pricingVariants.pricing_a.tiers;
  }

  const supabase = createClient(...);
  const { data: lead } = await supabase
    .from('leads')
    .select('ab_variant, ab_test_id')
    .eq('id', leadId)
    .single();

  if (!lead?.ab_test_id) {
    return pricingVariants.pricing_a.tiers;
  }

  // Get assigned variant
  const variant = lead.ab_variant; // 'A' or 'B'

  // Fetch pricing from ab_test_variants
  const { data: pricingVariant } = await supabase
    .from('ab_test_variants')
    .select('pricing_json')
    .eq('ab_test_id', lead.ab_test_id)
    .eq('variant_name', variant)
    .eq('variant_type', 'pricing')
    .single();

  return pricingVariant?.pricing_json || pricingVariants.pricing_a.tiers;
}
```

On pricing selection / purchase:

```typescript
// When user selects or purchases a plan

async function recordPricingAction(leadId: number, action: 'viewed' | 'selected' | 'purchased', tierName: string, amount?: number) {
  const supabase = createClient(...);

  const { data: lead } = await supabase
    .from('leads')
    .select('ab_test_id')
    .eq('id', leadId)
    .single();

  if (!lead?.ab_test_id) return;

  if (action === 'viewed') {
    await supabase
      .from('ab_test_results')
      .update({
        pricing_viewed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .eq('ab_test_id', lead.ab_test_id);
  }

  if (action === 'selected') {
    await supabase
      .from('ab_test_results')
      .update({
        pricing_selected: tierName,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .eq('ab_test_id', lead.ab_test_id);
  }

  if (action === 'purchased') {
    await supabase
      .from('ab_test_results')
      .update({
        pricing_purchased: true,
        deal_converted: true,
        deal_size: amount,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .eq('ab_test_id', lead.ab_test_id);

    // Also update lead status
    await supabase
      .from('leads')
      .update({
        status: 'converted',
        roiSavings: amount,
        contractSigned: true,
      })
      .eq('id', leadId);
  }
}
```

---

## 11. Generate Results Report ✅

Once you have at least 30 participants per variant:

```bash
# Text report
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1

# JSON export
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --format json

# CSV export
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --format csv --export report.csv
```

Sample output shows:
- Conversion rates per variant
- Statistical significance (p-value)
- Email/LinkedIn metrics
- Winner recommendation

---

## 12. Scale the Winner (Once p < 0.05) ✅

Once variant B wins:

```bash
# Create new test for rollout
INSERT INTO ab_tests (name, status, hypothesis_type)
VALUES ('Email Variant B Rollout', 'running', 'email');

# Get the new test ID (let's say it's 2)
# Assign all NEW leads to Variant B
pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 2 --limit 1000 --email

# Update email system to always use Variant B template
# Stop using Variant A
```

---

## 13. Monitor & Iterate ✅

- [ ] Generate weekly reports:
  ```bash
  pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --export report-week-$(date +%Y%m%d).csv
  ```

- [ ] Set up automated reporting (optional):
  - Deploy report script to a scheduled worker
  - Email results to stakeholders weekly

- [ ] Plan next test while current test runs:
  - Test email templates + LinkedIn angles together (multi-variant)
  - Test CTA button color
  - Test pricing with volume discounts

---

## 14. Documentation ✅

- [ ] Team knows about `/docs/ab-testing-guide.md`
- [ ] Link to guide from internal wiki
- [ ] Share report format and interpretation
- [ ] Define decision process: "We declare winner when p < 0.05 and n > 30 per variant"

---

## Troubleshooting

**No variants showing in report:**
- Check `ab_test_variants` table is populated
- Verify `ab_test_id` and `variant_name` match in seed script

**Leads not assigned to tests:**
- Run: `SELECT COUNT(*) FROM leads WHERE ab_variant IS NULL LIMIT 10;`
- Check `assign-ab-variant.ts` ran without error

**Email metrics not tracking:**
- Verify webhook receiver is active (Resend, SendGrid, etc.)
- Check `ab_test_results` table for records

**Statistical significance showing as N/A:**
- Need at least 30 results per variant
- Chi-squared test requires sufficient sample size

---

## Success Metrics

After 2 weeks of testing:
- [ ] 100+ participants per variant
- [ ] p-value showing significant difference (p < 0.05)
- [ ] Clear winner identified (A or B)
- [ ] Revenue impact quantified ($XXk opportunity)
- [ ] Plan to scale winner documented

---

## Next Steps After This Checklist

1. **Run first test** (email subject lines) → Get results in 2 weeks
2. **Launch second test** (LinkedIn angles) → Parallel to email scaling
3. **Test pricing variants** → Measure conversion rate + revenue impact
4. **Multi-variant tests** → Email + pricing together
5. **Continuous optimization** → New test every 4 weeks

---

## Questions?

- Schema: `/src/db/schema.ts`
- Guide: `/docs/ab-testing-guide.md`
- Config: `/.ab-testing/config.ts`
- Scripts: `/scripts/assign-ab-variant.ts`, `ab-test-report.ts`, etc.

🚀 You're ready to start testing and scaling!
