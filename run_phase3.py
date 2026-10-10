=== 1. Checking for Phase 3 plans, docs, backlog ===
Found related files: ['./run_phase3.py', './packages/shared/subscriptionPlans.ts', './apps/qron-platform/src/lib/plans.ts', './apps/qron-platform/src/lib/autonomous-controller.ts', './apps/qron-platform/src/app/api/plans/route.ts', './docs/LAUNCH_HIGH_VALUE_BACKLOG.md', './docs/operations/AUTONOMOUS_REVENUE_LOOP.md', './docs/operations/AUTONOMOUS_AI_STACK.md', './docs/operations/MIGRATION_PLAN.md', './docs/strategy/ROADMAP.md', './docs/strategy/AUTHICHAIN_ZERO_BUDGET_BUYER_TRAFFIC_PLAN_2026-09-20.md', './docs/strategy/dpp-vertical-roadmap.md', './docs/strategy/mcp-app-roadmap.md', './docs/superpowers/plans/2026-07-23-cloudflare-hybrid-frontend.md', './docs/superpowers/plans/deploy-consolidation-2026-06-26.md', './docs/superpowers/plans/worker-inventory.md', './docs/superpowers/plans/2026-04-28-pricing-reconciliation.md', './docs/superpowers/plans/2026-07-29-guardrail-caps-layer.md', './docs/superpowers/plans/2026-07-22-cloudflare-workers-migration.md', './docs/superpowers/plans/2026-04-27-webhook-idempotency.md', './docs/superpowers/plans/2026-08-01-certify-blockchain-verified-qr.md', './docs/superpowers/plans/2026-04-27-ecosystem-consolidation.md', './docs/superpowers/plans/worker-status-2026-04-27.md', './docs/superpowers/plans/2026-08-07-x402-agent-verification.md', './docs/superpowers/plans/2026-09-30-gs1-resolver-autonomous-ops.md', './docs/superpowers/plans/2026-07-15-network-consolidation.md', './docs/superpowers/plans/archival-record-2026-04-27.md', './docs/superpowers/plans/lift-log-2026-04-27.md', './docs/superpowers/plans/temp_migration.md', './docs/archive/cf-workers/authichain-autonomous-nexus.js', './docs/technical-reference/docs-agentz/superpowers/plans/2026-05-16-phase6-rfp-capture.md', './docs/technical-reference/docs-agentz/superpowers/plans/2026-04-28-pricing-reconciliation.md', './docs/technical-reference/docs-agentz/superpowers/plans/2026-04-27-webhook-idempotency.md', './docs/technical-reference/docs-agentz/superpowers/plans/2026-05-24-authichain-fixes.md', './docs/technical-reference/docs-agentz/superpowers/plans/2026-04-27-ecosystem-consolidation.md', './docs/technical-reference/docs-agentz/superpowers/plans/worker-status-2026-04-27.md', './docs/technical-reference/docs-agentz/superpowers/plans/archival-record-2026-04-27.md', './docs/technical-reference/docs-agentz/superpowers/plans/lift-log-2026-04-27.md', './shared/subscriptionPlans.ts', './scripts/monitor-autonomous-pipeline.ts', './server/webhooks/stripe-plan-detection.test.ts', './server/webhooks/stripe-plan-detection.ts', './server/scripts/autonomous_close_deal.ts', './src/lib/plans.ts', './src/lib/autonomous-controller.ts', './src/lib/plans.test.ts', './src/lib/plan-checkout.ts', './src/lib/plan-checkout.test.ts', './src/lib/autonomous/orchestrator.ts', './src/lib/autonomous/orchestrator.test.ts', './src/app/dashboard/autonomous/page.tsx', './src/app/api/checkout/plan/[planId]/route.ts', './agentz/workflows/handlers/growth_loop_autonomous.py', './agentz/workflows/handlers/hubspot_backlog_processor.py', './agentz/tests/test_llm_plan_deadline.py', './agentz/tests/__pycache__/test_llm_plan_deadline.cpython-312-pytest-9.0.3.pyc']

--- Match in ./docs/LAUNCH_HIGH_VALUE_BACKLOG.md ---
   # Launch high-value backlog
   **This PR (x402 docs):** public `GET /x402` HTML + catalog/backlog mark the rail **ready** (not `not_configured`). Prior PR: fail-closed schedules + claw↔AgentZ `mode` + ghost-traffic probes + `/api/funnel` aliases.
   | (a) | First Stripe / DPP smoke purchase | **4.0** | `GET /api/checkout/dpp` **303** to `checkout.stripe.com` (live). Smoke buyer owner-attested. Gap: Dashboard must hit `/api/stripe/webhook` (legacy URL 404/410); `/api/funnel` was 404 (fixed in this PR, needs deploy).                                                                                                                           |
   | Canonical Stripe webhook mount      | `POST https://authichain.com/api/stripe/webhook` → 400 JSON without `stripe-signature` (handler is live).                                                                                                                                                                                                                         |
   | **Enable Outbound AgentZ orchestration** | Unfreeze / harden `agentz-orchestration.yml`, claw→AgentZ exec | Schedule `DRY_RUN` + claw `mode` **this PR**. Remaining: Access service token (owner); `AGENTZ_WEBHOOK_SECRET` on edge; do not enable Containers. |
   | `workers/dpp-fulfillment` is the access-grant path                       | Adjunct CRM/email only. Access = edge webhook → `fulfillDppPaidSession`.                                                       |
   | `workers/stripe-webhook` is production DPP                               | Dead for DPP (QRON profile upsert). Canonical is edge `/api/stripe/webhook`.                                                   |
   | Enabling `agentz-orchestration` runs the Python fleet                    | It runs TS scripts + webhook log only (`docs/CAPABILITIES.md`).                                                                |
   ### P0-1. Confirm Stripe Dashboard → canonical webhook
   - **Problem:** Ops docs (until this PR) told Stripe to POST `https://app.authichain.com/api/webhooks/stripe`. That path is retired (Next 410; apex 404). Paid sessions then never `fulfillDppPaidSession`.
   - **Evidence:** `docs/operations/stripe-webhook-setup.md` (banner now corrected); `src/app/api/webhooks/stripe/route.ts` L51–64; live `POST /api/webhooks/stripe` → 404; live `POST /api/stripe/webhook` → 400 missing signature.
   - **Owner / secrets:** Stripe Dashboard. Worker secrets on **`authichain-edge-router`**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and/or `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`, `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   - **Done when:** Stripe event deliveries for a smoke/paid session are 2xx on `https://authichain.com/api/stripe/webhook`; a `funnel_events` row with `loop_stage=provisioned` exists.
   ### P0-1b. Edge webhook threw before fulfill — harden observability + replay (2026-09-20)
   - **Problem:** Apex `handleStripeWebhook` called Drizzle `getDb()` (requires `DATABASE_URL`) for idempotency/audit _before_ `fulfillDppPaidSession`. `authichain-edge-router` hydrates Stripe + Supabase only — not `DATABASE_URL`. Paid `checkout.session.completed` then 400'd and never wrote `payment_succeeded` / `provisioned`. Live `stripe_events` stayed empty even for prior successes (edge wrote Drizzle `activity_log`, which also failed).
   ### P1-6. Bind `AGENTZ_WEBHOOK_SECRET` on edge + fix `push-secrets` worker name
   - **Problem:** Orchestration POSTs `$APP_URL/api/agentz/webhook`. Handler 401s if Worker secret missing. `scripts/push-secrets-to-cloudflare.sh` still targets worker name `authichain-unified` (not `authichain-edge-router`) and omits `AGENTZ_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`.
   - **Evidence:** `worker-app/index.ts` webhook handler; `scripts/push-secrets-to-cloudflare.sh` L24–26, L39–56; `deploy-cloudflare.yml` binds attestation keys only.
   - **Secrets (names):** add `AGENTZ_WEBHOOK_SECRET` to edge; rename core worker in the push script.
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and/or `STRIPE_WEBHOOK_AUTHICHAIN_SECRET`, `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (must match GitHub for genesis).
   1. **Owner (5 min):** Stripe Dashboard endpoint = `https://authichain.com/api/stripe/webhook`. Confirm last delivery 2xx. Bind missing edge secrets from the list above.
   4. **AgentZ mode + fail-closed schedules shipped (this PR).** Owner: Access service token on claw if policy requires it; bind `AGENTZ_WEBHOOK_SECRET` on edge. Do not enable Containers spend.
   curl -s -X POST https://authichain.com/api/stripe/webhook # 400 JSON

--- Match in ./docs/strategy/ROADMAP.md ---
   ## Phase 3: Adversarial Autonomy (Trust Moat)

--- Match in ./docs/strategy/dpp-vertical-roadmap.md ---
   ## Shared implementation backlog

--- Match in ./docs/strategy/mcp-app-roadmap.md ---
   ### Phase 3 — publish a real record end to end

--- Match in ./docs/superpowers/plans/2026-07-23-cloudflare-hybrid-frontend.md ---
   **Architecture:** `next build` prerenders ~61 marketing pages to standalone HTML (+ `_next/static` chunks). A build pipeline merges that snapshot with the Vite SPA build (`dist/public`) into one Cloudflare assets directory. `worker-app/index.ts` routes each request: marketing paths → prerendered HTML; `/_next/static/*` → Next chunks; app paths → SPA `index.html` (wouter client routing); the few dynamic public paths → Hono handlers reading tRPC/db; `/` → per-brand static HTML by `Host`. Existing `/api/*`, tRPC, webhooks, and cron dispatch (Tasks 1-8) are unchanged.
   - **Do not regress Tasks 1-8.** The existing `worker-app/index.ts` API/tRPC/webhook/cron routes, `worker-app/rate-limiter.ts`, and the 521-test Node vitest suite + `worker-app/**/*.test.ts` must stay green. Additive changes only to the request-routing layer.
   ## Phase 3 — worker-app manifest-driven routing
   - **Spec coverage:** Phase 2 (snapshot + merge) and Phase 3 (manifest, static/SPA routing, dynamic handlers, brand home, integration verify) cover the architecture. ✅

--- Match in ./docs/superpowers/plans/2026-07-22-cloudflare-workers-migration.md ---
   **Architecture:** Replace the Node/Express entrypoint (`server/_core/index.ts` + `server/_core/app.ts`) with a Hono-based Cloudflare Worker `fetch` handler that mounts the existing tRPC `appRouter` (`server/routers.ts`, 44 sub-routers, unchanged) via `@trpc/server/adapters/fetch`. The ~12 raw (non-tRPC) Express routes — Stripe/Paddle/Instantly/DocuSign webhooks, OAuth, contact, GPT, internal, health, admin/ops — become individual Hono routes reusing their existing framework-agnostic handler functions. `pg.Pool` (raw TCP, incompatible with Workers) is replaced with a Hyperdrive-backed `pg.Pool`, which Cloudflare designed as a near-drop-in for exactly this case. In-memory rate limiting moves to a Durable Object (the existing `Map`-based store doesn't survive across Workers isolates). The Node `setInterval` job scheduler moves to Cloudflare Cron Triggers. The frontend is already a Vite build outputting static assets (`dist/public`), served via the Workers `ASSETS` binding — the same pattern the repo's own `worker/index.ts` already uses for the root marketing page today.
   | Task 2b-4 | 19 | `server/webhooks/**`, `server/services/**`, `server/sales/**`, `server/admin/**`, `server/payments/**`, `server/paddle/**`, `server/subscriptions/**`, `server/stripe-connect-service.ts`, `server/tenant-billing.ts`, `server/revenue-orchestrator.ts`, `server/fulfillment-service.ts` — commerce/revenue |
   - Modify: `server/webhooks/**` (3 files), `server/services/**` (3 files), `server/sales/**` (3 files), `server/admin/**` (3 files), `server/payments/**` (1 file), `server/paddle/**` (1 file), `server/subscriptions/**` (1 file), `server/stripe-connect-service.ts`, `server/tenant-billing.ts`, `server/revenue-orchestrator.ts`, `server/fulfillment-service.ts`
   **Note:** `server/webhooks/stripe.ts` was confirmed during this plan's architecture investigation to already take `(rawBody, sig)` as plain parameters (framework-agnostic, no Express coupling) — but it likely still calls `logActivity`/`recordRevenue`/`upsertStripeSubscription` etc. from `server/db.ts` internally, which is exactly what this sub-task migrates. Do not confuse "already Workers-compatible for HTTP framework reasons" (true, established earlier) with "already Workers-compatible for database access reasons" (not true until this task runs).
   find server/webhooks server/services server/sales server/admin server/payments server/paddle server/subscriptions -name "*.ts" | grep -v "\.test\.ts$"
   - [ ] **Step 2 through 6: same procedure as Task 2b-1**, scoped to this list. Given this cluster includes real payment webhook handlers, run each file's test individually and read the diff carefully before committing — a mistake here has real financial-data implications, more so than the other clusters.
   - Reference (read, do not modify — reuse the exported handler functions as-is): `server/webhooks/stripe.ts`, `server/webhooks/paddle.ts` (or wherever Paddle's handler lives per `app.ts:95` — confirm exact path), `server/_core/oauth.ts`, `.github-staging/gmail-oauth.ts`, `server/contact/router.ts` (or equivalent — confirm exact export used by `contactRouter` in `app.ts:189`), `server/gpt/router.ts`, `server/internal-api.ts`
   - Consumes: whatever each existing raw handler already exports (confirmed pattern for Stripe: `handleStripeWebhook(rawBody: string, sig: string)` — framework-agnostic, no change needed, just a new call site)
   For each of the 8 non-tRPC concerns found in `server/_core/app.ts` (excluding `/api/trpc` and the static/tRPC middleware lines already covered by Task 5), read the referenced file and record: does it export a plain function (like `handleStripeWebhook`), or does it export an Express `Router` instance (like `contactRouter`, `gptRouter`)? A plain function ports directly into a Hono route. An Express `Router` needs its individual route handlers extracted the same way — Express `Router`s are themselves just `(req, res) => {}` handlers per route internally, so check whether `contactRouter`/`gptRouter`/`createInternalRouter()`'s individual handlers reach into `req`/`res` in ways beyond `req.body`/`req.query`/`req.params` (which Hono's `c.req.json()`/`c.req.query()`/`c.req.param()` replace directly) or something Express-specific (`req.ip`, `req.session`, etc., which need the Task 2-style adaptation).
   - [ ] **Step 2: Port the Stripe and Paddle webhooks (confirmed framework-agnostic already)**
   import { handleStripeWebhook } from "../server/webhooks/stripe";
   // import { handlePaddleWebhook } from "../server/webhooks/paddle"; // confirm exact path from Step 1
   app.post("/api/stripe/webhook", async (c) => {
   const result = await handleStripeWebhook(rawBody, sig);
   Repeat the same pattern for `/api/paddle/webhook` once Step 1 confirms its handler's exact signature.
   - [ ] **Step 3: Write the test for the webhook routes**
   vi.mock("../server/webhooks/stripe", () => ({
   handleStripeWebhook: vi.fn().mockResolvedValue({ received: true }),
   describe("POST /api/stripe/webhook", () => {
   const res = await app.request("/api/stripe/webhook", {
   const { handleStripeWebhook } = await import("../server/webhooks/stripe");
   expect(handleStripeWebhook).toHaveBeenCalledWith("raw-stripe-payload", "t=123,v1=fake");
   For each of: `/api/webhooks/instantly`, `/api/webhooks/docusign`, `/api/admin/ops`, `/api/oauth/*`, `/api/contact/*`, `/api/gpt/*`, `/api/internal/*` — repeat the Step 2-4 cycle (port, write a test asserting the existing handler is called with Hono-derived equivalents of the same inputs it received from Express, verify). Do not batch these into one commit — each is its own task-Step-4-sized unit so a single broken route doesn't block the others from landing.
   - Consumes: whatever individual job functions `server/scheduled-jobs.ts` currently calls on a `setInterval` — reuse them unchanged, same framework-agnostic-function pattern as Task 6's webhook handlers.
   ## Phase 3: Verification & Cutover
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   # ... repeat for every secret server/_core/sdk.ts, the webhook handlers, and
   - [ ] **Step 3: Webhook replay check**
   Use Stripe CLI (`stripe listen --forward-to https://authichain-app.<subdomain>.workers.dev/api/stripe/webhook`) to replay a real recent webhook event and confirm identical DB side effects to what the same event produced on the current Vercel deployment (compare the `activity_log`/`revenue_records` rows it wrote).

--- Match in ./docs/superpowers/plans/2026-04-27-ecosystem-consolidation.md ---
   **Architecture:** Five sequential phases. Phase 0 is investigation only (no code changes) and produces a worker-status table that gates Phase 3. Phases 1–2 are independent of Phase 4 and can run in any order after Phase 0. Each task is one PR — independently reviewable, independently revertable with `git revert`.
   Output: a written worker-status table + answers to three structural questions. Phase 3 cannot run safely without this.
   --body "Phase 0 of the ecosystem consolidation. No code changes — only investigation output. Gates Phase 3 (worker decisions). See docs/superpowers/plans/worker-status-2026-04-27.md."
   # PHASE 3 — WORKER FLEET DECISIONS (MED risk, gated by Phase 0)
   **Do not start Phase 3 until Phase 0's PR is merged.** Each task references the Phase 0 status table.
   Decided 2026-04-27 in ecosystem-consolidation Phase 3.3.
   ## Task 4.4: Lift `stripe/webhook/route.ts` (highest-value, highest-coupling)
   **Source:** `C:\Users\rac\authichain\app\api\stripe\webhook\route.ts` (319 LOC)
   cat /c/Users/rac/authichain/app/api/stripe/webhook/route.ts
   grep -rln "stripe\|webhook" server/_core/ 2>/dev/null
   describe("stripe webhook idempotency", () => {
   | 2026-04-27 | app/api/stripe/webhook/route.ts | 319 | server/_core/stripe.ts (dedup wrapper added) + drizzle migration | Lifted only the idempotency pattern; rest of handler is unified-native. Backed by Postgres, not Airtable. |
   git commit -m "consolidate(p4): add Stripe webhook idempotency from authichain
   Lifted only the dedup pattern from authichain's webhook handler (319 LOC,
   make webhook delivery safely retry-able.
   Source: authichain/app/api/stripe/webhook/route.ts"
   gh pr create --title "consolidate(p4): Stripe webhook idempotency" \
   - **Spec coverage:** every section of the spec maps to tasks above. §1 = state-of-world, used by P0 + P1 verifications. §2 verdicts table = covered task-by-task. §3 internal moves = Tasks 1.1, 1.4, 2.1, 2.2. §4 worker fleet = Phase 0 + Phase 3. §5 sibling salvage = Phase 4. §6 benchmarks = background only, not implemented. §7 execution sequence = mirror of this plan's phase order. §8 out of scope = enforced (no feature work, no taste-only renames). §9 acceptance = covered in Final acceptance check.

--- Match in ./docs/superpowers/plans/worker-status-2026-04-27.md ---
   **Status:** Phase 0 complete. Gates Phase 3 of `2026-04-27-ecosystem-consolidation.md`.
   - **Phase 3.3's DEPLOY-NOW / ARCHIVE-WITH-MARKER / DELETE decision for the 8
   **12 DEPLOYED workers** are all on the user's Cloudflare account, last-deployed within the past 60 days. These need CI deploy coverage in Phase 3.2 (currently only the root `worker/index.ts` is deployed by `.github/workflows/deploy-cloudflare.yml`).
   **8 SCAFFOLDED workers** have substantive code (155–644 LOC) but no Cloudflare deployment record. Phase 3.3 decides each one's fate (DEPLOY-NOW / ARCHIVE-WITH-MARKER / DELETE).
   **0 PHANTOM workers.** Phase 3.1 of the plan has no work — every dir has real code.
   All five are SCAFFOLDED — Phase 2.3 only renames if Phase 3.3 decides DEPLOY-NOW or ARCHIVE-WITH-MARKER. If DELETE, no rename needed.

--- Match in ./docs/superpowers/plans/temp_migration.md ---
   **Architecture:** Replace the Node/Express entrypoint (`server/_core/index.ts` + `server/_core/app.ts`) with a Hono-based Cloudflare Worker `fetch` handler that mounts the existing tRPC `appRouter` (`server/routers.ts`, 44 sub-routers, unchanged) via `@trpc/server/adapters/fetch`. The ~12 raw (non-tRPC) Express routes — Stripe/Paddle/Instantly/DocuSign webhooks, OAuth, contact, GPT, internal, health, admin/ops — become individual Hono routes reusing their existing framework-agnostic handler functions. `pg.Pool` (raw TCP, incompatible with Workers) is replaced with a Hyperdrive-backed `pg.Pool`, which Cloudflare designed as a near-drop-in for exactly this case. In-memory rate limiting moves to a Durable Object (the existing `Map`-based store doesn't survive across Workers isolates). The Node `setInterval` job scheduler moves to Cloudflare Cron Triggers. The frontend is already a Vite build outputting static assets (`dist/public`), served via the Workers `ASSETS` binding — the same pattern the repo's own `worker/index.ts` already uses for the root marketing page today.
   - Reference (read, do not modify — reuse the exported handler functions as-is): `server/webhooks/stripe.ts`, `server/webhooks/paddle.ts` (or wherever Paddle's handler lives per `app.ts:95` — confirm exact path), `server/_core/oauth.ts`, `.github-staging/gmail-oauth.ts`, `server/contact/router.ts` (or equivalent — confirm exact export used by `contactRouter` in `app.ts:189`), `server/gpt/router.ts`, `server/internal-api.ts`
   - Consumes: whatever each existing raw handler already exports (confirmed pattern for Stripe: `handleStripeWebhook(rawBody: string, sig: string)` — framework-agnostic, no change needed, just a new call site)
   For each of the 8 non-tRPC concerns found in `server/_core/app.ts` (excluding `/api/trpc` and the static/tRPC middleware lines already covered by Task 4), read the referenced file and record: does it export a plain function (like `handleStripeWebhook`), or does it export an Express `Router` instance (like `contactRouter`, `gptRouter`)? A plain function ports directly into a Hono route. An Express `Router` needs its individual route handlers extracted the same way — Express `Router`s are themselves just `(req, res) => {}` handlers per route internally, so check whether `contactRouter`/`gptRouter`/`createInternalRouter()`'s individual handlers reach into `req`/`res` in ways beyond `req.body`/`req.query`/`req.params` (which Hono's `c.req.json()`/`c.req.query()`/`c.req.param()` replace directly) or something Express-specific (`req.ip`, `req.session`, etc., which need the Task 2-style adaptation).
   - [ ] **Step 2: Port the Stripe and Paddle webhooks (confirmed framework-agnostic already)**
   import { handleStripeWebhook } from "../server/webhooks/stripe";
   // import { handlePaddleWebhook } from "../server/webhooks/paddle"; // confirm exact path from Step 1
   app.post("/api/stripe/webhook", async (c) => {
   const result = await handleStripeWebhook(rawBody, sig);
   Repeat the same pattern for `/api/paddle/webhook` once Step 1 confirms its handler's exact signature.
   - [ ] **Step 3: Write the test for the webhook routes**
   vi.mock("../server/webhooks/stripe", () => ({
   handleStripeWebhook: vi.fn().mockResolvedValue({ received: true }),
   describe("POST /api/stripe/webhook", () => {
   const res = await app.request("/api/stripe/webhook", {
   const { handleStripeWebhook } = await import("../server/webhooks/stripe");
   expect(handleStripeWebhook).toHaveBeenCalledWith("raw-stripe-payload", "t=123,v1=fake");
   For each of: `/api/webhooks/instantly`, `/api/webhooks/docusign`, `/api/admin/ops`, `/api/oauth/*`, `/api/contact/*`, `/api/gpt/*`, `/api/internal/*` — repeat the Step 2-4 cycle (port, write a test asserting the existing handler is called with Hono-derived equivalents of the same inputs it received from Express, verify). Do not batch these into one commit — each is its own task-Step-4-sized unit so a single broken route doesn't block the others from landing.
   - Consumes: whatever individual job functions `server/scheduled-jobs.ts` currently calls on a `setInterval` — reuse them unchanged, same framework-agnostic-function pattern as Task 5's webhook handlers.
   ## Phase 3: Verification & Cutover
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   # ... repeat for every secret server/_core/sdk.ts, the webhook handlers, and
   - [ ] **Step 3: Webhook replay check**
   Use Stripe CLI (`stripe listen --forward-to https://authichain-app.<subdomain>.workers.dev/api/stripe/webhook`) to replay a real recent webhook event and confirm identical DB side effects to what the same event produced on the current Vercel deployment (compare the `activity_log`/`revenue_records` rows it wrote).

--- Match in ./docs/technical-reference/docs-agentz/superpowers/plans/2026-04-27-ecosystem-consolidation.md ---
   **Architecture:** Five sequential phases. Phase 0 is investigation only (no code changes) and produces a worker-status table that gates Phase 3. Phases 1–2 are independent of Phase 4 and can run in any order after Phase 0. Each task is one PR — independently reviewable, independently revertable with `git revert`.
   Output: a written worker-status table + answers to three structural questions. Phase 3 cannot run safely without this.
   --body "Phase 0 of the ecosystem consolidation. No code changes — only investigation output. Gates Phase 3 (worker decisions). See docs/superpowers/plans/worker-status-2026-04-27.md."
   # PHASE 3 — WORKER FLEET DECISIONS (MED risk, gated by Phase 0)
   **Do not start Phase 3 until Phase 0's PR is merged.** Each task references the Phase 0 status table.
   Decided 2026-04-27 in ecosystem-consolidation Phase 3.3.
   ## Task 4.4: Lift `stripe/webhook/route.ts` (highest-value, highest-coupling)
   **Source:** `C:\Users\rac\authichain\app\api\stripe\webhook\route.ts` (319 LOC)
   cat /c/Users/rac/authichain/app/api/stripe/webhook/route.ts
   grep -rln "stripe\|webhook" server/_core/ 2>/dev/null
   describe("stripe webhook idempotency", () => {
   | 2026-04-27 | app/api/stripe/webhook/route.ts | 319 | server/_core/stripe.ts (dedup wrapper added) + drizzle migration | Lifted only the idempotency pattern; rest of handler is unified-native. Backed by Postgres, not Airtable. |
   git commit -m "consolidate(p4): add Stripe webhook idempotency from authichain
   Lifted only the dedup pattern from authichain's webhook handler (319 LOC,
   make webhook delivery safely retry-able.
   Source: authichain/app/api/stripe/webhook/route.ts"
   gh pr create --title "consolidate(p4): Stripe webhook idempotency" \
   - **Spec coverage:** every section of the spec maps to tasks above. §1 = state-of-world, used by P0 + P1 verifications. §2 verdicts table = covered task-by-task. §3 internal moves = Tasks 1.1, 1.4, 2.1, 2.2. §4 worker fleet = Phase 0 + Phase 3. §5 sibling salvage = Phase 4. §6 benchmarks = background only, not implemented. §7 execution sequence = mirror of this plan's phase order. §8 out of scope = enforced (no feature work, no taste-only renames). §9 acceptance = covered in Final acceptance check.

--- Match in ./docs/technical-reference/docs-agentz/superpowers/plans/worker-status-2026-04-27.md ---
   **Status:** Phase 0 complete. Gates Phase 3 of `2026-04-27-ecosystem-consolidation.md`.
   **12 DEPLOYED workers** are all on the user's Cloudflare account, last-deployed within the past 60 days. These need CI deploy coverage in Phase 3.2 (currently only the root `worker/index.ts` is deployed by `.github/workflows/deploy-cloudflare.yml`).
   **8 SCAFFOLDED workers** have substantive code (155–644 LOC) but no Cloudflare deployment record. Phase 3.3 decides each one's fate (DEPLOY-NOW / ARCHIVE-WITH-MARKER / DELETE).
   **0 PHANTOM workers.** Phase 3.1 of the plan has no work — every dir has real code.
   All five are SCAFFOLDED — Phase 2.3 only renames if Phase 3.3 decides DEPLOY-NOW or ARCHIVE-WITH-MARKER. If DELETE, no rename needed.

--- Match in ./agentz/workflows/handlers/growth_loop_autonomous.py ---
   # This uses the native browser bridge we built in Phase 3
   personalized_hook=f"Risk alert for {company}",
   generic_hook="Provenance gap detected — AuthiChain can close it.",

--- Match in ./agentz/workflows/handlers/hubspot_backlog_processor.py ---
   agentz.workflows.handlers.hubspot_backlog_processor
   Executes the Mass Activation cycle for the entire HubSpot backlog.
   ctx.step("🚀 --- INITIALIZING HUB SPOT BACKLOG PROCESSOR --- 🚀")
   # 2. Fetch Entire Backlog & Sample Product for Context
   return "No backlog found in HubSpot."
   return f"Backlog processing complete. {processed} deals activated and ready for closing."
