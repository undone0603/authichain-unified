# Funnel Tracking in Email Campaigns

This guide shows how to integrate funnel tracking into your email automation.

## Example: Gov Engine Campaign

### 1. Generate prospect ID and add to email link

```typescript
import { addFunnelParams } from '@/lib/funnel-tracking';

// In your email campaign automation
export async function sendGovernmentProposalEmail(prospect: {
  email: string;
  name: string;
  industry: string;
}) {
  // Generate unique prospect ID (or use existing customer ID)
  const prospectId = `prospect_${crypto.randomUUID()}`;
  const campaignId = 'gov_opportunities_q3_2026';

  // Create funnel-tracked link to govchain.us
  const trackedLink = addFunnelParams('https://govchain.us/opportunities', {
    prospectId,
    source: 'gov_engine',
    medium: 'email',
    campaign: campaignId,
  });

  // Email body with tracked link
  const htmlBody = `
    <h2>Hi ${prospect.name},</h2>
    <p>We found ${prospect.industry} contract opportunities matching your business.</p>
    <p>
      <a href="${trackedLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
        View Opportunities
      </a>
    </p>
    <!-- Tracking pixel for email opens -->
    <img src="https://yourdomain.com/api/email/pixel?prospect_id=${prospectId}&campaign_id=${campaignId}" width="1" height="1" alt="" />
  `;

  // Send email
  await sendEmail({
    to: prospect.email,
    subject: `${prospect.industry} Government Contracts - ${new Date().getFullYear()}`,
    html: htmlBody,
  });

  // Log proposal sent event
  await trackFunnelEvent({
    prospectId,
    stage: 'proposal_sent',
    source: 'gov_engine',
    eventType: 'automated_campaign',
    metadata: {
      campaign_id: campaignId,
      industry: prospect.industry,
      email_to: prospect.email,
    },
  });

  return prospectId;
}
```

### 2. Email open tracking

Add to `/api/email/pixel/route.ts`:

```typescript
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const prospectId = params.get('prospect_id');
  const campaignId = params.get('campaign_id');

  // Track email open
  if (prospectId && campaignId) {
    await trackFunnelEvent({
      prospectId,
      stage: 'email_opened',
      source: 'gov_engine',
      eventType: 'email_open',
      metadata: {
        campaign_id: campaignId,
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
      },
    }).catch((error) => {
      console.error('[email/pixel] Failed to track open:', error);
    });
  }

  // Return 1x1 transparent GIF
  const gif = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x0a,
    0x00, 0x01, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
  ]);

  return new Response(gif, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': gif.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
```

### 3. Generate funnel report

Track campaign performance:

```bash
# View all sources
pnpm tsx scripts/funnel-report.ts

# View only gov_engine performance
pnpm tsx scripts/funnel-report.ts --source gov_engine

# View last 7 days
pnpm tsx scripts/funnel-report.ts --days 7 --source gov_engine
```

Expected output:

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

### 4. Identify optimization opportunities

Based on the report, focus on:

1. **Email open rate is 8.9%** → LOW
   - Action: Test new subject lines, best send times, sender name/domain
   - Target: 15-25% for B2B government contracts
   - Example tests:
     - "Your $500K contract opportunity (urgent)" vs "Government contracts for your company"
     - Send Tuesday-Thursday 9am vs Monday 8am
     - From "sales@authichain" vs "founder@authichain"

2. **Of those who opened, 17.4% clicked** → MODERATE
   - Action: Review CTA button text and placement
   - Test variations:
     - "View Opportunities" vs "See Details" vs "Explore Contracts"
     - Button placement: above fold vs multiple CTAs

3. **Of clickers, 25% landed on page** → CHECK LINK HEALTH
   - Action: Ensure tracking links aren't breaking or redirecting incorrectly
   - Verify `govchain.us` is responding with 200 status

4. **100% checkout completion** → EXCELLENT
   - Only 1 person reached checkout, but 100% converted
   - Continue this conversion path; scale the top-of-funnel

## Multi-Campaign Example

Track multiple concurrent campaigns:

```typescript
const campaigns = [
  {
    id: 'gov_opportunities_q3_2026',
    name: 'Q3 Government Opportunities',
    industry: 'construction',
  },
  {
    id: 'supply_chain_certification_q3_2026',
    name: 'Supply Chain Certification',
    industry: 'manufacturing',
  },
];

for (const campaign of campaigns) {
  const prospects = await getProspectsForCampaign(campaign.id);

  for (const prospect of prospects) {
    await sendGovernmentProposalEmail({
      ...prospect,
      campaignId: campaign.id,
      campaignName: campaign.name,
    });
  }
}

// Then analyze each campaign
const report = await getFunnelReport(30, 'gov_engine');
console.log(report);
```

## Tracking Across Email Providers

### Using Resend

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const prospectId = `prospect_${crypto.randomUUID()}`;
const trackedLink = addFunnelParams('https://govchain.us/opportunities', {
  prospectId,
  source: 'gov_engine',
  medium: 'email',
  campaign: 'q3_opportunities',
});

await resend.emails.send({
  from: 'campaigns@authichain.com',
  to: 'prospect@example.com',
  subject: 'Government Contracts Matching Your Business',
  html: `
    <p>View opportunities: <a href="${trackedLink}">Click here</a></p>
    <img src="https://yourdomain.com/api/email/pixel?prospect_id=${prospectId}&campaign_id=q3_opportunities" width="1" height="1" />
  `,
  tags: [{ name: 'campaign', value: 'gov_q3_2026' }],
});

await trackFunnelEvent({
  prospectId,
  stage: 'proposal_sent',
  source: 'gov_engine',
  metadata: { campaign: 'q3_opportunities' },
});
```

### Using SendGrid

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const prospectId = `prospect_${crypto.randomUUID()}`;
const trackedLink = addFunnelParams('https://govchain.us/opportunities', {
  prospectId,
  source: 'gov_engine',
  medium: 'email',
  campaign: 'q3_opportunities',
});

await sgMail.send({
  to: 'prospect@example.com',
  from: 'campaigns@authichain.com',
  subject: 'Government Contracts Matching Your Business',
  html: `
    <p>View opportunities: <a href="${trackedLink}">Click here</a></p>
    <img src="https://yourdomain.com/api/email/pixel?prospect_id=${prospectId}&campaign_id=q3_opportunities" width="1" height="1" />
  `,
  trackingSettings: {
    clickTracking: { enabled: true },
    openTracking: { enabled: true },
  },
  customArgs: {
    prospect_id: prospectId,
    campaign: 'q3_opportunities',
  },
});

await trackFunnelEvent({
  prospectId,
  stage: 'proposal_sent',
  source: 'gov_engine',
  metadata: { campaign: 'q3_opportunities' },
});
```

## Double-Click Filtering

To avoid double-counting email opens from email clients with image loading enabled:

```typescript
// In /api/email/pixel/route.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const prospectId = params.get('prospect_id');
  const campaignId = params.get('campaign_id');

  if (!prospectId || !campaignId) {
    return new Response(gif, { status: 200, headers });
  }

  // Check if we've already tracked an open for this prospect + campaign
  // within the last 5 minutes to avoid duplicates
  const { data: recent } = await supabase
    .from('funnel_events')
    .select('id')
    .eq('prospect_id', prospectId)
    .eq('stage', 'email_opened')
    .gte('timestamp', new Date(Date.now() - 5 * 60000).toISOString())
    .limit(1);

  if (!recent || recent.length === 0) {
    // Only track if no open recorded in last 5 minutes
    await trackFunnelEvent({
      prospectId,
      stage: 'email_opened',
      source: 'gov_engine',
      metadata: { campaign_id: campaignId },
    }).catch((error) => {
      console.error('[email/pixel] Failed to track:', error);
    });
  }

  return new Response(gif, { status: 200, headers });
}
```
