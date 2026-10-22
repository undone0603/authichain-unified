# Repository inventory

Evidence date: 2026-10-22. Source: clone of `undone0603/authichain-unified` at `main` `caf0f083`
(5,181 commits, 4,720 tracked files, 364 remote branches, 1 tag `v1.0.0-launch`).
Status labels: **PR** production-ready, **FI** functional/incomplete, **EX** experimental,
**DUP** duplicate, **OBS** obsolete, **BL** blocked, **SEC** security-sensitive.
"Not yet inspected" means no evidence was gathered; it is not a verdict.

Prior one-line stub, preserved: `Default Branch: main | Commit: 5ee076b7 | Open MRs: 96 | Open Issues: 61`
(stale; live counts are in the table below).

## Live counts

| Item | GitHub | GitLab (`authichain-group/authichain-unified`) |
| ---- | ------ | ------ |
| `main` head | `caf0f083` | `caf0f083` (identical) |
| Branches | 364 | 360 |
| Open PRs / MRs | 50+ PRs (45 non-Dependabot, mostly drafts) | 97 MRs |
| Open issues | 43 | not counted |
| Workflows / pipelines | 106 workflow files | `.gitlab-ci.yml` (see `CI_STATUS.md`) |

## Components

| Component | Location | Purpose | Status | Dependencies | Tests | Destination | Next action |
| --------- | -------- | ------- | ------ | ------------ | ----- | ----------- | ----------- |
| Web app and API routes | `src/` (558 files) | Next.js app: checkout, DPP, verify, QRON pages, `/api/v1/*` | FI, SEC | Next, Supabase, Stripe | `src` + `protocol`: 159 files, 1,286 pass, 1 skipped (after the fixes on branch `fix/p1-dpp-fulfill-test-cas-mock`) | stays | Merge !1999 on GitHub (BLOCKERS B-1) |
| Checkout and plans | `src/lib/plans.ts`, `src/lib/checkout-gate.ts` | Catalogue and gated Stripe Checkout session creation; `plans.ts` is the source of truth for anything that charges | FI, SEC | Stripe | `checkout-gate*.test.ts` pass (48 tests with attestation suites) | stays | Gate removed in draft !1999 per owner decision (BLOCKERS B-1); merge on GitHub, then Stripe test-mode check |
| Stripe webhook and provisioning | `workers/stripe-webhook/`, `src/app/api/stripe/webhook/`, `src/lib/provisioning.ts`, `src/lib/dpp-fulfill-checkout.ts` | Verified webhook, per-session idempotent grants, compare-and-set entitlement write (`ef4d083e`), `humanHold` for DPP prices (`workers/stripe-webhook/src/grant-map.ts`) | FI, SEC | Stripe, Supabase | Replay, unpaid-hold, humanHold and fulfillment tests pass after the test-mock fixes | stays | Add sandbox end-to-end run (NEXT_ACTIONS N-4) |
| Outbound send policy | `workers/authichain-verify-worker/src/outbound-gate.ts`, `outbound-types.ts` | `production_send` defaults to `false`; email blocked while off | PR, SEC | none | `outbound-pipeline.test.ts` passes | stays | Do not alter; test only |
| Protocol and attestation | `protocol/`, `schemas/`, `fixtures/attestation-v0.1-*` | Signed records (Ed25519 / did:key), JWS attestation v0.1, JWKS, trust registry, adversarial fixtures (expired, replayed, tampered) | FI | none | `protocol/verifier.test.mjs`, `trust-registry.test.ts` pass | stays | Bind dogfood record to commit and artifact (N-3) |
| Canonical verifier | `packages/verifier`, `workers/authichain-verify-worker/` | Verification Decision v1; Next adapter at `src/app/api/v1/attestations/verify/route.ts` meters then returns the worker verdict | FI, SEC | worker | verify-worker suites pass | stays | Add to GitLab CI |
| Edge workers | `workers/` (49 projects, 49 wrangler configs, 392 files) | authichain-com, gs1-resolver, dpp-fulfillment, manufacturer-status, brand sites | mixed; estate drift tracked in GitHub issues #1817, #1331, #952 | Cloudflare | Run only through the root vitest config; most worker packages have no `test` script | stays | Reconcile estate drift (owner-side Cloudflare access) |
| AgentZ | `agentz/` (242 files, Python), `workers/authichain-agentz*`, `server/agents/` | Orchestration, swarm, healing, workflows | FI | LM Studio, integrations | `agentz/tests` has 34 files; **not run in this baseline** | stays | Run Python suite (N-6) |
| Autonomy loops | `.github/workflows/` (106), `.github/autonomy.json`, `docs/OPERATING_CHARTER.md` | Lanes: ship, health, revenue, growth, repair, manual, retired; switchboard is `autonomy.json` | FI, BL | GitHub Actions (billing-locked per `.gitlab-ci.yml` header and issue #1871) | n/a | move key lanes to GitLab schedules | See `AGENT_OPERATIONS.md` (not yet written) |
| QRON | `apps/qron-platform/`, `workers/qron-*`, `workers/authichain-qron-provenance` | AI QR art, provenance, outreach | FI | Stripe, Cloudflare | Not separately run | stays | Inventory in a later pass |
| GovChain | `workers/govchain-us/`, `server/` gov-engine scripts, `libs/opensam` submodule (not initialised) | Government opportunity ingestion and scoring | FI | SAM.gov data, OpenSAM submodule | Not separately run | stays | Do not claim qualification or certification |
| StrainChain | `workers/strainchain-io/`, `src/lib/genetics.ts`, `docs/strategy/strainchain-genetics-passport.md` | Genetics passports; totals derived at render time | FI | none | genetics tests run inside the `src` suite | stays | Read the design doc before changing |
| Nightstamp | `scripts/nightstamp-scan-gate.ts`, `.github/workflows/nightstamp-scan-gate.yml`, `drizzle/0010_nightstamp.sql`, `src/app/api/starmap/*` | Scan gate and starmap checkout/fulfil | FI | Stripe, Supabase | Not separately run | stays | Locate full implementation |
| Smart contracts | `contracts/` | AuthiChain NFT, QRON ERC-20 template, billing, bounty, subscriptions | EX, SEC | Hardhat | `pnpm test:contracts`; **not run** | stays | Run in a later pass; no deploys |
| Database | `supabase/` (124 files), `drizzle/` (45) | Postgres schema and migrations | SEC | Supabase | n/a | stays | Issue #1735: review SECURITY DEFINER views and RPC grants |
| Dogfood script | `scripts/generate-dogfood.mjs`, GitLab job `dogfood_record` | Signs a reference record with an ephemeral Ed25519 key and verifies it with `protocol/verifier.mjs` | FI | none | Run on 2026-10-22: verdict `valid-unanchored`; 6 negative cases rejected (`VERIFICATION_EVIDENCE.md`) | stays | Subject is a reference demo, not a release artifact (N-3) |
| Draft PR backlog | GitHub PRs #1954-#1990 (draft) | Evidence writers, passport tally, DSCSA, hash publication, CircleCI gates | FI (unreviewed) | varies | per PR | review in priority order | Triage into `RECOVERED_WORK.md` (N-5) |
| Documentation | `docs/` (528 files) | Strategy, operations, charter | mixed | none | n/a | stays | `AUTHICHAIN_EXECUTION_PLAN.md` conflicts with `.gitlab-ci.yml` (see `CI_STATUS.md`) |

## Secret hygiene (2026-10-22)

A pattern scan of tracked files (live-key prefixes, PEM headers, `AKIA`, `ghp_`, `glpat-`, `xox*`)
returned 13 hits in 10 files. None has a key body within six lines: they are PEM header strings in
parsers, test fixtures and migration docs, and placeholder-style token examples. No secret values were
printed. Tracked env files are the three `.env*.example` / `.env.template` files only. A full
history scan (gitleaks) has not been run; `.gitleaks.toml` exists and the GitLab `secret_scan` job is
currently gated on Cloudflare variables (see `CI_STATUS.md`).
