# Copilot Instructions — authichain-unified

## What this repo actually is

One repo serves **two very different systems** that happen to share a git history:

1. **The network app** — a Next.js app at the repo root (`src/` + `client/` + `server/`, built with `next build`) deployed on Vercel project `qron-platform`. It serves _every_ brand domain (qron.space, authichain.com, govchain.us, strainchain.io, ~50 pitch subdomains, etc.) as one multi-tenant deployment — there is no per-brand app.
2. **AgentZ** (`agentz/`) — a standalone Python control-plane/CLI for autonomous ops workflows (scouting, billing, blockchain anchoring, outreach, compliance). It has its own `pyproject.toml`, tests, and CLI entrypoint; it is not wired into the JS build at all.

Alongside these: a Cloudflare Edge Worker (`worker/`, own `package.json`/`wrangler.toml`, deployed under the `authichain-unified` Vercel project with `rootDirectory: worker`), and a separate large fleet of standalone Cloudflare Workers under `workers/<name>/` (each with its own `wrangler.toml` as the source of truth for routes/crons), deployed by `.github/workflows/deploy-cloudflare.yml`.

`apps/*` (agent-browser, chatbot, client, qron-platform, verifier-web) and everything under `apps/` are **deliberately excluded** from the root `tsconfig.json` and from the pnpm workspace — they are inert archival/experimental trees. Don't assume code there is built or live; check `docs/NETWORK.md` before wiring something in.

See `docs/NETWORK.md` for the authoritative, dated map of what deploys where (it is kept current — trust it over guessing from folder names) and `docs/CAPABILITIES.md` for the capability catalog (tRPC routers, API routes, workers, schedulers, AgentZ workflows).

## Path aliases (non-obvious, will silently break)

`tsconfig.json` / `vitest.config.ts` define `@/*` to resolve to **both** `./src/*` and `./client/src/*` — server-only subpaths (`@/db`, `@/lib/attestation`) are special-cased _before_ the generic `@/` → `client/src` catch-all in `vitest.config.ts`. If you add a new server-only path under `@/`, add its own regex alias above the catch-all, or it will silently resolve into `client/src` instead. Other aliases: `@shared` → `shared/`, `@authichain/verifier|evidence|policy` → `packages/<name>/src/index.ts`.

## Build, lint, test

Package manager is **pnpm** (10.28.2, Node 22 — see `.nvmrc`). Orchestration is via **Turborepo** (`turbo.json`).

```bash
pnpm install --no-frozen-lockfile   # CI uses --config.minimumReleaseAge=0 too
pnpm check       # turbo run check (typecheck)
pnpm lint        # turbo run lint
pnpm lint:ci     # eslint + prettier --check, exactly what CI runs
pnpm build       # turbo run build (next build at root, etc.)
pnpm test        # turbo run test (vitest across all workspaces)
```

Run a single JS/TS test file directly with vitest (don't go through turbo for this):

```bash
npx vitest run server/db.test.ts
npx vitest run client/vitest.config.ts -t "test name"   # client has its own vitest config
```

Contracts: `pnpm test:contracts` (hardhat test, config `hardhat.config.cts`).

AgentZ (Python) tests use pytest and live in `agentz/tests/`:

```bash
source .venv/bin/activate
pytest agentz/tests/test_closer.py
pytest agentz/tests/test_closer.py::test_specific_case
```

CI (`.github/workflows/ci.yml`) runs, in order: secret-format check → `pnpm install` → `pnpm check` → `pnpm lint:ci` → `pnpm -w test` → pytest (best-effort) → `pnpm build`. Match this sequence when validating a change.

## AgentZ conventions

Each core agent lives in `agentz/core/<name>.py` (scout, builder, media, trust, growth, blockchain, hubspot, microsites, compliance, billing, redemption, analytics, marketing, pi, pages) and is invoked through named workflow handlers (e.g. `authichain_pilot_deploy`, `authichain_expansion`, `hot_lead_outreach_blitz`, `authichain_global_scale`, `authichain_compliance_audit`) via `python -m agentz.cli run <workflow-name> --mode dry-run|confirm|auto`. Outbound LLM calls use a waterfall failover in `agentz/core/llm.py` (Cerebras → DeepSeek → LM Studio → Ollama; GPT-4o/Gemini are commented out pending billing/API-key setup), with retries/backoff via `tenacity` on 429s, and custom browser tools are reapplied automatically when failing over providers.

## Deployment gotcha (must-know)

Multiple Vercel projects point at this one repo with different `rootDirectory`/framework settings — mixing them up breaks the site. The repo root (network app, `src/`+`client/`+`server/`) builds with **Next.js** (`next build`) under the `qron-platform` project. Separately, `client/` is a standalone **Vite** SPA (`pnpm run build` → `dist/`) — if a project pointed at `client/` (or `worker/`) is misconfigured as Next.js instead of Vite, JS/CSS asset requests get served as `text/html`, causing a fatal white screen. Always confirm which Vercel project owns which folder in `docs/NETWORK.md` before changing `rootDirectory` or framework settings.

## Data

Supabase Postgres is the primary database (additive migrations only — see `docs/NETWORK.md`); Drizzle (`drizzle.config.ts`, `drizzle/`) manages schema/migrations for the D1/Postgres-backed tables (`pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`). Cloudflare D1 (`authichain-db`) and KV/R2 bindings back the edge worker (`worker/`), configured in `wrangler.toml`.

## Repo hygiene note

The repo root is cluttered with many one-off scripts (`seed-*.js`, `check-*.js`, migration helpers) from past sessions — these are not part of any documented workflow. Don't assume a root-level script is load-bearing just because it exists; check `docs/NETWORK.md`, `docs/CAPABILITIES.md`, or `package.json` scripts to confirm before relying on or modifying one.
