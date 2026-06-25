# Email Proposals Integration Guide

## Overview

The existing `/scripts/email-proposals.ts` sends HTML-formatted proposal emails via Resend. This guide explains how to integrate it with the new lead scoring pipeline.

## Current Architecture

**Existing:** `email-proposals.ts` queries `gov_proposals` table
```sql
SELECT * FROM gov_proposals 
WHERE email_status = 'unsent' 
  AND fit_score >= 70
LIMIT 50
```

**New Pipeline:** We recommend transitioning to query `leads` table instead:
```sql
SELECT * FROM leads 
WHERE source = 'gov_engine' 
  AND status = 'qualified' 
  AND lastContactedAt IS NULL
LIMIT 50
```

## Integration Strategy

### Option A: Keep Existing (Minimal Changes)

If you want to continue using gov_proposals directly:

1. Ensure gov_proposals table has these columns:
   - `contact_email` (required)
   - `fit_score` (for filtering)
   - `email_status` (tracks 'unsent' → 'sent')

2. Update `email_status` threshold in score-opportunities.ts:
   ```sql
   UPDATE gov_proposals 
   SET email_status = 'unsent'
   WHERE fit_score >= 70;
   ```

3. The existing script will handle everything else.

**Pros:** Minimal code changes
**Cons:** Duplicates lead data across tables

---

### Option B: Migrate to Leads Table (Recommended)

Use the qualified leads from the new pipeline for email delivery.

#### Step 1: Update email-proposals.ts

Replace the query section (lines 254-261):

```typescript
// OLD:
const { data: proposals, error } = await supabase
  .from('gov_proposals')
  .select('*')
  .eq('email_status', 'unsent')
  .gte('fit_score', 70)
  .order('fit_score', { ascending: false })
  .limit(50);

// NEW:
// Join leads → gov_proposals to get full proposal details
const { data: leads, error } = await supabase
  .from('leads')
  .select(`
    *,
    proposal:gov_proposals!inner(
      notice_id,
      proposal_draft,
      status,
      email_status,
      deadline
    )
  `)
  .eq('source', 'gov_engine')
  .eq('status', 'qualified')
  .is('lastContactedAt', null)
  .order('leadScore', { ascending: false })
  .limit(50);

if (error) throw error;
if (!leads?.length) {
  console.log('No qualified leads awaiting outreach.');
  process.exit(0);
}
```

#### Step 2: Update Email Loop

Replace the for loop (lines 272-312):

```typescript
for (const lead of leads) {
  try {
    // Extract proposal from nested relation
    const proposal = lead.proposal?.[0];
    if (!proposal) {
      console.warn(`  ⚠️  No proposal for ${lead.email}`);
      failed++;
      continue;
    }

    // Build proposal object compatible with existing HTML template
    const leadScoreDetail = lead.metadata?.lead_score_detail;
    const proposalData = {
      notice_id: proposal.notice_id,
      title: lead.name || 'Government Opportunity',
      agency: lead.company || 'Government Agency',
      fit_score: lead.leadScore,
      proposal_draft: proposal.proposal_draft,
      contact_email: lead.email,
      contact_person: lead.name,
      govchain_url: lead.metadata?.govchain_url || GOVCHAIN,
      deadline: proposal.deadline || lead.metadata?.deadline,
    };

    // Generate HTML using existing template function
    const html = generateEmailHtml(proposalData);
    const subject = `GovChain Proposal: ${proposalData.agency} — ${proposalData.fit_score}/100 Match`;

    if (!isDryRun) {
      const response = await resend.emails.send({
        from: FROM_EMAIL,
        to: lead.email,
        subject,
        html,
      });

      if (!response.data?.id) {
        throw new Error(`Resend: ${JSON.stringify(response.error)}`);
      }

      // Update lead status
      await supabase
        .from('leads')
        .update({
          status: 'contacted',
          lastContactedAt: new Date().toISOString(),
          threadId: response.data.id, // Store Resend message ID for tracking
        })
        .eq('id', lead.id);

      // Also mark proposal as sent (for audit trail)
      await supabase
        .from('gov_proposals')
        .update({
          email_status: 'sent',
          status: 'submitted',
        })
        .eq('notice_id', proposal.notice_id);
    } else {
      console.log(`  [DRY RUN] Would send to ${lead.email}`);
    }

    console.log(`  ✉️  Sent proposal to ${lead.company} (${lead.email})`);
    sent++;
  } catch (err: any) {
    failed++;
    const shortMsg = (err?.message || String(err)).split('\n')[0].slice(0, 200);
    console.warn(`  ⚠️  Error: ${shortMsg}`);
  }
}
```

#### Step 3: Enhance Email Template with Lead Score Detail

Modify `generateEmailHtml()` to include lead scoring breakdown:

```typescript
function generateEmailHtml(proposal: Proposal & { leadScoreDetail?: any }): string {
  // ... existing header code ...
  
  // Add new section in email body (after proposal preview):
  const leadScoreSection = proposal.leadScoreDetail ? `
    <div class="score-breakdown" style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <strong style="color: #15803d;">Detailed Fit Analysis:</strong>
      <div style="margin-top: 12px; font-size: 13px; color: #166534;">
        <div style="margin: 6px 0;">Blockchain Authentication: <strong>${proposal.leadScoreDetail.blockchain_fit.score}/100</strong> — ${proposal.leadScoreDetail.blockchain_fit.rationale}</div>
        <div style="margin: 6px 0;">Agency Sector Match: <strong>${proposal.leadScoreDetail.agency_sector_match.score}/100</strong> — ${proposal.leadScoreDetail.agency_sector_match.rationale}</div>
        <div style="margin: 6px 0;">Budget Alignment: <strong>${proposal.leadScoreDetail.budget_alignment.score}/100</strong> — ${proposal.leadScoreDetail.budget_alignment.rationale}</div>
        <div style="margin: 6px 0;">Timeline Feasibility: <strong>${proposal.leadScoreDetail.timeline_fit.score}/100</strong> — ${proposal.leadScoreDetail.timeline_fit.rationale}</div>
      </div>
    </div>
  ` : '';
  
  // ... insert leadScoreSection before CTA ...
}
```

#### Step 4: Track Email Engagement

After sending, enable engagement tracking:

```typescript
// Optional: Setup webhook receiver for Resend email events
// POST /api/webhooks/resend
// - email.opened → leads.emailOpened = true
// - email.clicked → leads.emailClicked = true
// - email.bounced → leads.status = 'bounced'
```

---

## Database Schema Requirements

### Leads Table Columns (Already Exist)
- `id` SERIAL
- `email` VARCHAR
- `name` VARCHAR (contact person or agency name)
- `company` VARCHAR (agency name)
- `source` VARCHAR ('gov_engine')
- `leadScore` INTEGER (fit_score from opportunity)
- `status` VARCHAR ('new', 'qualified', 'contacted', 'responded')
- `metadata` JSON (stores lead_score_detail, opportunity_id, etc.)
- `lastContactedAt` TIMESTAMP
- `emailOpened` BOOLEAN (default false)
- `emailClicked` BOOLEAN (default false)
- `emailReplied` BOOLEAN (default false)
- `threadId` VARCHAR (Resend message ID for tracking)
- `createdAt`, `updatedAt` TIMESTAMP

### Gov_Proposals Columns (Existing)
- `notice_id` TEXT (PK)
- `title` TEXT
- `agency` TEXT
- `fit_score` INTEGER
- `proposal_draft` TEXT (HTML or markdown)
- `email_status` VARCHAR ('unsent', 'sent', 'bounced')
- `status` VARCHAR ('draft', 'reviewed', 'submitted', 'won', 'lost')
- `deadline` TEXT
- `govchain_url` TEXT
- `sam_url` TEXT

---

## Testing

### Dry Run Test
```bash
DRY_RUN=true pnpm tsx scripts/email-proposals.ts
```

Expected output:
```
  [DRY RUN] Would send to procurement@agency.gov
  [DRY RUN] Would send to contracting@agency2.gov
✅ Sent 2/3 proposals (0 failed, 1 skipped)
```

### Manual Lead Setup
```sql
-- Insert test lead
INSERT INTO leads (
  email, name, company, source, leadScore, status, 
  metadata, createdAt, updatedAt
) VALUES (
  'test@example.com',
  'Test Contact',
  'Test Agency',
  'gov_engine',
  78,
  'qualified',
  '{"opportunity_id": "TEST-001", "lead_score_detail": {...}, "govchain_url": "..."}'::json,
  now(),
  now()
);

-- Create corresponding proposal (or use existing)
INSERT INTO gov_proposals (
  notice_id, title, agency, fit_score, proposal_draft, 
  status, email_status, deadline, govchain_url
) VALUES (
  'TEST-001',
  'Test Opportunity',
  'Test Agency',
  78,
  'This is a test proposal...',
  'draft',
  'unsent',
  '2026-08-01',
  'https://govchain.us/proposals/TEST-001'
);

-- Run email script
pnpm tsx scripts/email-proposals.ts
```

### Monitor Engagement
```sql
SELECT 
  company,
  COUNT(*) as total_sent,
  SUM(CASE WHEN emailOpened THEN 1 ELSE 0 END) as opened,
  SUM(CASE WHEN emailClicked THEN 1 ELSE 0 END) as clicked,
  SUM(CASE WHEN emailReplied THEN 1 ELSE 0 END) as replied,
  ROUND(100.0 * SUM(CASE WHEN emailOpened THEN 1 ELSE 0 END) / COUNT(*), 1) as open_rate
FROM leads
WHERE source = 'gov_engine' AND lastContactedAt IS NOT NULL
GROUP BY company
ORDER BY replied DESC;
```

---

## Comparison: Old vs New Architecture

| Aspect | Before | After |
|--------|--------|-------|
| **Lead Source** | gov_proposals.contact_email | leads.email (gov_engine source) |
| **Qualification Gate** | fit_score >= 70 | status='qualified' (scored + filtered) |
| **Lead Score Detail** | In gov_opportunities.ai_reasoning | In leads.metadata.lead_score_detail (4-dim breakdown) |
| **Lead Status** | Implicit in email_status | Explicit: new → qualified → contacted → responded |
| **Contact Tracking** | email_status column | lastContactedAt + emailOpened/Clicked/Replied |
| **Email Filtering** | Random sample, no scoring | Scored and ranked by leadScore DESC |
| **Dedup** | By notice_id | By email + source (prevents dupes) |

---

## Environment Variables

```bash
# Required
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

# Email Delivery
RESEND_API_KEY=re_xxxxx...           # (Primary)
EMAIL_FROM=proposals@authichain.com  # (Default: proposals@authichain.com)

# Links
GOVCHAIN_URL=https://govchain.us
CALENDLY_LINK=https://calendly.com/authichain/discovery
SALES_EMAIL=sales@authichain.com

# Optional
DRY_RUN=true                         # Preview only
```

---

## Troubleshooting

**Q: "No proposals ready for email delivery"**
A: Check:
1. Do leads exist with `source='gov_engine'` and `status='qualified'`?
   ```sql
   SELECT COUNT(*) FROM leads WHERE source='gov_engine' AND status='qualified';
   ```
2. Have they already been contacted?
   ```sql
   SELECT COUNT(*) FROM leads WHERE source='gov_engine' AND status='qualified' AND lastContactedAt IS NULL;
   ```
3. Is there a corresponding proposal for each lead?
   ```sql
   SELECT COUNT(*) FROM gov_proposals WHERE notice_id IN (SELECT metadata->>'opportunity_id' FROM leads WHERE source='gov_engine');
   ```

**Q: Email not sending but no error**
A: Check:
1. Is RESEND_API_KEY set and valid?
2. Is EMAIL_FROM valid in Resend?
3. Are leads being filtered too aggressively? Try reducing WHERE clauses.

**Q: "Resend returned no message ID"**
A: Resend API issue. Check:
1. API key is valid
2. From email is verified in Resend account
3. Resend service status at https://status.resend.com

---

## Next Steps

1. Backup existing email_proposals.ts script
2. Test Option A or B locally with DRY_RUN=true
3. Validate email template renders correctly
4. Deploy to GitHub Actions workflow
5. Monitor engagement metrics for first 10 emails
6. Adjust score thresholds if needed based on reply rates
