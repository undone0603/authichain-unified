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

## Secrets and variables (all optional; anything missing shows as "not connected")

| Name                                        | Kind     | Purpose                                                                                |
| ------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `STRIPE_READ_KEY`                           | secret   | Restricted Stripe key: read charges, balance, subscriptions, checkout sessions         |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | secret   | Leads and the fulfilment watchdog (already set)                                        |
| `FOUNDER_EMAILS`                            | secret   | Your emails, and `@authichain.com` for smoke aliases; excluded from revenue and alerts |
| `OWNER_EMAIL`                               | secret   | Where the digest goes (falls back to `SALES_NOTIFY_EMAIL`)                             |
| `DASHBOARD_GITHUB_TOKEN`                    | secret   | Fine-grained, read-only Actions + Issues token; lifts the GitHub rate limit            |
| `APP_DATABASE_BOUND`                        | variable | Set to `true` once the app Worker has a database; clears the digest reminder           |
| `WINBACK_PROMO_CODE`                        | env      | Only set once that promotion code exists in Stripe                                     |

`deploy-workers.yml` binds the dashboard's secrets on each deploy.

## Known gap: the app Worker has no database

Stripe webhooks for `authichain.com` run on the Cloudflare app Worker, which
has no `DATABASE_URL`. Paid DPP fulfilment already works without it. Audit
writes now fail open, so abandoned-cart recovery emails go out again. The
following still need a database:

- subscription records (`upsertStripeSubscription`)
- status changes

Until it's wired, these are the safety nets:

- Stripe retries failed deliveries.
- The fulfilment watchdog alerts on any paid checkout whose webhook didn't succeed.

**Wiring the database is an owner action.** It means binding a secret, or
creating a Hyperdrive config per `wrangler.app.jsonc`.
