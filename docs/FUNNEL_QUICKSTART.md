# Funnel Tracking Quick Start

## 5-Minute Setup

### 1. Apply Supabase Migration

```bash
# This creates the funnel_events table with all required indexes
supabase db push
```

**What it creates:**
- `funnel_events` table with prospect_id, stage, source, metadata
- Indexes for fast querying by prospect, stage, source, and timestamp
- RLS policies for security

### 2. Test the API

```bash
# Log a test event
curl -X POST http://localhost:3000/api/funnel \
  -H "Content-Type: application/json" \
  -d '{
    "prospect_id": "test_prospect_123",
    "stage": "email_opened",
    "source": "gov_engine",
    "metadata": {"test": true}
  }'

# Check API documentation
curl http://localhost:3000/api/funnel
```

### 3. Add to Email Campaign

```typescript
import { addFunnelParams } from '@/lib/funnel-tracking';

// When sending emails, add these parameters to links:
const prospectId = `prospect_${crypto.randomUUID()}`;
const link = addFunnelParams('https://govchain.us', {
  prospectId,
  source: 'gov_engine',
  medium: 'email',
  campaign: 'campaign_name'
});

// Log the proposal_sent event
await fetch('/api/funnel', {
  method: 'POST',
  body: JSON.stringify({
    prospect_id: prospectId,
    stage: 'proposal_sent',
    source: 'gov_engine',
    metadata: { campaign: 'campaign_name' }
  })
});
```

### 4. Add to Landing Pages

Place FunnelTracker in your page layout:

```tsx
// app/page.tsx or app/layout.tsx
import { FunnelTracker } from '@/components/FunnelTracker';

export default function Page() {
  return (
    <>
      <FunnelTracker />
      {/* Your page content */}
    </>
  );
}
```

The component automatically:
- Detects prospect_id from `?prospect_id=X` URL param
- Detects source from `?utm_source=gov_engine` URL param
- Logs `visit_landing_page` event when both are present
- Silently fails if either is missing (no disruption)

### 5. View Reports

```bash
# View 30-day funnel report for all sources
pnpm tsx scripts/funnel-report.ts

# View gov_engine only
pnpm tsx scripts/funnel-report.ts --source gov_engine

# View last 7 days
pnpm tsx scripts/funnel-report.ts --days 7
```

## Integration Points (In Order)

| Step | Action | Code |
|------|--------|------|
| 1 | **Send email** | Add prospect_id + utm params to link |
| 2 | **Log proposal_sent** | POST /api/funnel with stage='proposal_sent' |
| 3 | **Track email open** | Add tracking pixel: `<img src="/api/email/pixel?prospect_id=X&campaign=Y">` |
| 4 | **Prospect clicks** | Link with prospect_id auto-logs via FunnelTracker on landing page |
| 5 | **Log visit_landing_page** | FunnelTracker component auto-logs when loaded |
| 6 | **Start checkout** | Checkout form sends prospectId to /api/checkout |
| 7 | **Log start_checkout** | /api/checkout auto-logs before redirect to Stripe |
| 8 | **Complete payment** | Stripe webhook confirms payment |
| 9 | **Log complete_checkout** | Add to /api/webhook/route.ts (see below) |
| 10 | **Activate subscription** | Log subscribe event in webhook |

## Essential Additions

### Add Email Open Tracking

Create `/src/app/api/email/pixel/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x0A, 0x00, 0x01, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B]);

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const prospectId = params.get('prospect_id');
  const campaignId = params.get('campaign_id');

  if (prospectId && campaignId) {
    // Track email open in background
    fetch('http://localhost:3000/api/funnel', {
      method: 'POST',
      body: JSON.stringify({
        prospect_id: prospectId,
        stage: 'email_opened',
        source: 'gov_engine',
        event_type: 'email_open',
        metadata: { campaign_id: campaignId }
      })
    }).catch(() => {});
  }

  return new Response(GIF, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache' }
  });
}
```

### Add Webhook Completion Tracking

In `/src/app/api/webhook/route.ts`, add to checkout.session.completed handler:

```typescript
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const prospectId = session.metadata?.prospect_id;
  const source = session.metadata?.source;

  if (prospectId) {
    // Log checkout completion
    await fetch('http://localhost:3000/api/funnel', {
      method: 'POST',
      body: JSON.stringify({
        prospect_id: prospectId,
        stage: 'complete_checkout',
        source: source || 'direct',
        metadata: {
          stripe_session_id: session.id,
          amount: session.amount_total
        }
      })
    }).catch(console.error);

    // Log subscription (if applicable)
    if (session.subscription) {
      await fetch('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({
          prospect_id: prospectId,
          stage: 'subscribe',
          source: source || 'direct',
          metadata: { subscription_id: session.subscription }
        })
      }).catch(console.error);
    }
  }
}
```

## Example Email with Tracking

```html
<!-- Email template with funnel tracking -->
<h2>Hi {{name}},</h2>
<p>We found contract opportunities for your business.</p>

<!-- Tracked link (will log visit_landing_page when clicked) -->
<a href="https://govchain.us/opportunities?prospect_id={{prospectId}}&utm_source=gov_engine&utm_medium=email&utm_campaign={{campaignId}}">
  View Opportunities →
</a>

<!-- Open tracking pixel (logs email_opened) -->
<img src="https://yourdomain.com/api/email/pixel?prospect_id={{prospectId}}&campaign_id={{campaignId}}" width="1" height="1" alt="" />
```

## Check Your Setup

### Verify migration was applied

```bash
supabase status
# Should show: "supabase migration apply 00007_funnel_events"

# Or check directly in Supabase dashboard:
# Authentication > SQL > SELECT COUNT(*) FROM funnel_events;
```

### Test end-to-end

```bash
# 1. Send test event
curl -X POST http://localhost:3000/api/funnel \
  -H "Content-Type: application/json" \
  -d '{
    "prospect_id": "test_e2e_1",
    "stage": "proposal_sent",
    "source": "gov_engine"
  }'

# 2. Check it was recorded
pnpm tsx scripts/funnel-report.ts --source gov_engine

# Should show: "test_e2e_1" under gov_engine funnel
```

### View funnel report

```bash
pnpm tsx scripts/funnel-report.ts
```

Expected output when you have data:

```
==========================================================================================
Source: GOV_ENGINE
...
Total Prospects: 10
...
proposal_sent            10        100.0 %     -           -
email_opened             2         20.0 %      20.0 %      80.0 %
...
```

## Common URL Patterns

### Email link (gov_engine)
```
https://govchain.us?prospect_id=prospect_abc123&utm_source=gov_engine&utm_medium=email&utm_campaign=q3_opportunities
```

### LinkedIn post
```
https://authichain.com/demo?prospect_id=campaign_linkedin_1&utm_source=linkedin_post&utm_campaign=linkedin_organic
```

### Calendly (includes prospect in name field)
```
https://calendly.com/john/30min?name=prospect_abc123&utm_source=gov_engine
```

### Success page (captures completion)
```
https://yourdomain.com/success?session_id=cs_live_xxx&prospect_id=prospect_abc123&utm_source=gov_engine
```

## Monitoring Setup

### Daily funnel check

```bash
# Create a cron job to run daily and email report
# (Add to scripts/daily-funnel-report.sh)
#!/bin/bash
REPORT=$(pnpm tsx scripts/funnel-report.ts)
echo "$REPORT" | mail -s "Daily Funnel Report" team@company.com
```

### Add to Slack

```typescript
// scripts/funnel-to-slack.ts
import { getFunnelReport } from './funnel-report';

const report = await getFunnelReport(1); // Last 1 day
const message = formatReportForSlack(report);
await postToSlack(message);
```

## Troubleshooting

**No events showing up?**
- Check that funnel_events table exists: `supabase status`
- Verify API endpoint is working: `curl http://localhost:3000/api/funnel`
- Check browser console for errors in FunnelTracker component
- Make sure prospect_id and utm_source are in the URL

**Email pixel not tracking?**
- Create `/src/app/api/email/pixel/route.ts` (see above)
- Use `width="1" height="1" alt=""` on the img tag
- Email clients must have image loading enabled

**Low conversion rates?**
- Check email open rate first (biggest bottleneck usually here)
- Use `pnpm tsx scripts/funnel-report.ts --source gov_engine` to identify stage
- Review BOTTLENECK section in report for optimization priority

## Next Steps

1. **Immediate:** Apply migration, test API, add to email campaign
2. **This week:** Add FunnelTracker to landing pages, add email pixel
3. **This week:** Update checkout route (already done in /api/checkout/route.ts)
4. **Next week:** Run first funnel report, identify bottleneck, optimize
5. **Ongoing:** Run daily reports, A/B test email subject lines, measure impact

See `/docs/funnel-tracking.md` for complete documentation.
