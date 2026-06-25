# Conversion Funnel Tracking - START HERE

## What You Got

A complete conversion funnel tracking system that answers: **Where do prospects drop off?**

You'll now see:
- How many emails were sent (proposal_sent)
- How many were opened (email_opened)
- How many clicked the link (link_clicked)
- How many visited your site (visit_landing_page)
- How many started checkout (start_checkout)
- How many completed purchase (complete_checkout)
- How many activated subscription (subscribe)

Plus:
- Drop-off rates at each stage
- Bottleneck identification (where to optimize)
- Comparison across sources (gov_engine vs linkedin_post vs seo)

## Files Overview

```
/supabase/migrations/00007_funnel_events.sql
  └─ Database schema for tracking

/src/app/api/funnel/route.ts
  └─ API endpoint to log events

/src/lib/funnel-tracking.ts
  └─ Helper functions (trackFunnelEvent, addFunnelParams, etc)

/src/components/FunnelTracker.tsx
  └─ React component - just drop it in your pages

/scripts/funnel-report.ts
  └─ CLI tool to generate reports
  └─ Run: pnpm tsx scripts/funnel-report.ts

/docs/
  ├─ FUNNEL_QUICKSTART.md        ← Read this first (5 min)
  ├─ funnel-tracking.md          ← Complete reference
  ├─ funnel-email-example.md     ← Email integration examples
  └─ ...

/FUNNEL_TRACKING_SUMMARY.md
  └─ Complete overview of entire system
```

## Quick Start (5 minutes)

### Step 1: Apply Database Migration
```bash
supabase db push
```

### Step 2: Test the API
```bash
curl -X POST http://localhost:3000/api/funnel \
  -H "Content-Type: application/json" \
  -d '{
    "prospect_id": "test_1",
    "stage": "proposal_sent",
    "source": "gov_engine"
  }'
```

### Step 3: Read the Setup Guide
```bash
# Open and read this file:
/docs/FUNNEL_QUICKSTART.md
```

### Step 4: Add to Your First Campaign
```typescript
import { addFunnelParams } from '@/lib/funnel-tracking';

// When sending emails, add params to link:
const prospectId = `prospect_${crypto.randomUUID()}`;
const link = addFunnelParams('https://govchain.us', {
  prospectId,
  source: 'gov_engine',
  medium: 'email',
  campaign: 'q3_opportunities'
});

// Then send email with that link
```

### Step 5: Add to Landing Pages
```tsx
// In your page component
import { FunnelTracker } from '@/components/FunnelTracker';

export default function Page() {
  return (
    <>
      <FunnelTracker />
      {/* Your content */}
    </>
  );
}
```

### Step 6: View Reports
```bash
# After you have some data:
pnpm tsx scripts/funnel-report.ts
```

## Expected Output

After 1 week of emails:

```
Source: GOV_ENGINE
Total Prospects: 258

Stage                    Count      Total %     Drop-off
proposal_sent            258        100.0 %     -
email_opened             23         8.9 %       91.1% ← FIX THIS
link_clicked             4          1.6 %       82.6%
visit_landing_page       1          0.4 %       75.0%
start_checkout           1          0.4 %       0.0%
complete_checkout        1          0.4 %       0.0%
subscribe                1          0.4 %       0.0%

BOTTLENECK: email_opened (91.1% drop-off)
Action: Review messaging, creative, or targeting at this stage.
```

**What this means:**
- Only 8.9% of emails are opened (too low - should be 15-25%)
- Of those who opened, 17.4% clicked (good)
- Of those who clicked, 25% landed on page (good)
- 100% who started checkout completed (excellent)
- **Priority:** Improve email subject line or sender reputation

## 7-Stage Funnel Explained

| Stage | What Happens | How to Track |
|-------|--------------|--------------|
| proposal_sent | Email sent to prospect | Log when email is sent |
| email_opened | Prospect opens email | 1x1 pixel in email |
| link_clicked | Prospect clicks link | Auto-tracked via FunnelTracker |
| visit_landing_page | Lands on govchain.us | FunnelTracker component |
| start_checkout | Starts payment form | Already in /api/checkout |
| complete_checkout | Stripe confirms payment | Add to webhook |
| subscribe | Subscription activated | Add to webhook |

## Integration Path

**This Week:**
1. Run `supabase db push`
2. Test `/api/funnel` endpoint
3. Read `docs/FUNNEL_QUICKSTART.md`
4. Add to first email campaign

**Next Week:**
1. Add email open pixel
2. Add `<FunnelTracker />` to pages
3. Update Stripe webhook
4. Run first report

**2 Weeks In:**
1. Identify bottleneck
2. Optimize (usually email subject line)
3. Re-run report
4. Measure improvement

## Key Metrics

What's good?
- **Email open rate:** 15-25% (if lower, test subject lines)
- **Click-through rate:** 10-20% (if lower, review CTA)
- **Landing page conversion:** 30-50% (if lower, improve page)
- **Checkout completion:** 50-80% (if lower, simplify form)

Your Example (from report above):
- Email open: 8.9% ❌ Too low - needs work
- Click-through: 17.4% ✓ Good
- Landing page: 25% ✓ Okay
- Checkout: 100% ✓ Perfect

## Common URL Pattern

When sending emails, URLs look like:
```
https://govchain.us/opportunities?prospect_id=prospect_abc123&utm_source=gov_engine&utm_medium=email&utm_campaign=q3_opportunities
```

Broken down:
- `prospect_id=prospect_abc123` - Unique prospect ID
- `utm_source=gov_engine` - Campaign source
- `utm_medium=email` - How they received it
- `utm_campaign=q3_opportunities` - Campaign name

Use `addFunnelParams()` to build these automatically.

## Documentation Structure

**For Quick Setup:**
1. `docs/FUNNEL_QUICKSTART.md` (5-minute guide)

**For Implementation:**
2. `docs/funnel-email-example.md` (email integration)
3. Read `/src/lib/funnel-tracking.ts` (code reference)

**For Complete Understanding:**
4. `docs/funnel-tracking.md` (complete reference)
5. `FUNNEL_TRACKING_SUMMARY.md` (architecture overview)

## Commands You'll Use

```bash
# Apply migration
supabase db push

# Test the API
curl http://localhost:3000/api/funnel

# View all sources, last 30 days
pnpm tsx scripts/funnel-report.ts

# View gov_engine only
pnpm tsx scripts/funnel-report.ts --source gov_engine

# View last 7 days
pnpm tsx scripts/funnel-report.ts --days 7

# View linkedin_post, last 7 days
pnpm tsx scripts/funnel-report.ts --source linkedin_post --days 7
```

## Example: Gov Engine Campaign

```typescript
// 1. Generate prospect ID
const prospectId = `prospect_${crypto.randomUUID()}`;

// 2. Build tracked link
const link = addFunnelParams('https://govchain.us/opportunities', {
  prospectId,
  source: 'gov_engine',
  medium: 'email',
  campaign: 'campaign_5'
});
// Result: https://govchain.us/opportunities?prospect_id=...&utm_source=gov_engine&utm_medium=email&utm_campaign=campaign_5

// 3. Send email
await sendEmail({
  to: prospect.email,
  subject: 'Government Contract Opportunities',
  body: `Click here: ${link}`
});

// 4. Log proposal sent
await trackFunnelEvent({
  prospectId,
  stage: 'proposal_sent',
  source: 'gov_engine',
  metadata: { campaign_id: 'campaign_5' }
});

// 5. User clicks link, lands on page
// FunnelTracker auto-logs visit_landing_page

// 6. User starts checkout
// /api/checkout auto-logs start_checkout

// 7. User completes payment
// Stripe webhook logs complete_checkout and subscribe
```

## Troubleshooting

**No data showing up?**
- Run: `supabase status` (verify migration applied)
- Check: Browser console for FunnelTracker errors
- Verify: URL has `prospect_id` and `utm_source` params

**Email not tracking?**
- Create: `/src/app/api/email/pixel/route.ts` (see email-example.md)
- Add to email: `<img src="...pixel?prospect_id=X&campaign=Y">`

**Low conversion rates?**
- Check: Email open rate (biggest bottleneck usually here)
- Read: Bottleneck section in report
- Optimize: That stage (usually email subject line)

## Next Steps

1. **Now:** Read `docs/FUNNEL_QUICKSTART.md`
2. **Today:** Run `supabase db push`
3. **Today:** Test `/api/funnel` endpoint
4. **This week:** Add to first email campaign
5. **Next week:** Add email pixel tracking
6. **Next week:** Add `<FunnelTracker />` to pages
7. **Next week:** Update Stripe webhook
8. **Week 2:** Run report, identify bottleneck, optimize

## Support

- Complete reference: `docs/funnel-tracking.md`
- Email examples: `docs/funnel-email-example.md`
- Quick setup: `docs/FUNNEL_QUICKSTART.md`
- Architecture: `FUNNEL_TRACKING_SUMMARY.md`
- Code: `/src/lib/funnel-tracking.ts`

---

**Start here:**
```bash
cat /docs/FUNNEL_QUICKSTART.md
```

Then:
```bash
supabase db push
```

Then:
```bash
pnpm tsx scripts/funnel-report.ts
```

That's it! You now have complete visibility into your sales funnel.
