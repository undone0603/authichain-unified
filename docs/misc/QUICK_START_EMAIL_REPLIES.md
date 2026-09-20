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
# Optional. When unset, classification uses local Ollama then a heuristic.
# OPENAI_API_KEY=sk-...
# OLLAMA_HOST=http://127.0.0.1:11434
# OLLAMA_MODEL=llama3.2
```

### 4. Schedule Cron Job (1 min)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/nurture-replies",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

Deploy: `git push`

---

## Reply classifier (live path)

`POST /api/webhooks/resend-inbound` always classifies a legitimate reply before insert.

Waterfall (no new paid spend):

1. **OpenAI `gpt-4-turbo`** when `OPENAI_API_KEY` is set
2. **Local Ollama** (`POST $OLLAMA_HOST/api/chat`, same ChatOllama host/model as the AgentZ grant handler)
3. **Heuristic** keyword rules (conservative — polite "thanks / what's the price?" stays `neutral`)
4. **Fail-closed `neutral`** if even the heuristic throws

This is the inbound *reply* classifier. Industry AutoFlow (10 verticals + workflows) is a separate path: [`docs/knowledge/AI_AUTOFLOW_STRATEGY.md`](../knowledge/AI_AUTOFLOW_STRATEGY.md) and `shared/industries.ts`. Sales UI: `/dashboard/inbound-replies`.

Webhook side effects (audit):

- Writes `inbound_replies` and updates a matched `leads` row
- Logs sender domain + sentiment
- Does **not** write HubSpot (CRM sync is `/api/crm/sync`)
- Does **not** draft or send a reply; `/api/cron/nurture-replies` later auto-sends only for `positive` / `objection` with a matched lead. Neutral, negative, and unmatched stay on the dashboard for manual review.

`GET /api/webhooks/resend-inbound` reports the backend that will run and the exact missing paid secret (`OPENAI_API_KEY`) when the paid LLM is absent. The path is still live via Ollama/heuristic.

---

## Test It

Probe which backend will run (no database write):

```bash
curl http://localhost:3000/api/webhooks/resend-inbound
```

If `classifier.missingSecret` is `"OPENAI_API_KEY"`, the paid LLM is unset. Classification still runs.

Sample inbound (heuristic will mark this `positive` even with no LLM):

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

Expect `201` with `sentiment`, `action` (`nurture` or `manual_review`), and `classifier.provider` (`openai` | `ollama` | `heuristic` | `neutral_fallback`).

Check database:

```sql
SELECT sentiment, confidence, metadata->>'classifierProvider' AS provider
FROM inbound_replies
ORDER BY created_at DESC LIMIT 1;
SELECT * FROM reply_sequences WHERE status = 'pending';
```

Unit tests (no network, no paid key):

```bash
pnpm exec vitest run src/lib/sentiment-classifier.test.ts
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
