# StrainChain Outreach Activation Guide

**Goal:** Get the Michigan cannabis outreach pipeline firing in under 2
hours, with a no-sales-calls CTA (direct Stripe payment link for the $299
AuthiChain BTC Auth product). Every piece below already exists in the
repo — this doc is the ignition sequence.

## Pre-flight checklist

Before running anything, confirm you have:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` in env
- [ ] `SUPABASE_SERVICE_ROLE_KEY` in env (service role, not anon)
- [ ] A physical mailing address for the CAN-SPAM footer (`OUTREACH_PHYSICAL_ADDRESS`)
- [ ] Your sender name and reply-to email (`OUTREACH_SENDER_NAME`, `OUTREACH_SENDER_EMAIL`)
- [ ] Resend account with a verified domain (for the outbound send)
- [ ] The `outreach-queue-worker.authichain2026.workers.dev` Cloudflare worker is deployed
- [ ] Make.com account with the scenario from `make-scenarios/outreach-queue-daily-sender.json`

## Step 1 — Fill in missing contact emails (30 min)

The list in `app/outreach/michigan-dispensaries/page.tsx` has 15 targets.
Only two (Lume, Gage) have real email addresses. The other 13 have empty
email fields and need manual lookup before sending.

For each company, look up the named contact via:

1. Company website `/about` or `/team` page
2. LinkedIn search: `site:linkedin.com "{{company}}" "{{contact_title}}"`
3. Hunter.io / Apollo / Rocketreach (2-minute lookup per contact)
4. Generic fallbacks: `info@{{domain}}`, `hello@{{domain}}`, `sales@{{domain}}`

Fill the emails into `scripts/seed-michigan-outreach.ts` in the
`MICHIGAN_TARGETS` array. Re-run the dry run after each update.

## Step 2 — Dry-run the seed script (2 min)

```bash
cd /path/to/AuthiChain
npx tsx scripts/seed-michigan-outreach.ts
```

You should see:

- Total / sendable / missing counts
- A preview of the first rendered email (subject + body + scheduled time)
- A list of any contacts still missing an email address

## Step 3 — Set the CAN-SPAM env vars + commit to Supabase (5 min)

```bash
export OUTREACH_SENDER_NAME="Z"
export OUTREACH_SENDER_EMAIL="z@authichain.com"
export OUTREACH_PHYSICAL_ADDRESS="123 Main St, Detroit MI 48226"
export OUTREACH_UNSUBSCRIBE_URL="https://authichain.com/unsubscribe"

npx tsx scripts/seed-michigan-outreach.ts --commit
```

This inserts each target into two Supabase tables:

- `network_contacts` — the CRM entry (name, company, title, email, notes)
- `leads` — the funnel-tracking entry (email + `source=michigan_outreach_<tier>`)

Both tables already exist per `supabase/migrations/20260407_strainchain_schema.sql`
and `supabase/migrations/20260320_leads.sql`. The script uses
`upsert` on email, so re-running is idempotent.

## Step 4 — Wire the outreach queue (the missing 10%)

`seed-michigan-outreach.ts` inserts the contact data into Supabase, but
the actual **send queue** lives in Cloudflare D1 behind
`outreach-queue-worker.authichain2026.workers.dev`. You need to POST
each `{to, subject, body, scheduled_at}` payload to the worker to stage
the outbound.

Two ways to do this:

### Option A — Add a POST loop to the seed script

Extend `scripts/seed-michigan-outreach.ts` with a `fetch` call after the
`leads` insert:

```ts
await fetch(
  "https://outreach-queue-worker.authichain2026.workers.dev/enqueue",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.INTERNAL_API_KEY!,
    },
    body: JSON.stringify({
      to: t.email,
      subject: renderSubject(t),
      body: renderBody(t, leadId),
      scheduled_at: scheduledAt(t.tier),
      campaign: "michigan_btc_auth_299",
    }),
  }
);
```

**Caveat:** verify the exact endpoint name (`/enqueue` vs `/add` vs
`/queue`) and the expected payload shape against the worker source before
running. The Make.com scenario file only documents the `/send` endpoint
(which processes the queue), not the enqueue path.

### Option B — Insert directly into D1 via wrangler

If the worker uses a D1 database with a known schema, you can skip the
HTTP layer and insert rows directly:

```bash
npx wrangler d1 execute <DB_NAME> --remote \
  --command "INSERT INTO outreach_queue (to_email, subject, body, scheduled_at, status, campaign) VALUES (...)"
```

## Step 5 — Activate the Make.com scheduler (5 min)

1. Log into Make.com
2. Import the scenario from `make-scenarios/outreach-queue-daily-sender.json`
3. Add the `INTERNAL_API_KEY` env variable to the scenario
4. Click **Activate** on the scenario
5. Confirm the schedule shows "Daily at 9:00 UTC"

From this point forward, the worker polls the D1 `outreach_queue` table
at 9am UTC every day for rows where `status = 'pending'` and
`scheduled_at <= now()`, and sends each one via Resend. Free plan is
3000 emails/day.

## Step 6 — Monitor day-7 success criteria

| Metric                 | How to check                                                               | Target           |
| ---------------------- | -------------------------------------------------------------------------- | ---------------- |
| Opens                  | Resend dashboard → Michigan campaign                                       | 40-60%           |
| Clicks on Stripe link  | Stripe dashboard → payment link analytics                                  | 5-15% of opens   |
| Clicks on walkthrough  | Google Analytics / Cloudflare analytics on `/strainchain/demos/cultivator` | 5-15% of opens   |
| **Paid $299 BTC Auth** | Stripe dashboard → `AuthiChain BTC Auth` product                           | **1+ = success** |
| Unsubscribes           | `leads` table status or Resend dashboard                                   | <5%              |

**7-day checkpoint logic:**

- ✅ 1+ paid order → the offer works. Scale the list beyond Michigan.
- ⚠️ Opens but no clicks → subject line is fine but offer is weak. Rewrite body.
- ⚠️ Clicks but no purchase → pricing page / Stripe friction. Check that the direct payment link actually loads on mobile.
- ❌ No opens → deliverability is broken. Warm up the sending domain, check SPF/DKIM/DMARC, reduce volume.
- ❌ High unsubscribe rate (>10%) → list is wrong. Pivot off dispensaries.

## What NOT to add to this flow

Resist adding any of these — they all push the funnel back toward sales calls:

- ❌ "Book a 15-minute call" CTA
- ❌ Calendly / Cal.com link
- ❌ "Reply if interested" language
- ❌ "Custom quote available" framing
- ❌ Multi-touch drip sequence (yet — test the first wave first)
- ❌ Retargeting-only pitches that require contact info capture

The whole point of this no-calls design is that **the cold email is the
entire funnel**: subject → body → Stripe link → purchase. If it doesn't
close in a single email, change the email, not the funnel.

## Related files

- Cold email copy: [`cold-email-michigan.md`](./cold-email-michigan.md)
- Seed script: [`../../scripts/seed-michigan-outreach.ts`](../../scripts/seed-michigan-outreach.ts)
- Dispensary list (source of truth): [`../../app/outreach/michigan-dispensaries/page.tsx`](../../app/outreach/michigan-dispensaries/page.tsx)
- Make.com scheduler: [`../../make-scenarios/outreach-queue-daily-sender.json`](../../make-scenarios/outreach-queue-daily-sender.json)
- StrainChain economy map (pricing context): [`../../outputs/strainchain-economy-map.md`](../../outputs/strainchain-economy-map.md)
- Supabase schema: [`../../supabase/migrations/20260407_strainchain_schema.sql`](../../supabase/migrations/20260407_strainchain_schema.sql)
