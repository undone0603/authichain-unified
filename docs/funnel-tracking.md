# Conversion Funnel Tracking

## Overview

This system tracks prospect drop-off through the conversion funnel at each stage:
1. **proposal_sent** - Email sent to prospect
2. **email_opened** - Prospect opens email
3. **link_clicked** - Prospect clicks link in email/social
4. **visit_landing_page** - Prospect lands on website
5. **start_checkout** - Prospect initiates checkout
6. **complete_checkout** - Prospect completes payment
7. **subscribe** - Prospect activates subscription

## Database Schema

```sql
CREATE TABLE funnel_events (
  id uuid PRIMARY KEY,
  prospect_id text NOT NULL,
  stage funnel_stage NOT NULL,
  source funnel_source NOT NULL,
  event_type text,
  metadata jsonb,
  timestamp timestamptz
);
```

**Stages:** `proposal_sent`, `email_opened`, `link_clicked`, `visit_landing_page`, `start_checkout`, `complete_checkout`, `subscribe`

**Sources:** `gov_engine`, `linkedin_post`, `reddit_post`, `seo`, `direct`, `email`, `affiliate`

## API Endpoint

### POST /api/funnel

Track a conversion event.

**Request:**
```json
{
  "prospect_id": "prospect_12345",
  "stage": "email_opened",
  "source": "gov_engine",
  "event_type": "campaign_5",
  "metadata": {
    "campaign_id": "campaign_5",
    "email_id": "email_abc123",
    "client_ip": "192.168.1.1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Funnel event recorded",
  "prospect_id": "prospect_12345",
  "stage": "email_opened",
  "source": "gov_engine"
}
```

## Integration Points

### 1. Email Links (Gov Engine Campaigns)

Add UTM parameters + prospect_id to all email links:

```typescript
import { addFunnelParams } from '@/lib/funnel-tracking';

const emailLink = addFunnelParams('https://govchain.us', {
  prospectId: 'prospect_12345',
  source: 'gov_engine',
  medium: 'email',
  campaign: 'campaign_5'
});
// Result: https://govchain.us?prospect_id=prospect_12345&utm_source=gov_engine&utm_medium=email&utm_campaign=campaign_5
```

**Action:** When sending emails via gov_engine:
1. Generate prospect_id (e.g., hash of email)
2. Add funnel params to link
3. Log `proposal_sent` event

**Example in automation/email service:**
```typescript
const prospectId = `prospect_${crypto.randomUUID()}`;
const trackingLink = addFunnelParams('https://govchain.us/opportunities', {
  prospectId,
  source: 'gov_engine',
  medium: 'email',
  campaign: campaignId
});

// Send email with tracking link
await sendEmail({
  to: prospect.email,
  body: `Check out this opportunity: ${trackingLink}`,
});

// Log proposal sent
await trackFunnelEvent({
  prospectId,
  stage: 'proposal_sent',
  source: 'gov_engine',
  metadata: { campaign_id: campaignId }
});
```

### 2. Email Open Tracking

Use email service provider's tracking pixel or implement server-side logging:

```typescript
// GET /api/email/pixel?prospect_id=X&campaign_id=Y
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const prospectId = params.get('prospect_id');
  const campaignId = params.get('campaign_id');

  if (prospectId) {
    await trackFunnelEvent({
      prospectId,
      stage: 'email_opened',
      source: 'gov_engine',
      metadata: { campaign_id: campaignId }
    });
  }

  // Return 1x1 transparent GIF
  const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x0A, 0x00, 0x01, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B]);
  return new Response(gif, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache, no-store' }
  });
}
```

### 3. Landing Page Visits

Track when prospect lands on govchain.us or any funnel page:

```typescript
// In page components or app.tsx
'use client';
import { useEffect } from 'react';
import { trackFunnelEvent, getProspectIdFromUrl, getSourceFromUrl } from '@/lib/funnel-tracking';

export default function FunnelPage() {
  useEffect(() => {
    const prospectId = getProspectIdFromUrl();
    const source = getSourceFromUrl();

    if (prospectId && source) {
      trackFunnelEvent({
        prospectId,
        stage: 'visit_landing_page',
        source,
        metadata: { pathname: window.location.pathname }
      });
    }
  }, []);

  return <div>Funnel content</div>;
}
```

### 4. Checkout Flow

**Already integrated in `/api/checkout/route.ts`:**

- Logs `start_checkout` when form is submitted
- Logs `complete_checkout` when Stripe webhook confirms payment
- Captures prospect_id from URL parameter: `?prospect_id=X`
- Captures source from URL parameter: `?utm_source=gov_engine`

**Client integration:**
```typescript
// In checkout page/component
const response = await fetch('/api/checkout', {
  method: 'POST',
  body: JSON.stringify({
    planId: 'pro',
    email: 'prospect@example.com',
    prospectId: getProspectIdFromUrl(), // Auto-capture from URL
    source: getSourceFromUrl()           // Auto-capture from URL
  })
});
```

### 5. Stripe Webhook Integration

Add to `/api/webhook/route.ts` to log checkout completion:

```typescript
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const prospectId = session.metadata?.prospect_id;
  const source = session.metadata?.source;

  if (prospectId) {
    await trackFunnelEvent({
      prospectId,
      stage: 'complete_checkout',
      source: source || 'direct',
      metadata: {
        stripe_session_id: session.id,
        customer_email: session.customer_email,
        amount: session.amount_total
      }
    });

    // Log subscription activation if applicable
    if (session.subscription) {
      await trackFunnelEvent({
        prospectId,
        stage: 'subscribe',
        source: source || 'direct',
        metadata: {
          stripe_subscription_id: session.subscription,
          stripe_session_id: session.id
        }
      });
    }
  }
}
```

### 6. Calendly Integration

Track Calendly bookings back to prospect:

```typescript
import { getCalendlyUrl } from '@/lib/funnel-tracking';

const prospectId = 'prospect_12345';
const calendlyLink = getCalendlyUrl(
  'https://calendly.com/john/30min',
  prospectId,
  'gov_engine'
);
// Returns: https://calendly.com/john/30min?name=prospect_12345&utm_source=gov_engine

// Email to prospect with Calendly link
const emailBody = `Schedule a demo: ${calendlyLink}`;
```

Then in Calendly webhooks, use the attendee name to match back to prospect_id.

### 7. LinkedIn Posts

Add UTM params to links in LinkedIn posts:

```typescript
const linkedinLink = addFunnelParams('https://authichain.com/demo', {
  prospectId: 'campaign_linkedin_12345',  // Use campaign ID as prospect ID
  source: 'linkedin_post',
  campaign: 'linkedin_organic'
});
// Result: https://authichain.com/demo?prospect_id=campaign_linkedin_12345&utm_source=linkedin_post&utm_campaign=linkedin_organic
```

Then landing page auto-tracks via `visit_landing_page` event.

## Reporting

### Generate 30-day Funnel Report

```bash
pnpm tsx scripts/funnel-report.ts
```

### Generate report for specific source

```bash
pnpm tsx scripts/funnel-report.ts --source gov_engine
```

### Generate report for last 7 days

```bash
pnpm tsx scripts/funnel-report.ts --days 7
```

### Example output

```
==========================================================================================
Source: GOV_ENGINE
Period: Last 30 days (5/26/2026 - 6/25/2026)
Total Prospects: 258
==========================================================================================

Stage                    Count      Total %     Prev %      Drop-off
-────────────────────────────────────────────────────────────────────
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

## Analysis & Optimization

### Key Metrics to Monitor

1. **Email Open Rate** (email_opened / proposal_sent)
   - Target: 15-25% for B2B
   - If low: Review subject lines, sender reputation, send time
   - If high: Good messaging match

2. **Click-Through Rate** (link_clicked / email_opened)
   - Target: 10-20%
   - If low: Review CTA copy, email layout, value proposition

3. **Landing Page Conversion** (visit_landing_page / link_clicked)
   - Target: 30-50%
   - If low: Review page design, load time, relevance to email

4. **Checkout Initiation** (start_checkout / visit_landing_page)
   - Target: 5-15%
   - If low: Review pricing, value prop, page friction

5. **Checkout Completion** (complete_checkout / start_checkout)
   - Target: 50-80%
   - If low: Review payment form, error messaging, trust signals

### Source Comparison

Compare metrics across sources to identify best-performing channels:

```bash
pnpm tsx scripts/funnel-report.ts
```

Output shows:
- Email open rates by source (identify weak email channels)
- Conversion rates by source (identify highest-intent channels)
- Bottleneck for each source (where to optimize)

### Bottleneck Identification

The report highlights the stage with the highest drop-off for each source:

```
BOTTLENECK: email_opened (91.1% drop-off)
Action: Review messaging, creative, or targeting at this stage.
```

This tells you where to focus optimization efforts.

## Client-Side Utility

```typescript
import { trackFunnelEvent, getProspectIdFromUrl, getSourceFromUrl, addFunnelParams } from '@/lib/funnel-tracking';

// Auto-detect prospect ID and source from URL
const prospectId = getProspectIdFromUrl();  // ?prospect_id=X
const source = getSourceFromUrl();           // ?utm_source=gov_engine

// Track an event
await trackFunnelEvent({
  prospectId: 'prospect_12345',
  stage: 'link_clicked',
  source: 'gov_engine',
  metadata: { link_position: 'above_fold' }
});

// Add params to a link
const link = addFunnelParams('https://govchain.us', {
  prospectId: 'prospect_12345',
  source: 'gov_engine',
  medium: 'email',
  campaign: 'campaign_5'
});
```

## Implementation Checklist

- [ ] Supabase migration applied: `00007_funnel_events.sql`
- [ ] API endpoint created: `/api/funnel`
- [ ] Funnel tracking utility created: `/lib/funnel-tracking.ts`
- [ ] Checkout route updated to log funnel events
- [ ] Email tracking integrated (add prospect_id + utm params to links)
- [ ] Email open tracking implemented (pixel or server-side logging)
- [ ] Landing page auto-tracking added (useEffect tracking)
- [ ] Stripe webhook updated to log completion events
- [ ] LinkedIn posts updated with utm params
- [ ] Calendly links include prospect_id parameter
- [ ] Funnel report script tested: `pnpm tsx scripts/funnel-report.ts`
