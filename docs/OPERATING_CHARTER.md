# Operating charter — the autonomous stack

This file tells every agent, workflow and human what runs on its own and what
waits for the owner. Where an older doc disagrees, this file and
`.github/autonomy.json` win.

## Principles

- Nothing that charges, contacts, migrates or re-points runs without a written rule here.
- Every number shown to the owner is read live from its source. A figure that
  was typed in by hand counts as a defect.
- **Silence means healthy.** When something needs a human, the stack opens one
  GitHub issue labelled `ops-alert`. When the stack is green again, it closes that issue.
- Loops are switched on and off in one file, reviewed as a pull request, and can
  be reverted with `git revert`.
- Everything runs on $0 infrastructure: GitHub Actions on a public repo,
  Cloudflare Workers free tier, and GitHub issues for alerts. None of it needs
  the owner's computer to be on.

## The switchboard: `.github/autonomy.json`

Every file in `.github/workflows/` appears in exactly one lane of the manifest.
The `Autonomy reconcile` workflow runs on each merge to main and once a day.
It enables or disables workflows until GitHub matches the manifest. If a PR adds a
workflow without classifying it, the check fails.

| Lane    | What it does                                                                  | Who acts                |
| ------- | ----------------------------------------------------------------------------- | ----------------------- |
| ship    | Build, test, security scan and deploy on push                                 | Automatic               |
| health  | **Loop 1.** Hourly `ops-pulse` plus daily read-only probes                    | Automatic; alerts owner |
| revenue | **Loop 2.** Moves warm leads to checkout, dunning, gov digest, revenue report | Automatic               |
| growth  | **Loop 3.** SEO pages, owned social, listening, gated cold outreach           | Automatic within caps   |
| repair  | **Loop 4.** Classifies failed checks and opens draft fix PRs                  | Automatic; owner merges |
| manual  | Secret binding, backfills, one-off sends                                      | Owner runs by hand      |
| retired | Kept disabled for history                                                     | Nobody                  |

To turn a loop off, change `"on"` to `"off"` for it and merge. That's all.

## What agents may do alone

- Deploy code that passed required checks through the existing Cloudflare deploy workflows.
- Publish SEO and content pages and posts to channels the company owns.
- Follow up with **warm** leads (inbound, replied, or started a checkout) using the live payment links in `src/lib/plans.ts`.
- Open draft PRs with deterministic fixes (format, lint, stale branch).
- Send cold outreach, but only inside the rules in the next section.

## What always waits for the owner

- Price changes, new SKUs, refunds, and any Stripe write other than creating a checkout session.
  One narrow exception: webhook events listed under `stripe_webhooks` in the
  manifest. Merging that line is the approval, and `stripe-webhook-reconcile`
  only ever adds the events listed.
- Production database migrations (see `docs/operations/CLOUDFLARE_FIRST_BASELINE.md`).
- DNS, Cloudflare Access, secrets rotation, and Vercel anything.
- Merging a PR that touches security, revenue, schema, or this charter.
- Any claim of a customer, partner, certification or result that isn't verifiable.

## Cold outreach

The owner decided on 2026-09-23 to allow autonomous first-touch email. That
lifts the "leave cold outreach off" freeze recorded in
`docs/autopilot/card-company-outreach.md`, subject to these rules:

1. **Two keys.** A scheduled live send needs `cold_outreach.enabled: true` in the
   manifest **and** the repo variable `OWNER_LIVE_SEND=true`. The flag ships as
   `false`, so switching it on is a deliberate, reviewable change.
2. **Cap.** At most `max_new_prospects_per_day` (default 10) live sends per
   weekday run. Segments rotate by weekday and never include `all`, `partners`
   or `high_leverage`.
3. **Breaker.** Before every scheduled run, `deliverability-breaker.mjs` reads
   the last 7 days of Resend events. It forces a dry run if:
   - the bounce rate is above 3% (once there are at least 10 sends; this matches the
     success bar in `docs/outreach-deliverability-runbook.md`), or
   - there has been even one spam complaint.

   If Resend can't be read, the breaker fails closed and no mail goes out.

4. **Existing guards stay in force.** `server/outreach/send-guard.ts` still applies:
   - only verified or opt-in addresses; no guessed addresses and no role inboxes
   - a CAN-SPAM footer and physical address, fail-closed
   - an opt-out link
   - a check that the domain can receive mail (MX)
   - send-history dedupe
5. **Truth.** No invented customers, certifications, results or urgency.
   Templates live in `scripts/lib/b2b-templates.ts`.
6. **Known history.** The earlier automated campaigns got zero replies at a
   16% bounce rate. The cause was guessed addresses (see
   `.claude/skills/manual-outreach-playbook/SKILL.md`). The provenance gate and
   the breaker exist so that doesn't happen again. Hand-crafted outreach using
   the manual playbook stays the main route to closing a deal.

## Every procedure, end to end

| Stage   | Procedure                                    | Runs on its own via                                                                           | Owner's part                                      |
| ------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Acquire | SEO pages, owned social, listening           | `gen-seo-pages`, `content-publish`, `marketing-autonomous`, `reddit-monitor`, `ghost-traffic` | None                                              |
| Acquire | Cold first-touch email                       | `b2b-outreach` (switch, cap, breaker, latch)                                                  | Flip the switch once; approve resume after a trip |
| Acquire | Government opportunities                     | `gov-ingest`/`score`/`proposals`/`notify`, `email-proposals`                                  | Sign and submit bids                              |
| Convert | Warm lead to checkout link, proposals        | `revenue-cycle`, `agentz-orchestration`                                                       | None                                              |
| Convert | Abandoned-cart recovery                      | Stripe webhook `checkout.session.expired`                                                     | Re-enable that event on the webhook endpoint      |
| Fulfil  | Provision after payment (DPP, plans)         | Stripe webhook `checkout.session.completed` → `fulfillDppPaidSession`                         | None                                              |
| Fulfil  | Check that every paid checkout was fulfilled | `ops-pulse` fulfilment watchdog (hourly)                                                      | Act on the alert if one fires                     |
| Retain  | Failed payment, dunning, win-back            | webhook `invoice.payment_failed`, `revenue-cycle` dunning, `winback`                          | Create a win-back promo if you want one           |
| Operate | Sites, money path, loops health              | `ops-pulse`, smoke/health gates                                                               | Act on `ops-alert` issues                         |
| Operate | Keep workflows matching the plan             | `autonomy-reconcile`                                                                          | Edit `.github/autonomy.json`                      |
| Operate | Fix broken checks                            | `ci-repair-loop` (draft PRs)                                                                  | Merge                                             |
| Report  | Weekly numbers + what's waiting              | `owner-digest` (email)                                                                        | Read it                                           |
| Improve | Copy, outreach and alert suggestions (Gemma) | `gemma-loops` on the self-hosted `lan-gemma` runner                                           | Apply what you like in a PR                       |

## The approval queue

When a loop hits something on the "always waits for the owner" list, it opens
**one** issue labelled `approval-needed`. You answer by adding the label
`approved` or `denied`. Only a label added by the owner counts. The loop checks
again on its next run. `scripts/autonomy/approvals.mjs` does this:

- `gate`: a one-time decision.
- `latch`: holds a loop off until you approve resuming. Cold outreach uses it
  after the deliverability breaker trips.

Keep request text public-safe: no emails, amounts or secrets.

Every pending approval also appears in the owner digest email. So a normal week
needs nothing from you except reading one email. The rare week that does need
you comes with a list of decisions.

## Where to look

- **Your inbox**: the owner digest arrives on Mondays, and on any day something is waiting on you.
- **Command Center**: `dashboard.authichain.com` shows live money, leads, loops and sites.
- **Alerts**: open issues labelled `ops-alert` or `approval-needed`.
- **Loop details**: the job summary of each run in GitHub Actions.

## Secrets and variables

No new secrets are required. Each item below falls back to something that already exists.

| Name                     | Kind   | Default when unset                              | Purpose                                                                 |
| ------------------------ | ------ | ----------------------------------------------- | ----------------------------------------------------------------------- |
| `STRIPE_READ_KEY`        | secret | `STRIPE_SECRET_KEY` (already set)               | Recommended: a restricted, read-only key for the dashboard and monitors |
| `FOUNDER_EMAILS`         | secret | `founder_emails` in `.github/autonomy.json`     | Charges from these don't count as revenue or trigger alerts             |
| `OWNER_EMAIL`            | secret | `owner_email` in `.github/autonomy.json`        | Where the digest goes                                                   |
| `DASHBOARD_GITHUB_TOKEN` | secret | Unauthenticated, cached for 5 minutes           | Fresher loop status on the dashboard                                    |
| `WINBACK_PROMO_CODE`     | env    | Not set, so win-back emails promise no discount | Set only once that promotion code exists in Stripe                      |

## Gemma (local model)

Gemma runs in LM Studio on the owner's network (default
`http://192.168.254.10:1234`, model `google/gemma-4-e4b`). `gemma-loops.yml`
runs three jobs on a self-hosted runner labelled `lan-gemma`:

- **Copy review**, daily: reads the live pricing and landing pages and keeps
  one `gemma` issue of rewrite suggestions for the paid offers.
- **Outreach review**, weekdays before `b2b-outreach`: suggests clearer
  versions of the email templates. It reads template source only, never
  prospect data, and doesn't touch the send gates.
- **Alert triage**, hourly: while an `ops-alert` issue is open, it comments a
  diagnosis of each failed main-branch run, once per run.

Gemma only writes suggestions. It never merges, sends, charges or edits code.
The workflow never runs on pull requests, because this repo is public and a
fork must not be able to run code inside the owner's network.

To turn it on:

1. Register a self-hosted runner for this repo on a machine that can reach
   LM Studio (Settings → Actions → Runners → New self-hosted runner), and give
   it the extra label `lan-gemma`.
2. Optional: set the repo variables `LOCAL_LLM_URL` and `LOCAL_LLM_MODEL` if
   they differ from the defaults.
3. Run `Gemma loops` by hand once with `dry_run` checked, and read its output.
4. Change `"gemma-loops.yml": "off"` to `"on"` in `.github/autonomy.json` and merge.

## Database on the app Worker

Stripe webhooks for `authichain.com` run on the Cloudflare app Worker, which
has no `DATABASE_URL`. That no longer blocks anything:

- **Audit rows** fail open.
- **Subscription records** (upsert, status change, lookup) are written to the same
  `public.subscriptions` table over Supabase REST (`server/subscriptions-rest.ts`),
  using the Supabase credentials the Worker already has.
- **Paid DPP fulfilment** already worked without a database.
- **A failed state write** still returns an error, so Stripe retries it. The
  hourly fulfilment watchdog alerts if any paid checkout is left unhandled.
