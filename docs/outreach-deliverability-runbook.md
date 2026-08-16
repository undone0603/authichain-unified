# Outreach Deliverability Runbook

**Created:** 2026-08-07 · Companion to `docs/strategy/INDUSTRY_LEADERSHIP_STRATEGY.md` §6.

## The diagnosis

Outreach has recorded **zero replies, ever**, at a **16% bounce rate**
(`docs/CAPABILITIES.md` cross-cutting risks). Zero is the important number. Bad targeting
and bad copy produce *low* reply rates — 0.5%, 1%. They do not produce zero. Zero across
every campaign means the messages are not reaching inboxes, and no amount of subject-line
testing fixes that.

A 16% bounce rate is itself disqualifying: mailbox providers treat anything above ~2% as a
list-hygiene failure and start routing the whole domain to spam. Every additional send at
that rate makes the next send worse.

## What was changed in the repo

| Change | File | Why |
|---|---|---|
| Disabled the 4-hourly cron | `.github/workflows/outreach-trigger.yml` | Queue exhausted (6/6 sent) — every firing was a no-op burning CI minutes and hiding that outreach is dead |
| Disabled the 8-hourly cron | `.github/workflows/dpp-outreach-trigger.yml` | Same, DPP queue 4/4 sent |
| Added `reply_to`, changed default `from` off `noreply@` | `server/outreach/send-guard.ts` | A cold email from `noreply@` with no reply-to **cannot be replied to at all**. Interested prospects had no path back. This alone guarantees part of the zero. |

Both workflows keep `workflow_dispatch`, so they can still be run by hand. Re-enable the
schedules only after the DNS work below is done **and** the queues are repopulated.

## What has to happen outside the repo (yours — I have no DNS access)

### 1. Authenticate the sending domain

Publish these on the domain you send from. Values in `<angle brackets>` come from your ESP
(Resend, per `send-guard.ts`) — take them from its domain-setup screen, do not invent them.

```
; SPF — one record only. Multiple SPF records = permanent fail.
authichain.com.            TXT   "v=spf1 include:amazonses.com ~all"

; DKIM — Resend gives you the selector and public key.
resend._domainkey.authichain.com.   TXT   "p=<public-key-from-resend>"

; DMARC — start at p=none so you get reports without blocking your own mail.
_dmarc.authichain.com.     TXT   "v=DMARC1; p=none; rua=mailto:dmarc@authichain.com; pct=100"
```

Move DMARC to `p=quarantine` only after two weeks of clean aggregate reports, then to
`p=reject`. Going straight to `reject` on an unverified setup will silently kill your own
mail.

### 2. Separate the sending domain from the app domain

Send cold outreach from a subdomain or a distinct domain — `mail.authichain.com`, or a
dedicated one. If cold outreach damages the reputation of the apex domain, it takes your
transactional mail (receipts, password resets, Stripe notifications) down with it. Keep
those on separate reputations.

### 3. Warm it

A cold domain sending at volume looks exactly like a spam cannon. Ramp: ~20 sends/day in
week one, roughly doubling weekly, and stop escalating if bounce or complaint rates move.
There is no way to skip this, and a warmed domain is worth more than any copy change.

### 4. Set a real From identity

Set `RESEND_FROM` and `RESEND_REPLY_TO` to a monitored human mailbox — a founder's name
outperforms a brand alias on cold email by a wide margin, and someone must actually read
replies. The code defaults added here (`hello@authichain.com`) are placeholders to stop the
`noreply@` bleeding; replace them with the real address.

### 5. Clean the list before the next send

Run every address through verification and drop anything not confirmed deliverable. At 16%
bounce the existing list is the problem; sending to it again re-injures the domain. The repo
already has `server/outreach/email-verify.ts` — use it as a hard gate, not an advisory.

## Then: stop automating and go manual

The estate has 53 AgentZ workflows, a drip sequence, an LLM personalizer, and multiple
schedulers built to scale outreach. None of that is useful yet, because **there is no
message known to work.** Automation multiplies a message; multiplying zero gives zero.

For the first 10 customers: the founder writes ~20 emails a week, by hand, to named Michigan
cannabis operators and MSOs, each referencing something specific about that operator. Track
replies, not sends. When a version starts getting replies, *then* it is worth automating —
and the machinery to do so is already built and waiting.

## Success criteria before re-enabling the crons

1. SPF, DKIM, DMARC all passing (verify with a seed-list test, e.g. mail-tester)
2. Bounce rate under 3% on a verified list
3. A monitored reply-to that a human reads
4. A message that has produced at least one real reply when sent by hand

Until all four hold, the schedules stay off.

---

## Update 2026-08-16: two more failures found underneath the first

The 2026-08-07 diagnosis above ("the messages are not reaching inboxes") was right about the
symptom and incomplete about the cause. Re-checking the live systems found that for most of
this period **nothing was being sent at all**, for two stacked reasons that both fail before
DNS or copy can matter.

### Finding 1 — the stored Resend key is dead

The scheduled B2B outreach runs on 2026-08-03 and 2026-08-10 both failed, every send:

```
⚠️  Resend error for FASTSIGNS: { statusCode: 401, name: 'validation_error', message: 'API key is invalid' }
Totals — attempted: 12 | sent: 0 | send failures: 7
```

The Resend account holds exactly one API key, created 2026-07-20. The value stored in Actions
predates it, so every automated send has been rejected since.

### Finding 2 — the From domain was never verified

The account has **one** verified sending domain: `strainchain.io`. Both outreach scripts
defaulted their sender to `@authichain.com`, which Resend rejects outright. So even after the
key is rotated, every send from those defaults would still fail. The DNS work prescribed in
§1 above was never completed for `authichain.com` — that section remains the fix.

The only mail that has actually left the account came from `hello@strainchain.io`
(12 messages, 2026-07-31 and 2026-08-05; 3 bounced, 0 replies).

### What changed in the repo

| Change | File | Why |
|---|---|---|
| Sender preflight before any send loop | `scripts/lib/resend-preflight.ts` | Probes `delivered@resend.dev` once per sender. A dead key or unverified domain now fails in the first second with a named cause, instead of after the prospect list is burned |
| Per-segment sender addresses | `scripts/b2b-cold-outreach.ts` | A GovChain pitch sent from a cannabis-compliance domain reads as spam. Each segment can send under its own brand via `OUTREACH_FROM_GOVCHAIN` / `_STRAINCHAIN` / `_QRON` |
| Defaults moved to the verified domain | both outreach scripts, `src/app/api/book/route.ts`, both workflows | Ships in a state that can actually send. Override once `authichain.com` is verified |
| Failed preflight queues instead of dropping | `scripts/b2b-cold-outreach.ts` | Drafts are still written with `status=queued`; `flushQueuedLeads()` drains them once the sender works, with no duplicate outreach |

### The one manual step this cannot do for itself

Generate a key at <https://resend.com/api-keys> and store it as the `RESEND_API_KEY` Actions
secret (the **Set Outreach Secret** workflow does this). Then run **Verify Outreach Secrets**
to confirm, and dispatch **B2B Cold Outreach** with `flush_queued=true` to drain the backlog.

Until that key is rotated, the preflight will keep the pipeline red and honest rather than
green and empty — which is the state it was in for the previous three months.

## Related: the lead table was measuring fabricated demand

Two separate sources were writing undeliverable addresses into `leads`, so funnel metrics
counted rows that could never convert:

- **The gov engine synthesised contacts** by slugifying the SAM.gov office hierarchy —
  `procurement@homeland-security,-department-of.us-coast-guard.hq-contract-operations-(cg-912)(000.gov`.
  `scripts/qualify-leads.ts` now requires a real `contact_email` on the opportunity and skips
  the rest (`scripts/lib/contact-email.ts`, calibrated against the 1,739 genuine agency
  addresses already in `gov_opportunities`).
- **The `/book` form had no bot defence.** Every `book_page` lead on record was automated —
  gmail dot-trick addresses with random company names — all landing as `demo_requested`,
  indistinguishable from real interest. A honeypot field plus a minimum fill time now drop
  those silently (`src/app/api/book/bot-detection.ts`).

Neither change adds a customer. Both stop the pipeline from reporting demand that does not
exist, which is a precondition for the manual-outreach phase above being measurable.
