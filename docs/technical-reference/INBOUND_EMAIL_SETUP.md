# Inbound Email Reply Capture & Auto-Nurture Setup Guide

> **Status (2026-09-24): not live.** Nothing below is currently running:
>
> - `authichain.com` has **receiving disabled** in Resend, the account has **no
>   webhooks**, and no inbound email has arrived. The inbound route in Phase 1
>   was never configured.
> - `authichain.com` was re-verified for **sending** on 2026-09-24 after its
>   DNS records had failed. Check it shows **Verified** in Resend before
>   sending proposals from `proposals@authichain.com` (Phase 7).
> - `/api/webhooks/resend-inbound` and `/api/cron/nurture-replies` are Next.js
>   routes that only ran on Vercel, which is retired. `app.authichain.com` is
>   `authichain-edge-router` (`worker-app/`) and does not serve them yet. They
>   need porting there first, the way `worker-app/lead-routes.ts` ported the
>   lead forms. The route's `ResendInboundPayload` type is the older flat
>   inbound-routes shape; check it against Resend's current `email.received`
>   webhook payload while porting.
>
> Until then, the Phase 1 and Phase 5 steps point at endpoints that return 404.

## Overview

This system automatically captures replies to proposal emails sent from `proposals@authichain.com`, classifies sentiment (OpenAI when `OPENAI_API_KEY` is set, otherwise local Ollama, otherwise a conservative heuristic that fail-closes to `neutral`), and triggers intelligent follow-up sequences to nurture interested prospects.

**Expected Results:**

- Capture: 258 proposals → 39-77 replies (15-30% reply rate)
- Auto-nurture: Turn 5-10% of replies into deals with minimal manual effort
- Dashboard: Sales team visibility + manual override controls

---

## Architecture Overview

```
Prospect replies to proposals@authichain.com
         ↓
Resend Inbound Routes to webhook
         ↓
POST /api/webhooks/resend-inbound
         ↓
Parse email + Classify sentiment (OpenAI → Ollama → heuristic → fail-closed neutral)
         ↓
Match reply to original proposal
         ↓
Store in inbound_replies table
         ↓
Create reply_sequences entry
         ↓
[2-hourly cron] → Send nurture email
         ↓
Dashboard shows reply + auto-nurture status
```

---

## Phase 1: Resend Inbound Route Setup (10 minutes)

### Step 1: Verify Domain in Resend Console

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Confirm `authichain.com` is verified (DNS records set up)
3. If not verified, follow Resend's domain verification flow

### Step 2: Create Inbound Route

1. In Resend Dashboard, go to **Domains** → Select `authichain.com`
2. Scroll to **Inbound Routes**
3. Click **Create Route**
4. Configure:
   - **Route name**: `proposals@authichain.com`
   - **Match email**: `proposals@authichain.com`
   - **Forward to**: `https://your-domain.com/api/webhooks/resend-inbound`
   - **Leave other fields default**
5. Click **Save Route**

> **Note**: Use `https://app.authichain.com/api/webhooks/resend-inbound` once the route is ported to the edge router (see Status above). Never point it at a `*.vercel.app` host; Vercel is retired.

### Step 3: Copy Webhook Secret (Optional but Recommended)

Once the route is created:

1. Click the route to view details
2. Copy the **Webhook Secret** (if displayed)
3. Add to `.env.local`:
   ```
   RESEND_WEBHOOK_SECRET=your_secret_here
   ```

---

## Phase 2: Environment Variables Setup (5 minutes)

Add these to your `.env.local` or `.env.production`:

```bash
# Email Configuration
NURTURE_EMAIL_FROM=proposals@authichain.com
CALENDLY_URL=https://calendly.com/authichain/demo
PILOT_PRICE=$2,999
CRON_SECRET=your-secure-random-string-here

# Nurture Timing (milliseconds)
NURTURE_POSITIVE_DELAY_MS=7200000   # 2 hours
NURTURE_REMINDER_DAYS=7

# Reply classifier (optional paid LLM). When unset, local Ollama then heuristic.
# OPENAI_API_KEY=sk-...
# OLLAMA_HOST=http://127.0.0.1:11434
# OLLAMA_MODEL=llama3.2

# Resend (already in ENV, verify it's set)
RESEND_API_KEY=re_...
```

> **Note**: The `CRON_SECRET` is used to verify cron requests. Generate a strong random string:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Phase 3: Database Migration (5 minutes)

### Option A: Use Supabase CLI (Recommended)

1. Run migrations:

   ```bash
   supabase db push
   ```

   This will apply the schema changes from `src/db/schema.ts`

2. Verify tables were created:
   ```bash
   supabase db list-tables
   ```
   You should see: `inbound_replies`, `reply_sequences`

### Option B: Manual SQL (If CLI unavailable)

Copy and paste into Supabase SQL Editor:

```sql
-- Add fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sentiment VARCHAR(32);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMP;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS objection_type VARCHAR(64);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS nurture_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS proposals_sent INT DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS replies_received INT DEFAULT 0;

-- Create inbound_replies table
CREATE TABLE IF NOT EXISTS inbound_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id INT REFERENCES leads(id),
  lead_email VARCHAR(320) NOT NULL,
  sender_name VARCHAR(256),
  subject VARCHAR(512),
  body_plaintext TEXT,
  body_html TEXT,
  message_id VARCHAR(256) NOT NULL UNIQUE,
  sentiment VARCHAR(32),
  objection_type VARCHAR(64),
  objection_details TEXT,
  confidence REAL,
  proposal_match_id VARCHAR(64),
  match_confidence REAL,
  status VARCHAR(32) DEFAULT 'new',
  manual_override BOOLEAN DEFAULT FALSE,
  manual_sentiment VARCHAR(32),
  overridden_by INT,
  overridden_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inbound_replies_lead ON inbound_replies(lead_id);
CREATE INDEX idx_inbound_replies_email ON inbound_replies(lead_email);
CREATE INDEX idx_inbound_replies_status ON inbound_replies(status);
CREATE INDEX idx_inbound_replies_sentiment ON inbound_replies(sentiment);

-- Create reply_sequences table
CREATE TABLE IF NOT EXISTS reply_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id INT NOT NULL REFERENCES leads(id),
  reply_id UUID NOT NULL REFERENCES inbound_replies(id),
  template_type VARCHAR(64) NOT NULL,
  sequence_number INT DEFAULT 1,
  status VARCHAR(32) DEFAULT 'pending',
  sent_at TIMESTAMP,
  clicked_at TIMESTAMP,
  next_scheduled_at TIMESTAMP,
  email_subject VARCHAR(512),
  email_body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reply_sequences_lead ON reply_sequences(lead_id);
CREATE INDEX idx_reply_sequences_reply ON reply_sequences(reply_id);
CREATE INDEX idx_reply_sequences_status ON reply_sequences(status);
CREATE INDEX idx_reply_sequences_scheduled ON reply_sequences(next_scheduled_at);
```

---

## Phase 4: Test Webhook Locally (10 minutes)

### Step 1: Start Dev Server

```bash
pnpm dev
```

### Step 2: Send Test Email via Postman/cURL

```bash
curl -X POST http://localhost:3000/api/webhooks/resend-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test.prospect@company.com",
    "subject": "RE: Proposal: Blockchain Auth for Acme Corp",
    "text": "Hi,\n\nThanks for the proposal! We'\''re interested and would like to learn more.",
    "html": "<p>Thanks for the proposal! We'\''re interested and would like to learn more.</p>",
    "messageId": "test-message-123",
    "inReplyTo": null,
    "headers": {}
  }'
```

### Step 3: Verify Response

Expected response:

```json
{
  "success": true,
  "replyId": "uuid-here",
  "sentiment": "positive",
  "matchConfidence": 0.6,
  "leadId": null,
  "action": "manual_review",
  "classifier": {
    "provider": "heuristic",
    "missingSecret": "OPENAI_API_KEY",
    "paidLlmAvailable": false
  }
}
```

### Step 4: Check Database

```sql
SELECT * FROM inbound_replies ORDER BY created_at DESC LIMIT 1;
SELECT * FROM reply_sequences WHERE status = 'pending';
```

---

## Phase 5: Set Up Cron Job (5 minutes)

The nurture cron runs every 2 hours via your platform's cron service.

### For Cloudflare (current platform)

The edge router has one hourly cron trigger, fanned out by
`worker-app/cron-dispatch.ts`. Once `/api/cron/nurture-replies` is ported,
add the job there with schedule `0 */2 * * *`. It sends email to prospects,
so it belongs in GROUP B ("HELD") in `worker-app/wrangler.toml` until it is
deliberately cleared. There is no `vercel.json` cron any more.

### For other platforms (AWS Lambda, Google Cloud, etc.)

Create a scheduled task that POSTs to:

```
POST /api/cron/nurture-replies
Header: Authorization: Bearer ${CRON_SECRET}
```

---

## Phase 6: Configure Sales Dashboard (5 minutes)

### Grant Access to Sales Team

1. In your auth system (Clerk, Auth0, etc.), ensure sales team members have role: `sales` or `admin`
2. Share dashboard URL: `https://your-domain.com/dashboard/inbound-replies`
3. Sales team can now:
   - View all incoming replies
   - Filter by sentiment, status, objection type
   - Mark as "Contacted", "Deal Won", or "Disqualified"
   - Manually override AI sentiment classification

---

## Phase 7: Start Sending Proposals with Correct From Address (5 minutes)

### Update Proposal Email Template

When your outbound proposal script sends emails, ensure:

1. **From Address**: `proposals@authichain.com` (or configured NURTURE_EMAIL_FROM)
2. **Subject Line**: Should include prospect company name for matching

   ```
   Example: "Proposal: Blockchain Auth for Acme Corp"
   ```

3. **Add tracking headers** (Resend will preserve these):
   ```
   X-Proposal-ID: {proposal_uuid}
   X-Prospect-Email: {prospect_email}
   ```

Example outbound email setup:

```typescript
// In your proposal send script
await sendEmail({
  to: "prospect@company.com",
  from: "proposals@authichain.com",
  subject: `Proposal: Blockchain Auth for ${prospect.company}`,
  html: proposalHTML,
  // Include proposal ID in headers for tracking
  headers: {
    "X-Proposal-ID": proposalId,
    "X-Prospect-Email": prospect.email,
  },
});
```

---

## Testing Checklist

### ✓ Email Capture

- [ ] Send test proposal email from `proposals@authichain.com`
- [ ] Reply from test email address
- [ ] Reply appears in `inbound_replies` table within 2 minutes
- [ ] Sentiment classification is accurate

### ✓ Matching

- [ ] Reply with subject "RE: Proposal: ..." matches original proposal
- [ ] Match confidence shown in dashboard
- [ ] Unmatched replies flagged for review

### ✓ Sentiment Classification

- [ ] Positive reply classified as "positive"
- [ ] Objection about budget classified as "objection / budget"
- [ ] Confidence score reasonable (0.7-1.0 for clear cases)

### ✓ Auto-Nurture

- [ ] Positive reply creates nurture sequence
- [ ] Cron job runs at scheduled times
- [ ] Follow-up email sent to prospect
- [ ] Reply sequences table shows "sent" status

### ✓ Dashboard

- [ ] Sales team can access /dashboard/inbound-replies
- [ ] Filters work (sentiment, status)
- [ ] Can mark replies as "Contacted" or "Deal Won"
- [ ] Can override sentiment classification

---

## Troubleshooting

### Issue: Webhook not receiving emails

**Cause**: Resend route not configured or URL incorrect

**Fix**:

1. Verify Resend route points to correct URL (including protocol https://)
2. Check Resend dashboard → Domains → Logs for failed deliveries
3. Test webhook manually with cURL (see Phase 4)
4. Ensure domain is verified in Resend

### Issue: Sentiment always "neutral"

**Cause**: The classifier fail-closes to `neutral` when the copy is ambiguous, or when every LLM backend failed and the heuristic found no strong signal. This is intentional — the nurture cron must not auto-send on a weak read.

**Fix**:

1. `GET /api/webhooks/resend-inbound` and read `classifier.missingSecret`. If it is `OPENAI_API_KEY`, the paid LLM is unset; the path is still live via Ollama/heuristic.
2. For a clear sample, POST a body that includes "very interested" or "too expensive" and confirm `classifier.provider` is `heuristic` (or `openai` / `ollama`).
3. Optional: set `OPENAI_API_KEY`, or run local Ollama (`ollama serve` + `ollama pull llama3.2`) and set `OLLAMA_HOST`.
4. Neutral/negative replies are **not** drafted or auto-sent. Review them at `/dashboard/inbound-replies`. This webhook does not write HubSpot.

### Issue: Nurture emails not sending

**Cause**: Cron job not running or sendEmail failing

**Fix**:

1. Verify the cron job is registered in `worker-app/cron-dispatch.ts` and the edge-router cron trigger is enabled
2. Check `/api/cron/nurture-replies` logs
3. Verify `RESEND_API_KEY` is set
4. Check reply_sequences table for "pending" entries
5. Manually trigger cron with:
   ```bash
   curl -X GET https://your-domain.com/api/cron/nurture-replies \
     -H "Authorization: Bearer ${CRON_SECRET}"
   ```

### Issue: Dashboard not loading

**Cause**: Missing API route or auth issue

**Fix**:

1. Verify `/api/dashboard/replies` route exists
2. Check sales team user has auth session
3. Verify role is "sales" or "admin"
4. Check browser console for API errors

---

## Production Checklist

Before going live with 258 proposals:

- [ ] All 3 environment variables set (RESEND_WEBHOOK_SECRET, ANTHROPIC_API_KEY, NURTURE_EMAIL_FROM)
- [ ] Database migration applied to production
- [ ] Resend inbound route points to production URL (not localhost)
- [ ] Cron job scheduled and tested
- [ ] Sales team dashboard URL shared
- [ ] Test proposal sent and reply captured successfully
- [ ] Auto-nurture email received by test prospect
- [ ] Backup/monitoring set up for inbound_replies table

---

## Monitoring & Analytics

### Key Metrics to Track

1. **Reply Capture Rate**: `COUNT(*) FROM inbound_replies` / 258 proposals
2. **Sentiment Distribution**: `GROUP BY sentiment` on inbound_replies
3. **Nurture Effectiveness**: `COUNT(*) WHERE status = 'deal_won'` / replies
4. **Average Time to Reply**: `AVG(created_at - proposal_sent_at)`
5. **Match Accuracy**: `COUNT(*) WHERE match_confidence > 0.8` / total replies

### Query Examples

```sql
-- Daily inbound reply count
SELECT DATE(created_at), COUNT(*)
FROM inbound_replies
GROUP BY DATE(created_at);

-- Sentiment breakdown
SELECT sentiment, COUNT(*) as count
FROM inbound_replies
GROUP BY sentiment;

-- Pending nurture sequences
SELECT template_type, COUNT(*) as pending
FROM reply_sequences
WHERE status = 'pending' AND next_scheduled_at <= NOW()
GROUP BY template_type;

-- Deals won from replies
SELECT COUNT(*) as deals_won
FROM inbound_replies
WHERE status = 'deal_won';
```

---

## FAQ

**Q: How does the system match replies to proposals?**
A: Three strategies in order:

1. Exact email match (highest confidence)
2. Subject line fuzzy match (looks for company name)
3. No match (flagged for manual review)

**Q: Can I customize nurture email templates?**
A: Yes! Edit `src/lib/email-templates/index.ts` to change subject/body. Templates use lead name and company for personalization.

**Q: What if a prospect replies but they're not in the database?**
A: Reply is still captured with `leadId = null` and shown in dashboard as "unmatched". Sales team can manually review and update.

**Q: How long are emails stored?**
A: By default, emails are kept indefinitely in `inbound_replies`. Add a job to auto-purge after 90 days for GDPR compliance:

```sql
DELETE FROM inbound_replies WHERE created_at < NOW() - INTERVAL '90 days';
```

**Q: Can I pause nurture for specific leads?**
A: Yes! Set `nurturePaused = true` on leads table. Cron job will skip that lead.

---

## Support

For issues or questions:

1. Check logs: `tail -f ~/.pm2/logs/authichain-out.log`
2. Test webhook: See Phase 4 cURL example
3. Review database: Run SQL queries in Supabase console
4. Check Resend dashboard for email delivery status

---

## Next Steps

1. **Customize email templates** for your specific use case
2. **Set up monitoring** (Datadog, LogRocket) to track reply rate vs. proposal send rate
3. **A/B test** different nurture templates to optimize close rate
4. **Integrate with Stripe** to auto-create checkout sessions for interested prospects
5. **Add Slack notifications** when high-confidence deals come in
