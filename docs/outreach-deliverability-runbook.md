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

### Finding 2 — the sender was right, the credential was wrong

Both outreach scripts defaulted their sender to `@authichain.com`, and every probe with the
configured key came back 403 "domain is not verified". The obvious reading — that §1's DNS
work was never done — was wrong.

**There are two Resend accounts.** The estate stores a second credential,
`RESEND_API_KEY2`, and the domains are split across them. Measured 2026-08-16 by
`verify-outreach-secrets.yml` with `probe_matrix`:

| Key | Sender | Result |
|---|---|---|
| `RESEND_API_KEY` | `hello@strainchain.io` | ✅ CAN SEND |
| `RESEND_API_KEY` | `*@authichain.com` | ❌ domain not on this account |
| `RESEND_API_KEY2` | `hello@authichain.com` | ✅ CAN SEND |
| `RESEND_API_KEY2` | `proposals@authichain.com` | ✅ CAN SEND |
| `RESEND_API_KEY2` | `hello@strainchain.io` | ❌ domain not on this account |
| either | `hello@mail.authichain.com` | ❌ subdomain not registered |

So `authichain.com` **was already fully authenticated** — §1's SPF/DKIM/DMARC work is done,
on the second account. The code simply never knew that credential existed, and a single-key
client cannot express "these two domains live in different accounts."

Note this also means the apex cannot be added to the first account: Resend returns
`The authichain.com domain is registered to another team`. Claiming it would reissue the DKIM
keys and break the account that legitimately holds it. Nothing needed claiming.

The only mail that has actually left came from `hello@strainchain.io`
(12 messages, 2026-07-31 and 2026-08-05; 3 bounced, 0 replies).

### What changed in the repo

| Change | File | Why |
|---|---|---|
| Sender preflight before any send loop | `scripts/lib/resend-preflight.ts` | Probes `delivered@resend.dev` once per sender. A dead key or unverified domain now fails in the first second with a named cause, instead of after the prospect list is burned |
| Per-segment sender addresses | `scripts/b2b-cold-outreach.ts` | A GovChain pitch sent from a cannabis-compliance domain reads as spam. Each segment can send under its own brand via `OUTREACH_FROM_GOVCHAIN` / `_STRAINCHAIN` / `_QRON` |
| Credential resolved per sender | `scripts/lib/resend-preflight.ts` | The preflight probes each configured credential and reports which one Resend accepted, so the send path binds to the account that owns that domain. Chosen over a hand-maintained domain→key table, which would silently drift the moment a domain moved between accounts |
| Defaults restored to real brands | both outreach scripts, both workflows | GovChain/QRON send from `authichain.com`, StrainChain from `strainchain.io`, proposals from `proposals@authichain.com` — all verified, just on different accounts |
| Failed preflight queues instead of dropping | `scripts/b2b-cold-outreach.ts` | Drafts are still written with `status=queued`; `flushQueuedLeads()` drains them once the sender works, with no duplicate outreach |

### Status: resolved 2026-08-16

`RESEND_API_KEY` was rotated and verified (HTTP 200 from `hello@strainchain.io`), and
`RESEND_API_KEY2` covers `authichain.com`. Apollo and HubSpot tokens also return 200. Both
credentials are now passed to every outreach workflow.

To re-check at any time, dispatch **Verify Outreach Secrets** — it probes every configured
sender and fails the run on any rejection. Add the `probe_matrix` input to print the full
key × sender grid when a domain appears to have moved between accounts.

There was no backlog to drain: `flushQueuedLeads()` consumes `status='queued'` and there are
none. The 12 rows from 2026-07-01 are `status='draft'` and predate the queueing behaviour.

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

---

## Address provenance research, 2026-08-16

Every contact address in `scripts/b2b-cold-outreach.ts` was checked against what the
company itself publishes. **None of the seven hand-written addresses was published by its
owner.** All were plausible-shaped guesses — `compliance@`, `innovation@`, `b2b@`,
`franchise@` — which is the exact failure mode `server/outreach/send-guard.ts` exists to
stop, and a likely contributor to the 37% bounce rate on the July batch.

| Target | Hand-written | Verdict | What the company actually publishes |
|---|---|---|---|
| Trulieve | `compliance@trulieve.com` | guess | `ir@`, `media@`; staff mail `first.last@` |
| Curaleaf | `compliance@curaleaf.com` | guess | `IR@`, `media@` |
| Harvest Health | `compliance@harvestinc.com` | **defunct** | acquired by Trulieve 2021-10-01 |
| FASTSIGNS | `innovation@fastsigns.com` | guess | **`franchiseinfo@fastsigns.com`** |
| MOO | `product@moo.com` | guess | **`inquiries@moo.com`** |
| 4imprint | `b2b@4imprint.com` | guess | `sales@` (role inbox), `webart@` (order support) |
| Signarama | `franchise@signarama.com` | guess | none — intake is a web form |

### The general finding

**These companies do not publish a correct-desk email for cold first contact.** They route
it through web forms, or publish only role inboxes — `sales@`, `media@`, `ir@`,
`webmaster@` — which the guard blocks, or which reach the wrong desk. Pitching a compliance
product to investor relations is worse than not sending.

The same holds for the GovChain targets: CTC, ITC Federal, RealmOne and Integrated Data
Services all use contact forms, and what is discoverable is only their staff *email format*
(`last+initial@ctc.com`, `first.last@realmone.com`, `f.last@itcfederal.com`).

**A format is not an address.** Synthesising `jdoe@ctc.com` from a known pattern is
pattern-guessing — the precise thing that produced the fabricated-CRM problem. Do not do it,
and do not treat RocketReach / LeadIQ / ZoomInfo / ContactOut / Seamless output as
"published": those are data brokers, not the company, and an address from them is
`scraped` provenance at best.

### What to do instead

1. **Apollo is the working path.** `APOLLO_API_KEY` is configured and authenticating
   (HTTP 200 on the last verify run). Blank-email targets resolve through it at run time and
   are upgraded to `apollo_verified`, which the guard accepts. This is why the targets are
   blanked rather than filled with guesses.
2. **The two genuinely published addresses are in use** — FASTSIGNS' `franchiseinfo@` and
   MOO's `inquiries@`, marked `published_contact`. Both were confirmed to clear the guard;
   a generic `info@` still does not, even when published, which is intended.
3. **Web forms and LinkedIn are the honest fallback** for the rest. Every target already
   carries a LinkedIn URL. That is a different channel from this script, not a gap in it.
