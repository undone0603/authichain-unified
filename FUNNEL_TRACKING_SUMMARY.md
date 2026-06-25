# Conversion Funnel Tracking - Complete Implementation

## What Was Built

A comprehensive conversion funnel tracking system to measure prospect drop-off at each stage of the sales journey.

**Problem Solved:** You didn't know where prospects were dropping off in the funnel. Now you'll see exactly:
- How many people saw each email
- How many clicked through
- How many visited the landing page
- How many started checkout
- How many completed purchase
- How many activated subscription

## Files Created

### 1. Supabase Schema (Migration)
**File:** `/supabase/migrations/00007_funnel_events.sql`

Creates the `funnel_events` table with:
- `prospect_id` (text) - Unique prospect identifier
- `stage` (enum) - One of 7 stages from proposal_sent to subscribe
- `source` (enum) - Campaign source: gov_engine, linkedin_post, reddit_post, seo, direct, email, affiliate
- `event_type` (text, optional) - Event subtype (e.g., 'campaign_5')
- `metadata` (jsonb) - Additional tracking data (campaign_id, email_id, etc.)
- `timestamp` (timestamptz) - When the event occurred

**Indexes:**
- prospect_id (find all events for a prospect)
- stage + source (funnel analysis by source)
- timestamp DESC (recent events)
- source + timestamp (per-source trending)

**Stages:**
1. `proposal_sent` - Email sent
2. `email_opened` - Email opened
3. `link_clicked` - Link clicked
4. `visit_landing_page` - Landed on website
5. `start_checkout` - Started checkout form
6. `complete_checkout` - Completed payment
7. `subscribe` - Subscription activated

### 2. API Endpoint
**File:** `/src/app/api/funnel/route.ts`

HTTP endpoint for logging funnel events.

**POST /api/funnel**
- Accepts JSON with prospect_id, stage, source, event_type, metadata
- Validates enum values for stage and source
- Inserts into Supabase funnel_events table
- Returns 201 on success, 400 on validation errors

**GET /api/funnel**
- Returns API documentation and example usage
- Useful for testing and integration verification

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/funnel \
  -H "Content-Type: application/json" \
  -d '{
    "prospect_id": "prospect_12345",
    "stage": "email_opened",
    "source": "gov_engine",
    "event_type": "campaign_5",
    "metadata": {"campaign_id": "campaign_5", "email_id": "email_abc"}
  }'
```

### 3. Client Utility Library
**File:** `/src/lib/funnel-tracking.ts`

Helper functions for frontend integration:
- `trackFunnelEvent()` - Send event to API
- `getProspectIdFromUrl()` - Extract from ?prospect_id=X
- `getSourceFromUrl()` - Extract from ?utm_source=X
- `addFunnelParams()` - Add params to a URL for tracking
- `getCalendlyUrl()` - Generate tracked Calendly link

**Usage:**
```typescript
import { trackFunnelEvent, addFunnelParams } from '@/lib/funnel-tracking';

// Track an event
await trackFunnelEvent({
  prospectId: 'prospect_12345',
  stage: 'visit_landing_page',
  source: 'gov_engine'
});

// Add params to a link
const link = addFunnelParams('https://govchain.us', {
  prospectId: 'prospect_12345',
  source: 'gov_engine',
  medium: 'email',
  campaign: 'campaign_5'
});
```

### 4. React Component for Auto-Tracking
**File:** `/src/components/FunnelTracker.tsx`

Client-side component that automatically logs page visits when a prospect lands from a campaign.

**Usage:**
```tsx
// Add to page layout or individual pages
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

**Behavior:**
- Detects prospect_id from URL params
- Detects source from utm_source parameter
- Auto-logs `visit_landing_page` event if both present
- Silently fails if params missing (no disruption)
- Prevents double-tracking on React strict mode

### 5. Reporting Script
**File:** `/scripts/funnel-report.ts`

Generates 30-day conversion funnel analysis showing:
- Count of prospects at each stage
- Conversion rate between stages
- Drop-off rate at each stage
- Bottleneck identification (stage with highest drop-off)
- Comparative analysis across sources

**Commands:**
```bash
# All sources, last 30 days
pnpm tsx scripts/funnel-report.ts

# Single source
pnpm tsx scripts/funnel-report.ts --source gov_engine

# Last 7 days
pnpm tsx scripts/funnel-report.ts --days 7 --source gov_engine
```

**Example Output:**
```
==========================================================================================
Source: GOV_ENGINE
Period: Last 30 days (5/26/2026 - 6/25/2026)
Total Prospects: 258
==========================================================================================

Stage                    Count      Total %     Prev %      Drop-off
─────────────────────────────────────────────────────────────────────
proposal_sent            258        100.0 %     -           -
email_opened             23         8.9 %       8.9 %       91.1 %
link_clicked             4          1.6 %       17.4 %      82.6 %
visit_landing_page       1          0.4 %       25.0 %      75.0 %
start_checkout           1          0.4 %       100.0 %     0.0 %
complete_checkout        1          0.4 %       100.0 %     0.0 %
subscribe                1          0.4 %       100.0 %     0.0 %

──────────────────────────────────────────────────────────────────────
BOTTLENECK: email_opened (91.1% drop-off)
Action: Review messaging, creative, or targeting at this stage.
```

### 6. Updated Checkout Route
**File:** `/src/app/api/checkout/route.ts`

Enhanced to support funnel tracking:
- Accepts `prospectId` and `source` in request body
- Logs `start_checkout` event before redirecting to Stripe
- Passes prospect_id and source to Stripe metadata
- Includes prospect_id in success URL for post-payment tracking

**Updated Request Body:**
```json
{
  "planId": "pro",
  "email": "prospect@example.com",
  "prospectId": "prospect_12345",
  "source": "gov_engine"
}
```

### 7. Documentation

#### `/docs/funnel-tracking.md`
Complete reference guide covering:
- Database schema explanation
- API endpoint documentation
- Integration points (email, landing page, checkout, Stripe, LinkedIn, Calendly)
- Reporting commands
- Analysis and optimization strategies
- Client-side utilities
- Implementation checklist

#### `/docs/funnel-email-example.md`
Detailed examples for email campaign integration:
- Generate prospect ID and track links
- Email open tracking with pixel
- Multi-campaign example
- Integration with Resend and SendGrid
- Double-click filtering for open tracking

#### `/docs/FUNNEL_QUICKSTART.md`
5-minute setup guide with:
- Step-by-step integration instructions
- Essential code snippets
- Example URLs and email templates
- Troubleshooting guide
- Verification steps

## Integration Checklist

### Phase 1: Foundation (Complete)
- [x] Supabase migration created (00007_funnel_events.sql)
- [x] API endpoint created (/api/funnel/route.ts)
- [x] Client library created (lib/funnel-tracking.ts)
- [x] React component created (FunnelTracker.tsx)
- [x] Reporting script created (scripts/funnel-report.ts)
- [x] Checkout route updated (api/checkout/route.ts)

### Phase 2: Email Tracking (Ready to Implement)
- [ ] Add prospect_id + utm params to email links
- [ ] Create /api/email/pixel/route.ts for open tracking
- [ ] Update email automation to log proposal_sent events
- [ ] Test email open tracking with test emails

### Phase 3: Landing Pages (Ready to Implement)
- [ ] Add <FunnelTracker /> to main layout
- [ ] Add to govchain.us pages
- [ ] Add to enterprise checkout page
- [ ] Verify auto-tracking works in browser

### Phase 4: Stripe Integration (Ready to Implement)
- [ ] Update /api/webhook/route.ts to log complete_checkout
- [ ] Update /api/webhook/route.ts to log subscribe events
- [ ] Test with test Stripe webhook

### Phase 5: Social/External (Ready to Implement)
- [ ] Add utm_source to LinkedIn post links
- [ ] Add utm_source to Reddit post links
- [ ] Add prospect_id to Calendly URLs
- [ ] Test tracking with test campaigns

### Phase 6: Monitoring (Ready to Implement)
- [ ] Run first funnel report: `pnpm tsx scripts/funnel-report.ts`
- [ ] Identify bottleneck for gov_engine
- [ ] Optimize top bottleneck (usually email open rate)
- [ ] Set up daily report automation

## Key Features

### 1. Seven-Stage Funnel
Tracks complete customer journey from first email to active subscription.

### 2. Multi-Source Tracking
Distinguishes between gov_engine, linkedin_post, reddit_post, seo, direct, email, affiliate.

### 3. Automatic Detection
FunnelTracker component auto-detects prospect_id and source from URL params - no manual setup needed.

### 4. Comprehensive Metadata
Capture additional context: campaign_id, email_id, device info, referrer, etc.

### 5. Bottleneck Analysis
Automatically identifies which stage has the highest drop-off (usually where to optimize).

### 6. Comparative Reporting
Compare email open rates and conversion rates across sources to identify best channels.

### 7. CLI Reporting
Generate reports on demand with simple commands, no dashboard needed.

## Expected Metrics

For a healthy B2B sales funnel (gov_engine):
- **Email open rate:** 15-25% (if 8.9%, review subject line)
- **Click-through rate:** 10-20% (if lower, review CTA)
- **Landing page conversion:** 30-50% (if lower, review page design)
- **Checkout initiation:** 5-15% (if lower, review pricing/friction)
- **Checkout completion:** 50-80% (if lower, review payment form)

## How to Use

### 1. Track an Email Campaign
```typescript
// Generate prospect ID
const prospectId = `prospect_${crypto.randomUUID()}`;

// Create tracked link
const link = addFunnelParams('https://govchain.us', {
  prospectId,
  source: 'gov_engine',
  medium: 'email',
  campaign: 'q3_opportunities'
});

// Send email
await sendEmail({ to: prospect.email, body: `Click here: ${link}` });

// Log proposal_sent
await trackFunnelEvent({
  prospectId,
  stage: 'proposal_sent',
  source: 'gov_engine'
});
```

### 2. View Funnel Report
```bash
pnpm tsx scripts/funnel-report.ts --source gov_engine
```

### 3. Identify Optimization Opportunity
The report shows which stage has the highest drop-off. Focus there first.

## Testing

### Test API endpoint
```bash
curl -X POST http://localhost:3000/api/funnel \
  -H "Content-Type: application/json" \
  -d '{"prospect_id": "test_1", "stage": "proposal_sent", "source": "gov_engine"}'
```

### Test end-to-end
```bash
# 1. Log some test events
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/funnel \
    -H "Content-Type: application/json" \
    -d "{\"prospect_id\": \"test_$i\", \"stage\": \"proposal_sent\", \"source\": \"gov_engine\"}"
done

# 2. View report
pnpm tsx scripts/funnel-report.ts --source gov_engine
```

## Performance Considerations

- **Database indexes** on prospect_id, stage+source, and timestamp ensure fast queries
- **Batching** supported via metadata (store batch_id in metadata if needed)
- **RLS policies** prevent unauthorized reads
- **Service role writes** ensure all events are logged regardless of auth

## Security

- Service role key required for API writes (from server only)
- Prospect_id is arbitrary string (no PII required)
- Metadata is optional (store only what you need)
- RLS prevents users from querying other users' funnels (if you add user_id later)

## Future Enhancements

1. **Dashboard** - Real-time visualization of funnel metrics
2. **Alerts** - Email alert if drop-off rate exceeds threshold
3. **A/B Testing** - Compare funnel metrics across email variants
4. **Cohort Analysis** - Track funnel by prospect segment/industry
5. **Predictive** - ML model to predict conversion likelihood
6. **Attribution** - Multi-touch attribution across channels

## Troubleshooting

**No events showing?**
- Run: `supabase status` to verify migration applied
- Check: Browser console for FunnelTracker errors
- Verify: URL has prospect_id and utm_source params

**Email not tracking?**
- Create: `/api/email/pixel/route.ts` (see docs)
- Add pixel to email template: `<img src="...pixel?prospect_id=X&campaign=Y">`

**Low open rates?**
- Test: Different subject lines
- Test: Send times (Tue-Thu 9am usually best)
- Check: Sender reputation (IP warmup if new)

## Support

For questions, see:
1. `/docs/FUNNEL_QUICKSTART.md` - Quick setup
2. `/docs/funnel-tracking.md` - Complete reference
3. `/docs/funnel-email-example.md` - Email examples
4. `/src/lib/funnel-tracking.ts` - Code documentation
5. `/src/app/api/funnel/route.ts` - API specification

---

**Total Files Created:** 9
- 1 Supabase migration
- 2 API routes (funnel + checkout enhanced)
- 1 Client library
- 1 React component
- 1 Reporting script
- 3 Documentation files
- 1 This summary

**Ready to use immediately after running:** `supabase db push`
