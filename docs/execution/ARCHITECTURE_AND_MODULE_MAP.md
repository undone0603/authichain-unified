# Architecture and module map

Written 2026-10-22, the third of the three documents the brief listed as missing; its open questions are tracked as N-16 in `NEXT_ACTIONS.md`. Read from the tree of `main` at `caf0f083`. Counts were taken with `find` and `ls` on that tree; they are file counts, not lines of code, and not a statement about what is deployed. Where the repository cannot answer a question (what is live in the Cloudflare account, what Stripe has registered) the text says **(not verified)** and the question is listed in section 10.

Companion documents: `REVENUE_LOOP.md` (customer loop and Stripe), `AGENT_OPERATIONS.md` (autonomy and AgentZ), `docs/OPERATING_CHARTER.md` (what may run unattended).

## 1. The shape in one page

```
  browser, agent, Stripe, scanner
            |
            v
  Cloudflare zone authichain.com
            |
            +--> path routes owned by  authichain-edge-router   (worker-app/)
            |      /api/stripe/webhook  /api/checkout*  /api/generate*  /api/x402*
            |      /api/v1/agent-verify*  /api/v1/attestation*  /qron/r*  /dashboard*
            |      /.well-known/jwks.json  /protocol/*  /api/leads/capture  app.authichain.com/*
            |
            +--> everything else   authichain.com/*, www.authichain.com/*
                   authichain-com   (workers/authichain-com/)   landing, microsites, checkout gate
                      |  service bindings
                      +--> APP_WORKER  = authichain-edge-router    (APP_PREFIXES: /api /dashboard /generate /qron /verify ...)
                      +--> API_WORKER  = authichain-api
                      +--> VERIFY_APP  = authichain-app

  authichain-edge-router  --VERIFY_APP-->  authichain-app   (Next.js 16 on OpenNext, src/, no public address)
            |
            +--> Supabase Postgres (Hyperdrive, REST), KV, Durable Object RateLimiter, Workers AI

  Other hostnames: one Worker each (verticals, govchain.us, qron.space, verify.authichain.com)
```

Three things carry most of the weight:

1. **`authichain-com`** is the front door for the apex. It answers marketing pages, microsites and the gated checkout itself, and proxies the rest to the edge router.
2. **`authichain-edge-router`** (`worker-app/`) owns the API surface: Stripe webhook, checkout, generate, x402, attestation, guardrail, leads, cron.
3. **`authichain-app`** (`src/`, the Next.js app built with OpenNext) is reached only through service bindings. Its `wrangler.app.jsonc` turns `workers_dev` and `preview_urls` off (CFA-142, CFA-144).

Everything else is a satellite Worker (section 4), a Node server that may or may not be deployed (section 6), or a library (section 8).

## 2. Repository map

| Path                    | Files   | What it is                                                                                                                      | Runs where                                             |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/`                  | 558     | Next.js app: 150 `route.ts`, 92 `page.tsx`, 180 entries in `src/lib`, components, hooks, `src/db`                               | Worker `authichain-app` (OpenNext)                     |
| `worker-app/`           | 46      | Edge router: API, webhooks, cron dispatch, attestation, dynamic pages, `route-manifest.ts`                                      | Worker `authichain-edge-router`                        |
| `workers/`              | 406     | 52 directories: 49 with a Wrangler config, `_shared` (library), `qron-portfolio`, `authichain-revenue-worker`                   | Cloudflare Workers (section 4)                         |
| `worker/`               | 13      | Hono service with Stripe payout code, `outreach-loop.ts`; its config names it `qron-ai-api`                                     | Worker `qron-ai-api`                                   |
| `api/`                  | 6       | `worker.ts` (Worker `authichain-revenue-worker`, receiver R6) and `server.js`, a checked-in bundle                              | Worker; `server.js` unknown (AR-6)                     |
| `server/`               | 304     | Node/Express server code: `_core`, tRPC routers, `jobs`, `agents`, `outreach`, `webhooks`, 68 sub-folders                       | Container or Worker import (section 6)                 |
| `client/`               | 166     | Vite and wouter SPA shell for the authenticated app                                                                             | Built to `dist/public`, served by the edge router      |
| `apps/qron-platform/`   | 2,065   | A second Next app with its own `drizzle`, `contracts`, `mobile`, scripts, and 5 Workers                                         | Its own `wrangler.toml` (`qron-edge-fleet`)            |
| `apps/chatbot/`         | 348     | Browser-native chatbot sources and an `agent-browser` copy; no `package.json` at its root                                       | No workflow references it                              |
| `apps/agent-browser/`   | 234     | Headless-browser CLI for agents (has a `package.json`)                                                                          | Workspace package                                      |
| `apps/client/`          | 164     | App-router folders `demos`, `privacy`, `terms`, `verify`; no `package.json`                                                     | No workflow references it                              |
| `apps/verifier-web/`    | 13      | Static Vite verifier at `verify.authichain.com`                                                                                 | Worker `verifier-web` (`deploy-verifier-web.yml`)      |
| `packages/`             | 79      | `config`, `contracts`, `evidence`, `libs`, `policy`, `shared`, `verifier`                                                       | Imported by the above                                  |
| `shared/`               | 13      | Stripe plan-detection reference (`pricing.ts`, test-mode IDs) and other shared modules                                          | Imported                                               |
| `protocol/`             | 79      | Open protocol: `SPEC.md`, `verifier.mjs`, `attestation`, `conformance`, `adversarial`, `epcis`, `qfs`, `trust-kernel`, examples | Imported and published at `/protocol/*`                |
| `schemas/`, `fixtures/` | 1, 4    | Attestation v0.1 JSON schema, and valid and tampered fixtures                                                                   | Tests                                                  |
| `contracts/`            | 12      | Hardhat contracts and `hardhat.config.ts`                                                                                       | Base, Polygon (not built by a gate; see GITLAB_LAUNCH) |
| `agentz/`               | 242     | Python control plane: registry, runner, firewall, API, handlers                                                                 | Owner LAN behind a tunnel; Actions (AGENT_OPERATIONS)  |
| `mcp/`                  | 12      | `authichain-mcp-server` 1.0.0; the root `server.json` (registry manifest) and `glama.json` describe it                          | Workspace package                                      |
| `libs/`                 | 5       | Airtable, Notion, Supabase helpers; `opensam`                                                                                   | Imported                                               |
| `supabase/`             | 124     | 66 SQL migrations, 23 edge functions, `migrations.archive`, templates                                                           | Supabase                                               |
| `drizzle/`              | 45      | Drizzle schema and a second migration sequence (16 entries), `drizzle.config.ts`                                                | Postgres (AR-8)                                        |
| `scripts/`              | 372     | CI checks, autonomy scripts, outreach tools, one-off operators                                                                  | CI, operator                                           |
| `.github/`              | -       | 106 workflows and `autonomy.json` (AGENT_OPERATIONS)                                                                            | GitHub Actions                                         |
| `docs/`                 | 536     | Strategy, execution, operations, compliance, plans                                                                              | Reading                                                |
| `content/`, `public/`   | 42, 102 | Microsite packs and static assets                                                                                               | Synced into `authichain-com` and the apps              |
| `ops/`                  | 182     | Shell and Node scripts for earlier hosts (`deploy.sh`, `fixdburl.sh`, `ccrun.sh`, ...)                                          | Operator; not referenced by CI (AR-9)                  |
| `config/`               | 6       | Estate, launch-gate and HubSpot JSON/YAML read by scripts and tests                                                             | Scripts                                                |
| `tests/`, `test/`       | 13, 1   | Python tests (agents, API, brand assets, failover, grants pipeline, HubSpot token), one Hardhat test                            | Local                                                  |
| `automation/`           | 1       | n8n workflows                                                                                                                   | n8n                                                    |
| Root strays             | -       | `out.txt`, `script.py`, `do_update.py`, `update.js`, `root/directory.txt`, `local-server.mjs`                                   | None found (AR-9)                                      |

The pnpm workspace (`pnpm-workspace.yaml`) is `apps/*`, `packages/*`, `workers/*`, `worker` and `mcp`, plus the root package. `worker-app/`, `api/`, `server/`, `client/` and `src/` belong to the root package. `turbo.json` runs `check` and `test` across the workspace; `pnpm run lint` recurses (N-11).

## 3. Request paths

**The apex.** `authichain.com` is a custom domain of `authichain-com`. `worker-app/wrangler.toml` registers 52 route patterns on the same zone and on `authichain.govchain.us`, so the edge router receives its listed paths before the landing Worker sees them. `workers/authichain-com/wrangler.toml` also registers exact routes for `/api/x402` and `/api/v1/agent-verify`, so both Workers claim those two paths. **(not verified)** which one Cloudflare serves for each form; REVENUE_LOOP section 8 describes the x402 handlers.

**Inside `authichain-com`** (`src/index.ts`, 3,722 lines) the order is: its own routes (x402 and `/api/v1` answers, the gated checkout via `tryHandleGatedCheckout`), then `APP_PREFIXES` (`app-prefixes.ts`: `/dashboard`, `/dapp`, `/generate`, `/qron`, `/api`, `/verify`, `/status` and the public dynamic pages) proxied to `APP_WORKER` with a 4 s default timeout, then marketing HTML and microsites.

**Inside the edge router** (`worker-app/index.ts`, 2,060 lines) `route-manifest.ts` says every path resolves to exactly one owner: `api`, `dynamic` (`dynamic-pages.ts`), `spa` (the Vite shell from `client/`), `marketing`, or `spa-fallback`. The Stripe webhook, checkout and generate routes sit here.

**The Next app** serves routes the edge router does not (and the pages of the brand domains). It is reached through `VERIFY_APP` and the service bindings of `govchain-us`, `authichain-com`, `qron-space` and `strainchain-io`.

**Data access.** Workers reach Supabase Postgres through Hyperdrive (`authichain-app`, the edge router) or the REST API with a service-role key (for example R4 and R8). KV namespaces (`SESSIONS`, `MICROSITES_KV`, `AUTHICHAIN_KV`, `X402_REPLAY_KV`), a D1 database in the root config, an R2 bucket, and one Durable Object class (`RateLimiter`, SQLite-backed, exported from `worker-app/rate-limiter.ts` through `app-worker-entry.ts` because Cloudflare error 10064 forbids dropping a class that holds data).

## 4. Workers

61 Wrangler config files exist in the repository: 49 under `workers/`, 5 under `apps/qron-platform/workers/`, `apps/qron-platform/wrangler.toml`, `apps/verifier-web/wrangler.toml`, and five at the top level (`wrangler.toml` named `authichain`, `wrangler.app.jsonc` for `authichain-app`, `worker-app/wrangler.toml` for the edge router, `worker/wrangler.toml` for `qron-ai-api`, `api/wrangler.toml` for `authichain-revenue-worker`).

Roles below come from each Worker's own header comment or name. Whether a Worker is live is **(not verified)**.

| Role                          | Workers under `workers/`                                                                                                                                                                                                                                                                  | Notes from their own configuration                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front door (1)                | `authichain-com`                                                                                                                                                                                                                                                                          | Its config says it is "not on PR Workers Builds" and updates only through `deploy-authichain-com.yml` or `deploy-workers.yml` on `main` (AR-11).                                                                                                                                                                                                   |
| Public API (4)                | `authichain-api` (RapidAPI gateway v3.0), `authichain-api-gateway` (B2B gateway), `authichain-gateway` (rate limit), `authichain-dashboard` (`dashboard.authichain.com`)                                                                                                                  |                                                                                                                                                                                                                                                                                                                                                    |
| Payments and fulfilment (5)   | `stripe-webhook` (R4), `dpp-fulfillment` (R5), `authichain-license-issuer`, `first-dollar-desk`, `manufacturer-status`                                                                                                                                                                    | `first-dollar-desk` is "recovered from the live Worker on 2026-09-29 (read-only)". `manufacturer-status` "has no route yet".                                                                                                                                                                                                                       |
| Provenance and verify (13)    | `authichain-qron-provenance`, `authichain-scan-validate`, `authichain-verify-worker`, `gs1-resolver`, `qfs-adapter`, `passport-demo`, `bitcoin-auth`, `blockchain`, `authichain-chain-data`, `authichain-bridge`, `auth`, `analytics`, `ai-classification`                                | `authichain-bridge` says "SCAFFOLDED, not currently deployed" yet is in the deploy matrix. `qfs-adapter` is an offline mapper, not a bank rail. `passport-demo` carries a `PUBLIC_LOOP_FREEZE` note.                                                                                                                                               |
| Automation and outreach (13)  | `authichain-automation`, `authichain-autopilot`, `authichain-outreach-engine`, `outreach-queue`, `qron-automation`, `qron-outreach`, `qron-image-gen`, `resend-relay`, `authichain-telegram`, `authichain-openclaw`, `authichain-agentz`, `authichain-agentz-webhook`, `authichain-infra` | `authichain-automation` keeps its workers.dev address off (PM-322); `authichain-autopilot` keeps cron and workers.dev off. `qron-outreach` had its cron removed because the account is at the 5-cron free-plan limit. `resend-relay` is private (service binding only). `authichain-agentz` deploys Cloudflare Containers only on an opt-in input. |
| Brand and vertical sites (13) | `strainchain-io`, `glowchain-io`, `watchchain-io` (script `watchchain-io-vertical`), `govchain-us`, `qron-space`, and eight more: `chipchain-io`, `fanchain-io`, `harvestchain-io`, `luxechain-io`, `partchain-io`, `provenchain-io`, `rxchain-io`, `threadchain-io`                      | The eight have "custom-domain routes disabled 2026-09-08: the zone does not exist". `glowchain-io` is deployed by Workers Builds from GitLab. `govchain-us` and `qron-space` use `wrangler versions upload` on pull requests.                                                                                                                      |
| Not Workers                   | `_shared` (library files imported by several Workers), `qron-portfolio` (`worker.js` and `DEPLOY.md` only), `authichain-revenue-worker` (`src/` only; the Worker of that name deploys from `api/`)                                                                                        |                                                                                                                                                                                                                                                                                                                                                    |

### 4.1 How each one is deployed

**(code)** `deploy-workers.yml` lists 44 Workers in its matrix and adds `authichain-agentz` only when an input is set. Other workflows deploy single Workers: `deploy-authichain-com.yml`, `deploy-verifier-web.yml`, `deploy-qron-ai-api.yml` (`worker/`), `deploy-edge-worker.yml` (`api/`, the revenue worker), `deploy-cloudflare.yml` and `deploy-manufacturer-status.yml` (`manufacturer-status`). `GITLAB_LAUNCH.md` records that Cloudflare Workers Builds also deploys from GitLab `main`: `authichain-app`, `govchain-us`, `qron-space`, `authichain-com` (path-filtered), `gs1-resolver`, `authichain-dashboard`, `verifier-web`, and 28 more.

I found **no deploy path in the repository** for: `authichain-edge-router` (`worker-app/`), the root `wrangler.toml` (`authichain`), `first-dollar-desk`, `passport-demo` and `authichain-agentz-webhook`. The edge router has workflows that bind its secrets (`bind-stripe-webhook-secrets.yml`, `bind-lead-secrets.yml`, `bind-x402-secrets.yml`) but none that deploys it, and `GITLAB_LAUNCH.md` does not list it among the Workers Builds projects (AR-2).

## 5. The Next.js app (`src/`)

`src/app/api` has 61 top-level groups; the ones that matter for money are `checkout`, `generate`, `stripe`, `subscription`, `v1` (agent verify, attestation), `x402`, `webhook` and `webhooks` (retired, answering 410). The pages are the public site: `pricing`, `dpp`, `digital-product-passport`, `genetics`, `qron`, `grants`, `dashboard`, `status`, `legal` and the brand pages.

`src/lib` (180 entries) is where policy lives: `plans.ts` (prices, plan ids, credits), `checkout-gate.ts`, `provisioning.ts`, `dpp-fulfill-checkout.ts`, `x402.ts`, `generate-api.ts`, `rate-limit.ts`, `dunning.ts`, `winback.ts`, `genetics.ts`. `next.config.js` sets `output: "standalone"` and `typescript.ignoreBuildErrors: true`, so a successful build proves the app bundles, not that it type-checks (GITLAB_LAUNCH.md). `pnpm build` is `scripts/build-with-retry.sh`, which runs `next build --webpack` up to three times.

## 6. The Node server (`server/`)

`server/_core/app.ts` builds the Express app and mounts the Stripe handler (R2). `server/` also holds the tRPC routers, 22 files under `jobs/` (including `agentz-supervisor.ts`), 33 under `agents/`, 12 under `outreach/` (the send guard, recipient rules, opt-out), 7 under `webhooks/` (R1's `stripe.ts`), and 68 sub-folders in all, most of them small domain folders (`govchain`, `revenue-engine`, `marketplace`, `staking`, `nft`, ...).

Two facts about how it runs:

- The edge router imports from `server/` directly (`worker-app/index.ts` calls `server/webhooks/stripe.ts`), so part of `server/` runs as Worker code, not in a container.
- `Dockerfile` and `railway.json` start `node dist/index.js` and copy `/app/dist` from the build stage, but the build stage runs only `pnpm build`, which is `next build --webpack` and writes `.next/`. The script that writes `dist/` is `build:server` (`vite build && esbuild server/_core/index.ts ...`), and nothing in the Dockerfile calls it (AR-1).

`api/server.js` is a checked-in esbuild bundle of 12,449 lines that embeds `drizzle/schema.ts`. There is no `vercel.json`, and the comments in `wrangler.app.jsonc` and `apps/verifier-web/wrangler.toml` say Cloudflare replaced Vercel (AR-6).

## 7. Data layer

| Store                         | Where defined                                                                                                      | Used by                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Supabase Postgres             | `supabase/migrations` (66 files; the first is `00001_create_webauthn_credentials.sql`), 23 edge functions          | Almost everything                                                                             |
| Drizzle schema and migrations | `drizzle/schema.ts`, `drizzle/0000_*.sql` and later, `drizzle/migrations/`; a copy in `apps/qron-platform/drizzle` | `profiles` is created by `drizzle/0000_special_lady_ursula.sql`, not by `supabase/migrations` |
| Cloudflare KV, D1, R2         | `wrangler.toml` files                                                                                              | Sessions, microsites, x402 replay guard                                                       |
| Stripe                        | Account objects; `stripe_events` claim table for R1                                                                | REVENUE_LOOP                                                                                  |
| `automation_logs` rows        | Supabase                                                                                                           | Rate limits and the x402 spend ledger (fail open; REVENUE_LOOP section 6, 8)                  |
| `agentz/logs/runs.jsonl`      | Local file, git-ignored                                                                                            | AgentZ audit and budget checks (AGENT_OPERATIONS 4.4)                                         |

The base `profiles` columns are `tier`, `generations_used`, `generations_limit`, `stripe_customer_id`, `stripe_subscription_id`. The credit and subscription columns the code writes (`subscription_plan`, `subscription_status`, `last_grant_session_id`, and for R4 and R8 `plan` and `stripe_subscription_status`) come from `supabase/migrations` in part (`subscription_plan`, `last_grant_session_id`) and from no migration in the others (REVENUE_LOOP Q-3).

## 8. Libraries and protocol

`packages/evidence` (`@authichain/evidence`) and `packages/policy` (`@authichain/policy`) carry the verifier and policy logic; `packages/verifier`, `packages/contracts`, `packages/shared`, `packages/libs` and `packages/config` are small. `protocol/` and `schemas/` define the attestation format (v0.1) and its fixtures; the edge router publishes the issuer and JWKS at `/protocol/issuer.json` and `/.well-known/jwks.json`. `contracts/` plus `hardhat.config.ts` hold the Base and Polygon contracts; `pnpm test:contracts` is the only way they are tested and no gate runs it. `mcp/` is the MCP server. `libs/` holds third-party integrations.

## 9. Where `docs/misc/CLAUDE.md` is out of date

`CLAUDE.md` imports `docs/misc/CLAUDE.md` into every agent session, so each statement below reaches the next agent as an instruction.

| `docs/misc/CLAUDE.md` says                                                          | The tree shows                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Dev: `pnpm dev` (Vite + Express)"                                                  | `pnpm dev` is `next dev`. The Express server is `dev:server`; the Vite SPA builds with `vite build`.                                                                                      |
| "Build: `pnpm build`"                                                               | It runs `scripts/build-with-retry.sh` (`next build --webpack`). `build:server` produces the Express bundle.                                                                               |
| "Check: `pnpm check`"                                                               | `turbo run check --filter=!.`; only `worker/` has a `check` script (GITLAB_LAUNCH.md).                                                                                                    |
| "Backend: Node.js Express (Serverless on Vercel)"                                   | No `vercel.json` at the root; two configs say Cloudflare replaced Vercel. Express code exists (section 6).                                                                                |
| "1 root Cloudflare Worker (`worker/index.ts`, deployed by `deploy-cloudflare.yml`)" | `deploy-cloudflare.yml` deploys `workers/manufacturer-status`. `worker/` deploys as `qron-ai-api` from `deploy-qron-ai-api.yml`. The root `wrangler.toml` has no deploy workflow I found. |
| "12 deployed standalone workers ... 19 worker projects in total"                    | 49 Workers under `workers/` have a Wrangler config (44 in the deploy matrix), 61 configs in the repository.                                                                               |
| "Deploy DB: `supabase db push` (run from /authichain)"                              | There is no `authichain/` directory at the root. Migrations are in `supabase/migrations`.                                                                                                 |
| "Frontend: React + tRPC + Tailwind + Shadcn UI"                                     | Two frontends exist: the Vite SPA in `client/` and the Next app in `src/`.                                                                                                                |

The file is an instruction file the owner maintains, so this document records the differences and does not edit it (AR-7).

## 10. Open questions

| ID    | Question                                                                                                                                                                                                                                                                                                                                                                   | Where                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| AR-1  | The Dockerfile copies `/app/dist` after `pnpm build` (`next build`), and `build:server` is never run. Does the container build fail at the `COPY`, and is the Docker or Railway target still used? REVENUE_LOOP R2 depends on the answer.                                                                                                                                  | `Dockerfile`, `railway.json`, `package.json`                               |
| AR-2  | No workflow deploys `authichain-edge-router`, the root `wrangler.toml` (`authichain`), `first-dollar-desk`, `passport-demo` or `authichain-agentz-webhook`. How are they deployed, and by whom?                                                                                                                                                                            | `.github/workflows`, `GITLAB_LAUNCH.md`                                    |
| AR-3  | Five script names exist twice: `ai-classification`, `analytics`, `auth`, `blockchain`, `stripe-webhook` are in `workers/` and in `apps/qron-platform/workers/`. Whichever publishes last owns the name. Which copy is intended?                                                                                                                                            | both `wrangler.toml` files per name                                        |
| AR-4  | The root `wrangler.toml` (`authichain`, `main = "worker/index.ts"`) and `worker/wrangler.toml` (`qron-ai-api`, `main = "index.ts"`) point at the same code. Is the root config still used?                                                                                                                                                                                 | `wrangler.toml`, `worker/wrangler.toml`                                    |
| AR-5  | `workers/authichain-revenue-worker` (only `src/`) and `workers/qron-portfolio` (`worker.js`, `DEPLOY.md`) have no Wrangler config. Dead copies, or deployed by hand?                                                                                                                                                                                                       | `workers/`                                                                 |
| AR-6  | `api/server.js` is a 12,449-line checked-in bundle with the Drizzle schema inside. What serves it, and what rebuilds it when `server/` or `drizzle/schema.ts` changes?                                                                                                                                                                                                     | `api/server.js`                                                            |
| AR-7  | `docs/misc/CLAUDE.md` is stale in eight places (section 9) and is loaded into every agent session. Replace its Architecture and Commands sections with a pointer to this file?                                                                                                                                                                                             | `docs/misc/CLAUDE.md`                                                      |
| AR-8  | Two migration sequences (`supabase/migrations`, `drizzle/`) plus a third copy under `apps/qron-platform`. Which one is authoritative for `profiles`, and which one has been applied to the live database? `supabase/REMOTE_APPLIED_VERSIONS.txt` may answer part of it.                                                                                                    | `supabase/`, `drizzle/`                                                    |
| AR-9  | `ops/` (182 files), `out.txt`, `script.py`, `do_update.py`, `update.js`, `root/directory.txt` are not referenced from `package.json` or the workflows I searched. Move them to `/archive` after the owner agrees.                                                                                                                                                          | repository root, `ops/`                                                    |
| AR-10 | `authichain-com` and the edge router both register `/api/x402` and `/api/v1/agent-verify` routes on the apex. Which Worker answers each form (exact path, trailing slash, `*`)?                                                                                                                                                                                            | both `wrangler.toml` files                                                 |
| AR-11 | `workers/authichain-com/wrangler.toml` says the Worker updates only through GitHub `wrangler deploy` on `main`. `GITLAB_LAUNCH.md` says Cloudflare Workers Builds deploys it from GitLab `main` when its paths change. GitHub Actions is billing-locked (BLOCKERS B-4), so if the first statement is the current one, the front door cannot be redeployed. Which is right? | `workers/authichain-com/wrangler.toml`, `docs/operations/GITLAB_LAUNCH.md` |

## 11. How to check this

1. Count configs: `find . -name 'wrangler*' -not -path '*/node_modules/*' | wc -l` (61 here).
2. List the deploy matrix: the array in `.github/workflows/deploy-workers.yml` under "Select workers" (44 names).
3. Confirm AR-1 without building the app: `grep -n "build:server\|pnpm build" Dockerfile package.json`; a Docker build in a sandbox settles it.
4. Confirm AR-3: compare `name` in `workers/<n>/wrangler.toml` and `apps/qron-platform/workers/<n>/wrangler.toml` for the five names.
5. Live state (AR-2, AR-4, AR-10): `wrangler deployments list` and the Cloudflare dashboard's Routes page for the zone; the repository cannot answer these.
