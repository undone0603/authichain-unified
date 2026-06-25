# A/B Testing Infrastructure Guide

## Overview

AuthiChain has a comprehensive A/B testing system to maximize conversion across proposals, email templates, LinkedIn posts, and pricing tiers. With 258 proposals and 1k+ LinkedIn followers, testing can increase conversion by 10–50%.

---

## Architecture

### Database Schema

**Core Tables:**
- `ab_tests` — Test metadata (name, hypothesis, variants, status, winner)
- `ab_test_results` — Per-lead tracking (conversions, email metrics, LinkedIn metrics)
- `ab_test_variants` — Template variants (email HTML, LinkedIn text, pricing JSON)
- `daily_ab_test_metrics` — Aggregated daily performance
- `leads` — Enhanced with `ab_variant`, `ab_test_id`, pricing/email/LinkedIn assignments

### Key Columns on `leads`
- `ab_variant` — 'A' or 'B' (random 50/50 assignment)
- `ab_test_id` — Foreign key to test
- `pricing_tier_assigned` — Pricing variant assigned
- `email_variant_assigned` — Email template variant
- `linkedin_variant_assigned` — LinkedIn post variant

---

## Quick Start

### 1. Create a Test

```bash
# Insert test metadata
INSERT INTO ab_tests (name, description, type, status, hypothesis, hypothesis_type, metric_type)
VALUES (
  'Email Subject Lines A/B',
  'Professional vs. ROI-focused subject lines',
  'email',
  'draft',
  'Conversational subject lines drive 15% higher open rates than professional ones',
  'email',
  'conversion_rate'
);
```

Note the returned `id` (e.g., `1`).

### 2. Seed Email Templates

```bash
pnpm exec ts-node scripts/email-templates-ab.ts 1
```

This populates `ab_test_variants` with:
- **Variant A**: "Proposal: Blockchain Authentication for {{company}}" (professional)
- **Variant B**: "Your $2M Opportunity: Blockchain Authentication" (ROI-focused)

### 3. Seed LinkedIn & Pricing Variants (Optional)

```bash
pnpm exec ts-node scripts/linkedin-pricing-variants.ts 1 linkedin
pnpm exec ts-node scripts/linkedin-pricing-variants.ts 1 pricing
```

### 4. Assign Variants to Leads

```bash
# Assign email variants to 500 unassigned leads
pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --limit 500 --email

# Assign pricing variants to 500 leads
pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --limit 500 --pricing

# Assign LinkedIn post variants
pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --limit 500 --linkedin
```

Each lead is randomly assigned to either Variant A or B (50/50 split).

### 5. Track Results

As campaigns run:
- Email campaigns send variant-specific templates based on `lead.email_variant_assigned`
- Email metrics update: `email_sent`, `email_opened`, `email_clicked`, `email_replied`
- LinkedIn engagement is tracked: impressions, likes, comments, shares
- Pricing shows assigned tier; if lead converts, `deal_converted=true` and `deal_size` is recorded

### 6. Generate Report

```bash
# Text report (default)
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1

# JSON export
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --format json

# CSV export
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --format csv --export report.csv
```

**Sample Output:**
```
═══════════════════════════════════════════════════════════════════════════
VARIANT A vs VARIANT B
═══════════════════════════════════════════════════════════════════════════

📊 CONVERSION RATE (Primary Metric)
   Variant A: 8.34% (25/300)
   Variant B: 12.67% (38/300)
   Difference: 4.33%

📈 STATISTICAL SIGNIFICANCE
   p-value: 0.0234
   Confidence: 95%
   Status: ✅ SIGNIFICANT (p < 0.05)

💰 REVENUE METRICS
   Variant A: $145,000 total | $5,800 avg deal
   Variant B: $198,500 total | $5,224 avg deal

📧 EMAIL PERFORMANCE
   Variant A:
     • Open Rate: 28.5% (85/300)
     • Click Rate: 12.1% (36/300)
     • Reply Rate: 3.2% (10/300)
   Variant B:
     • Open Rate: 35.2% (105/300)
     • Click Rate: 18.9% (57/300)
     • Reply Rate: 5.7% (17/300)

═══════════════════════════════════════════════════════════════════════════
🎯 **Strong winner: Variant B** (4.33% difference). Ready to scale.
═══════════════════════════════════════════════════════════════════════════
```

---

## Email Template Variants

### Variant A: Professional / Technical

**Subject:** "Proposal: Blockchain Authentication for {{company}}"

**Tone:** Formal, feature-focused, technical benefits first.

**Key Elements:**
- Blockchain architecture details (ERC-721, Polygon network)
- Compliance features (SOC 2, ISO 27001)
- Implementation timeline
- CTA: "Schedule a Technical Demo"

**Best For:** CTOs, security leads, technical buyers.

### Variant B: Conversational / ROI-Focused

**Subject:** "Your $2M Opportunity: Blockchain Authentication for {{company}}"

**Tone:** Friendly, pain-point-driven, urgency + social proof.

**Key Elements:**
- $2–5M annual counterfeit loss (industry average)
- Real customer success story ($2.1M fraud prevented)
- Clear ROI breakdown
- CTA: "Let's Talk (15 min)"

**Best For:** Decision-makers, ops leaders, non-technical buyers.

### Template Placeholders

Use `{{name}}`, `{{company}}`, `{{industry}}` in both HTML and text versions. The email system replaces these at send time.

---

## LinkedIn Post Variants

### Variant A: Technical Focus

**Angle:** Blockchain security, compliance, audit trail.

**Key Hook:** "Immutable Verification — Every product sealed on the blockchain."

**Best For:** 
- LinkedIn audiences: CTOs, security professionals, compliance leaders
- Content calendar: Technical deep-dives
- Engagement: Comments from experts

### Variant B: Storytelling

**Angle:** Real customer win (hypothetical but realistic).

**Key Hook:** "A government agency prevented a $2.1M counterfeit procurement fraud in 60 days."

**Best For:**
- LinkedIn audiences: Decision-makers, business leaders
- Content calendar: Customer success stories
- Engagement: Shares, emotional resonance

### Running the Test

1. Schedule both posts at same time (different LinkedIn accounts or schedules)
2. Track engagement for 7 days:
   - Impressions (via LinkedIn Analytics)
   - Likes, comments, shares
3. Calculate engagement rate = (Likes + Comments + Shares) / Impressions
4. Report shows which angle drives higher engagement

---

## Pricing Tier Variants

### Variant A: Standard Pricing

**Strategy:** Round numbers, traditional tier structure.

| Tier       | A/Month | Features                             |
|------------|---------|--------------------------------------|
| Starter    | $29     | 100 QR/mo, basic auth, email support |
| Pro        | $199    | Unlimited QR, advanced auth, API     |
| Enterprise | $999    | Everything + SLA, white-label        |

### Variant B: Charm Pricing

**Strategy:** Psychological pricing ($X.99 effect), anchor lower tiers.

| Tier       | B/Month | Features                             |
|------------|---------|--------------------------------------|
| Starter    | $24     | 100 QR/mo, basic auth, email support |
| Pro        | $179    | Unlimited QR, advanced auth, API     |
| Enterprise | $899    | Everything + SLA, white-label        |

**Rationale:**
- Lower anchor ($24 vs $29) makes Pro tier seem more valuable
- Charm pricing ($179, $899) feels cheaper than round numbers
- May increase conversion 5–12% despite lower price

### Assigning Variants

1. Half of pricing page visitors → Variant A (standard)
2. Half of pricing page visitors → Variant B (charm)
3. Track which tier each lead selects and whether they convert
4. Report shows revenue impact per variant

---

## Advanced: Custom Email Variants

To create custom email templates:

```typescript
import { seedEmailTemplates } from './email-templates-ab';

export const customEmailTemplates = {
  proposal_c: {
    name: 'proposal_c',
    subject: 'Your custom subject',
    htmlContent: `...HTML...`,
    textContent: `...TEXT...`,
    description: 'Your variant description',
  },
};

// Seed to ab_test_variants table
async function seedCustomVariant(testId: number) {
  const supabase = createClient(...);
  await supabase.from('ab_test_variants').insert({
    ab_test_id: testId,
    variant_name: 'C',
    variant_type: 'email',
    template_name: 'proposal_c',
    subject: customEmailTemplates.proposal_c.subject,
    html_content: customEmailTemplates.proposal_c.htmlContent,
    text_content: customEmailTemplates.proposal_c.textContent,
    metadata: { description: customEmailTemplates.proposal_c.description },
  });
}
```

---

## Integration Points

### Email Campaign System

When sending emails, reference the variant:

```typescript
const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });

const emailTemplate = await supabase
  .from('ab_test_variants')
  .select('*')
  .eq('ab_test_id', lead.ab_test_id)
  .eq('variant_name', lead.ab_variant)
  .single();

// Send with variant
await resend.emails.send({
  subject: emailTemplate.subject.replace('{{company}}', lead.company),
  html: emailTemplate.html_content.replace('{{name}}', lead.name),
  // ...
});

// Log result
await supabase.from('ab_test_results').update({
  email_sent: true,
  email_sent_at: new Date(),
}).eq('lead_id', leadId);
```

### LinkedIn Posting

When posting, reference the variant:

```typescript
const variant = await supabase
  .from('ab_test_variants')
  .select('*')
  .eq('variant_type', 'linkedin_post')
  .eq('variant_name', assignedVariant) // 'A' or 'B'
  .single();

// Post with variant text + hashtags
const post = await linkedinAPI.createPost({
  text: variant.linkedin_text,
  // ...
});

// Track impressions/engagement
// (Usually updated via LinkedIn webhook)
```

### Checkout / Pricing Page

When user lands on pricing:

```typescript
const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });

// Get assigned pricing tier variant
const pricingVariant = await supabase
  .from('ab_test_variants')
  .select('pricing_json')
  .eq('ab_test_id', lead.ab_test_id)
  .eq('variant_name', lead.ab_variant) // 'A' or 'B'
  .single();

// Render tiers from pricingVariant.pricing_json
// User selects tier → log to ab_test_results.pricing_selected

if (userPurchases) {
  await supabase.from('ab_test_results').update({
    pricing_purchased: true,
    deal_converted: true,
    deal_size: totalAmount,
  }).eq('lead_id', leadId);
}
```

---

## Metrics & Interpretation

### Primary Metric: Conversion Rate

**Definition:** (Leads who became paying customers) / (Total leads in variant)

**Target:** Achieve >30 per variant for statistical significance.

**Interpretation:**
- 5%+ difference = meaningful (typically recommended to switch)
- 2–5% difference = monitor further (continue test)
- <2% difference = statistically unclear (likely no real difference)

### Secondary Metrics

| Metric                  | What It Means                                      |
|-------------------------|---------------------------------------------------|
| Email Open Rate         | How compelling the subject line is                |
| Email Click Rate        | How relevant the email body is                     |
| Email Reply Rate        | How engaging the CTA is                           |
| LinkedIn Engagement Rate| How much the post angle resonates                 |
| Average Deal Size       | Whether variant attracts different deal values    |
| Revenue Per Variant     | Total revenue generated (most important for ROI)  |

### Statistical Significance

The report uses Chi-squared test (1 degree of freedom):

- **p-value < 0.05** = 95% confidence the difference is real
- **p-value < 0.01** = 99% confidence
- **p-value > 0.05** = Difference likely due to randomness; keep testing

**When to stop:**
- 30+ participants per variant + p < 0.05 = **declare winner**
- 50+ participants + no significance = **likely no real difference** (end test)

---

## Common Pitfalls

### 1. **Peeking at Results Too Early**
Running report after 5 leads converted is premature. Minimum 30 per variant.

### 2. **Changing Variants Mid-Test**
Invalidates results. Run separate tests instead.

### 3. **Not Tracking All Interactions**
Missing email opens or LinkedIn engagement loses signal. Ensure tracking is complete.

### 4. **Confusing Correlation with Causation**
Variant B had higher conversions → was it the variant or external factors (seasonality, campaign timing, lead quality)?

**Solution:** Randomize assignment and run multiple tests.

### 5. **Declaring Winner Too Early**
4.33% difference with p=0.02 and only 50 leads = risky. Ideally 100+ per variant.

---

## Scaling a Winner

Once a winner is declared (p < 0.05, 30+ participants per variant):

1. **Create a new deployment**
   ```bash
   INSERT INTO ab_tests (name, status, hypothesis_type)
   VALUES ('Email Variant B Rollout', 'running', 'email');
   ```

2. **Assign all new leads to winning variant**
   ```bash
   pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 2 --email
   # (Script checks test type and always assigns 'B')
   ```

3. **Update email campaign templates**
   - Set default email template to Variant B
   - Stop sending Variant A

4. **Monitor conversion rate**
   - Should match historical Variant B rate
   - If it drops → investigate confounding factors

5. **Plan next test**
   - Now test Variant B vs Variant C
   - Iterate continuously

---

## Scripts Reference

### assign-ab-variant.ts

Randomly assigns leads to A or B, logs to `ab_test_results`.

```bash
pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --limit 500 --email --dry-run
```

**Options:**
- `--test-id` (required): Test ID
- `--limit` (optional): Max leads (default 100)
- `--email`: Assign email template variants
- `--linkedin`: Assign LinkedIn post variants
- `--pricing`: Assign pricing tier variants
- `--dry-run`: Preview without saving

### email-templates-ab.ts

Seeds two professional email templates (A & B) to `ab_test_variants`.

```bash
pnpm exec ts-node scripts/email-templates-ab.ts 1
```

### linkedin-pricing-variants.ts

Seeds LinkedIn post and pricing tier variants.

```bash
pnpm exec ts-node scripts/linkedin-pricing-variants.ts 1 linkedin
pnpm exec ts-node scripts/linkedin-pricing-variants.ts 1 pricing
```

### ab-test-report.ts

Generates comprehensive results report.

```bash
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --format text
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --format json > results.json
pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --format csv --export report.csv
```

---

## Expected Results

**Baseline (No Test):**
- Proposal email open rate: ~20–25%
- Click rate: ~4–6%
- Conversion rate: ~2–4%

**After Winning A/B Test (Typical):**
- Email variant: +8–15% open rate, +5–10% click rate
- LinkedIn variant: +20–40% engagement rate
- Pricing variant: +5–12% conversion rate, $50–150k additional ARR with 258 proposals

**3–6 Month Impact:**
- Testing 3–4 variables = 10–50% conversion lift
- Estimated ARR increase: $250k–$1M+ (at $5–20k ACV)

---

## Next Steps

1. ✅ Run `drizzle migrate` to deploy schema
2. ✅ Create first test via Supabase console
3. ✅ Run `scripts/email-templates-ab.ts` to seed templates
4. ✅ Assign variants: `scripts/assign-ab-variant.ts`
5. ✅ Integrate email/pricing/LinkedIn sending
6. ✅ Generate report weekly: `scripts/ab-test-report.ts`
7. ✅ Scale the winner when p < 0.05

---

## Questions?

Reference the schema at `/src/db/schema.ts` (tables: `abTests`, `abTestResults`, `abTestVariants`, `dailyAbTestMetrics`).

Good luck! 🚀
