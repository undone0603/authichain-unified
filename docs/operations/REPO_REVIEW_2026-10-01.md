# Repo review — 2026-10-01

A full review of `authichain-unified` and `authichain-ai-business-manager`, with
everything fixable from a session fixed on branch `ccr-e068c356-cm1kon` in each
repo. What is left is listed under **Owner actions** and **Deferred**, each with
the reason it was not done here.

## State at review

`main` (b88feda) was red on four checks:

| Check                                             | Root cause                                                                                                                                                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, CI Main                                     | Prettier: `.github/autonomy.json` was unformatted. The `.prettierignore` entry for `.github/founder-business.json` had a literal `\n` in it, so the file was never actually ignored.                                                         |
| Autonomy reconcile                                | `cloudflare-estate-audit.yml` was in a stray top-level `"health"` key, outside `lanes`.                                                                                                                                                      |
| CI repair loop (the only item on ops-alert #1299) | It passed the whole `git diff` through an env var, so the kernel refused it ("Argument list too long"). It also formatted all of `src/`, about 470 files that `lint:ci` never checks, so the classifier would have refused that diff anyway. |
| Cloudflare estate audit                           | The ledger points at `workers/authichain-revenue-worker`, which does not exist. **PR #1424 already fixes this.**                                                                                                                             |

Because Lint stopped early, its later steps never ran. Separately, 25 script
test files exist but only 4 ran in CI. One that never ran
(`estate-drift.test.ts`) was failing: two Workers recovered into the repo on
2026-09-29 were still listed as off-repo in `config/estate.json`.

## Fixed (authichain-unified)

| Area         | Finding                                                                                                                                                                                                            | Fix                                                                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI           | Prettier, stray manifest key, broken ignore line                                                                                                                                                                   | `.github/autonomy.json`, `.prettierignore`                                                                                                                                                                                                                                         |
| CI           | Repair loop crashes and formats the wrong files                                                                                                                                                                    | `.github/workflows/ci-repair-loop.yml` now passes the diff through files and formats exactly the `lint:ci` targets. New classifier cases are in `scripts/__tests__/ci-repair-classify.test.ts`.                                                                                    |
| CI           | Script tests never ran                                                                                                                                                                                             | `lint.yml` now runs ci-repair-classify, typecheck-ratchet, estate-drift and the `node:test` suites                                                                                                                                                                                 |
| Ops          | ops-pulse read only the first 100 workflows (the repo has 98)                                                                                                                                                      | `scripts/autonomy/ops-pulse.mjs` reuses the paginated `fetchRemoteWorkflows`                                                                                                                                                                                                       |
| Ops          | Two recovered Workers were still listed as off-repo                                                                                                                                                                | `config/estate.json`. Their provenance notes remain in each `wrangler.jsonc` header.                                                                                                                                                                                               |
| **Security** | A Supabase **service_role** key was committed to this public repo                                                                                                                                                  | `scripts/remediate_dpp.py` now reads it from env. **The key itself must be rotated** (see below).                                                                                                                                                                                  |
| **Security** | A Resend API key was in plain text                                                                                                                                                                                 | Redacted in `agentz/workflows/registry.yaml`. **It must be rotated.**                                                                                                                                                                                                              |
| Security     | gitleaks missed both keys                                                                                                                                                                                          | `.gitleaks.toml`: the Supabase rule now matches `service_role` JWTs (anon keys are public by design), and the Resend rule now accepts `re_<8>_<24+>` keys. Checked: 0 findings on the current tree, and both old values are caught.                                                |
| **Security** | `POST /api/stripe/portal` opened anyone's billing portal for a posted email                                                                                                                                        | Now uses the session user's email. `return_url` is pinned to our origin (`src/lib/safe-return-path.ts`).                                                                                                                                                                           |
| **Security** | `/api/dashboard/replies` GET/PATCH exposed and changed lead PII without auth                                                                                                                                       | Now owner-only via `src/lib/require-admin-request.ts`, the same gate as `/api/admin/*`                                                                                                                                                                                             |
| **Security** | `/api/email/welcome` was an open mail relay with unescaped HTML                                                                                                                                                    | Now requires `requireInternalSecret`, and `firstName` is escaped                                                                                                                                                                                                                   |
| **Security** | `/api/telegram` accepted forged `successful_payment` updates                                                                                                                                                       | `src/lib/telegram-webhook-auth.ts` fails closed. Both registration scripts now send `secret_token`.                                                                                                                                                                                |
| Security     | `/api/trial-reminder`, `/api/crm/sync` accepted `Bearer undefined` when `CRON_SECRET` was unset                                                                                                                    | Both now use `isCronAuthorized`                                                                                                                                                                                                                                                    |
| Money        | `/api/users`, `/api/settings` (fixture profile with a fake key) and `/api/stripe/checkout` (bypassed `plans.ts`, no callers)                                                                                       | All three return 410                                                                                                                                                                                                                                                               |
| Money        | AgentZ `qron_stripe_links` / `qron_pro_stripe_onboarding` auto-created an off-catalogue $49 "QRON Pro" price                                                                                                       | Both now have `confirm_before_run`, `requires_human_approval` and `risk_class: high`. `setup_cron.ps1` (daily `--all --mode auto`) is removed.                                                                                                                                     |
| Money        | 12 SEO pages advertised `$49/mo` and "Bitcoin L1"                                                                                                                                                                  | Fixed in `content/seo/pages.json` and `scripts/seo-data/industry.cjs`, because the Workers serve that file verbatim. The render-time patch in `src/lib/seo-pages.ts` is removed. A test fails if those phrases return, or if a stated DPP Readiness price differs from `plans.ts`. |
| Money        | Prices not in `plans.ts`: trial reminders ("$29/mo" plus an `EARLYBIRD20` code), a "$199 Single-Project Pilot" (sandbox, AgenticCloser, chatbot prompt), "Reseller ($299/mo)", "from $49" on the QRON home         | Reminders now read `qron_launch` from `plans.ts`. The others are removed, and the chatbot now points to `/pricing`.                                                                                                                                                                |
| Links        | `/order?preset=starmap` (no route), `/tokenomics` and `/proposals` (these only resolve on govchain.us)                                                                                                             | Changed to `/starmap`, `/governance/tokenomics` and `/governance/proposals`                                                                                                                                                                                                        |
| Hygiene      | 3 lint warnings, the stale 2.1 MB `.eslint-report.json`, `eslint-target.json`                                                                                                                                      | Fixed or removed, and both reports are gitignored                                                                                                                                                                                                                                  |
| Hygiene      | Root clutter: `TOML`, the root `deploy-cloudflare.yml` copy, `manual-migration.js` / `patch-schema.js` / `update-schema.js`, `project_info.json`, `supabase-ca.crt` copies, `stripe.ts.bak`, `.ipynb_checkpoints/` | Removed (git history keeps them). `scripts/check-drizzle-migrations.mjs` now also bans the root migration runners.                                                                                                                                                                 |
| Issues       | #1427–#1430 duplicated #1431–#1434                                                                                                                                                                                 | Closed as duplicates                                                                                                                                                                                                                                                               |

## Owner actions (cannot be done from a session)

1. **Rotate the Supabase service_role key** for the production project (QRON-v2), then update every consumer: Vercel, Workers secrets and GitHub secrets. Removing it from HEAD does not un-leak it, because git history is public.
2. **Rotate the Resend key** that was in `agentz/workflows/registry.yaml`, and update n8n and the Workers secrets.
3. After both rotations, add their historical gitleaks fingerprints to `.gitleaksignore`, each with a "rotated YYYY-MM-DD" note. Until then, a red weekly full-history scan is the correct signal.
4. Set `TELEGRAM_WEBHOOK_SECRET` in the app, then run `node scripts/register-telegram-webhook.js`. The bot refuses every update until this is done.
5. Merge **PR #1424** once this lands; its only red checks were the prettier failure fixed here. Then move `cloudflare-estate-audit.yml` from the `ship` lane to `health`.

## Deferred (money, contact or design decisions)

- **PR #1426** (affiliate payouts on): this moves money, so it is the owner's decision.
- ~~**Metered agent billing never bills.**~~ **Fixed in #1456**, behind `STRIPE_AGENT_METER_EVENT` (off until you create the Stripe Meter). The same PR found that the three metered MCP tools returned fixed verdicts ("Status: SECURED.", "Status: COMPLIANT.") for any input. They now answer from `auth_seals` and `verifyDpp`, and only a real answer is metered.
- ~~**The compliance dashboard paywall is client-side.**~~ **Done in #1450.**
  - What it found: there was no `/dashboard/compliance` route and no `enterprise_compliance` plan, and nothing ever set the cookie the gate read.
  - What it builds: a real tier. Entitlement is checked server-side from `profiles` (`src/lib/compliance-access.ts`, `src/lib/compliance-dal.ts`), and the dashboard shows the account's DPP portfolio from live data.
  - The tier stays unpriced and unsellable until you add a `PLANS` entry with a real Stripe price.
- ~~**`/enterprise/checkout`** sold "$500 / month" and posted to a missing API.~~ **Fixed:** it sells the real StrainChain Farm Plan from `plans.ts`, offers the anchor partnership as custom (`/contact`), and lists unbuilt features as roadmap. This follows the pricing decision in `docs/strategy/strainchain-genetics-passport.md` §3.
- ~~**`/api/subscription`** returned fixtures.~~ **Fixed:** it returns the signed-in user's entitlement from `profiles` (401 when signed out) and plans from `plans.ts`. POST returns 410.
- ~~**The QRON dashboard** showed typed-in "300+" edge nodes and "99.97%" uptime.~~ **Fixed:** the Workers count now comes from the dated estate snapshot. Uptime is shown as a goal, "not measured yet", because nothing measures it.
- **Nightstamp SKUs are not in `plans.ts`.** That covers $9/$29/$49 in `src/app/api/starmap/checkout/route.ts` and the $39/$79 print add-ons. Adding them is a pricing decision.
- **Made-in-USA "View Details" link.** `src/app/brand/qron/made-in-usa/page.tsx` links to `/brand/qron/product/<id>`, which has no route. The artwork route is a different entity, so this needs a product page or the link removed.
- **Cross-host links.** `/x402`, `/onboard`, `/generate`, `/protocol` and `/made-in-usa-claim-file` resolve only on hosts whose Worker serves them. Routing intent belongs to the owner.
- **Duplicate worker trees.** `api/` vs `services/api/`, `worker-app/` vs `services/worker-app/`, and `apps/qron-platform/workers/*` each share a deploy name with production. PR #1424 and the estate ledger own this.
- **Smaller items:**
  - `ops/scripts/gen-seo-pages.cjs` is an inert stale copy; it writes under `ops/`.
  - The `any` in `src/lib/affiliate-accrual.ts` is left alone to avoid conflicting with PR #1426.

## Follow-up PRs (same day)

| PR    | What                                                                                                                                                                                                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1450 | Real Enterprise Compliance tier with a server-side gate                                                                                                                                                                                                                                       |
| #1455 | The root Vitest suite runs in CI. It surfaced 11 failing files, including three real bugs: `/generate` served the SPA shell (#1389 commented its handler out with literal `\n`), the retired Stripe alias returned 404 instead of 410, and fallback outreach emails contained a literal `\n`. |
| #1456 | Agent metering via `billing.meterEvents`, behind a flag; the MCP tools answer from real records                                                                                                                                                                                               |
| #1457 | `/api/subscription`, `/enterprise/checkout` and the dashboard tiles now show real data, or a labelled goal                                                                                                                                                                                    |

Still open from this pass: `apps/qron-platform/src/app/api/mcp/route.ts` is an older copy of the MCP route with the same fixed verdicts. No workflow here deploys it, so deleting or porting it is your call.

## authichain-ai-business-manager

Fixed in its own PR on the same branch name:

- **Health alerts:** they now go to one rolling issue that closes itself when every domain is green again.
- **Weekly digests:** each new digest supersedes and closes the previous one.
- **Lost commits:**
  - Every writing workflow now pushes through `scripts/commit-reports.sh`, which rebases onto `main`, retries, and fails the job if the push never lands. The old pattern, `git push || true`, silently dropped any push that came second.
  - A shared concurrency group was considered and rejected: GitHub keeps only one pending run per group, so scheduled runs would have been cancelled.
  - `token-metrics` now has `contents: write`. All 595 of its runs had reported success while their commits never landed.
- **Worker endpoints:**
  - The endpoints now have auth.
  - Worker deploys are dispatch-only until the KV IDs are bound.
- **Report growth:** report pruning applies only to new files, as decided.
- **CI and README:** a basic CI workflow and a README were added.
- **Issues:** the 20 resolved health alerts and the superseded digests are closed.

## How this was verified

```sh
pnpm lint:ci                                   # 0 errors, 476 warnings (was 480)
node scripts/autonomy/reconcile.mjs --check    # 98 workflows classified
pnpm exec vitest run scripts/__tests__/{autonomy,ci-repair-classify,typecheck-ratchet,estate-drift}.test.ts \
  src/lib/{seo-pages,telegram-webhook-auth,safe-return-path,cron-auth,require-internal-secret}.test.ts
node --test scripts/autonomy/*.test.mjs scripts/ci/*.test.mjs
node scripts/typecheck-ratchet.mjs             # at or below baseline
node scripts/check-drizzle-migrations.mjs
python -m pytest agentz/tests                  # 215 passed, 1 skipped
gitleaks dir . --config .gitleaks.toml         # 0 findings
```
