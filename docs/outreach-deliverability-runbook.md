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
