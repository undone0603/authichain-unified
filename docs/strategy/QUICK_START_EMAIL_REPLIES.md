# Quick Start: Email Reply Capture (5 minutes)

## What This Does

Automatically captures replies to `proposals@authichain.com`, classifies sentiment, and sends smart follow-up emails.

**Result**: 39-77 replies from 258 proposals → 2-8 auto-nurtured deals

---

## 5-Minute Setup

### 1. Database Migration (1 min)
```bash
supabase db push
```
Creates `inbound_replies` and `reply_sequences` tables.

### 2. Resend Route (2 min)
1. Go to [Resend Dashboard](https://resend.com/domains)
2. Select `authichain.com`
3. **Inbound Routes** → Create new route
4. Name: `proposals@authichain.com`
5. Forward to: `https://your-domain.com/api/webhooks/resend-inbound`
6. Save & copy the webhook secret

### 3. Environment Variables (1 min)
Add to `.env.local`:
```
RESEND_WEBHOOK_SECRET=<from Resend dashboard>
NURTURE_EMAIL_FROM=proposals@authichain.com
CALENDLY_URL=https://calendly.com/authichain/demo
CRON_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### 4. Schedule Cron Job (1 min)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/nurture-replies",
    "schedule": "0 */2 * * *"
  }]
}
```

Deploy: `git push`

---

## Test It

```bash
curl -X POST http://localhost:3000/api/webhooks/resend-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@example.com",
    "subject": "RE: Proposal: Blockchain Auth for Test Corp",
    "text": "Thanks! Very interested.",
    "messageId": "test-'$(date +%s)'"
  }'
```

Check database:
```sql
SELECT * FROM inbound_replies ORDER BY created_at DESC LIMIT 1;
SELECT * FROM reply_sequences WHERE status = 'pending';
```

---

## Use It

### Sales Team Dashboard
- URL: `/dashboard/inbound-replies`
- View all incoming replies
- Filter by sentiment/status
- Mark as "Contacted" or "Deal Won"

### Update Proposal Template
When sending proposals, use:
```
From: proposals@authichain.com
Subject: "Proposal: {Solution} for {Company}"
```

---

## That's It!

- ✓ Replies captured within seconds
- ✓ Sentiment classified (positive/objection/etc)
- ✓ Nurture emails sent automatically
- ✓ Dashboard shows all activity

**Next**: Read `INBOUND_EMAIL_SETUP.md` for detailed docs

---

## Files Modified/Created

- `src/db/schema.ts` — New tables + lead fields
- `src/lib/sentiment-classifier.ts` — AI sentiment analysis
- `src/lib/proposal-matcher.ts` — Link replies to proposals
- `src/lib/email-templates/index.ts` — Nurture email templates
- `src/app/api/webhooks/resend-inbound/route.ts` — Webhook handler
- `src/app/api/cron/nurture-replies/route.ts` — 2-hourly nurture job
- `src/app/api/dashboard/replies/route.ts` — Dashboard API
- `src/app/dashboard/inbound-replies/page.tsx` — Sales UI
- `.env.example` — Config variables
- `INBOUND_EMAIL_SETUP.md` — Full documentation
