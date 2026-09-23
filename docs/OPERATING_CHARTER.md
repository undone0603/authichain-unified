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

## Where to look

- **Command Center**: `dashboard.authichain.com` shows live money, leads, loops and sites.
- **Alerts**: open issues labelled `ops-alert`.
- **Loop details**: the job summary of each run in GitHub Actions.

## Secrets the Command Center reads (all optional)

| GitHub secret                               | Purpose                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `STRIPE_READ_KEY`                           | Restricted Stripe key: read charges, balance, subscriptions, checkout sessions |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Lead counts from `lead_captures` (already set)                                 |
| `DASHBOARD_GITHUB_TOKEN`                    | Fine-grained, read-only Actions + Issues token; lifts the GitHub rate limit    |
| `FOUNDER_EMAILS`                            | Comma-separated emails whose charges count as self-tests                       |

`deploy-workers.yml` binds these secrets to the worker on each deploy. If a
secret is missing, the page shows "not connected" for that source.
