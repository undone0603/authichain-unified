# Cloudflare-first integration baseline

`main` is the only integration baseline. A green check run is necessary, never sufficient, to merge.

## Naming of work

| Classification         | Meaning                                                                                     | Default action                                             |
| ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `mergeable`            | Small independent fix with required checks green **and** no Vercel/deploy/architecture risk | Open or keep a PR; human merge                             |
| `duplicate_superseded` | Commits already on `main`, or the PR is fully contained by `main`                           | Comment, label `hygiene:superseded`, close if `apply=true` |
| `vercel_excluded`      | Touches Vercel deploy/config as a deploy path                                               | Exclude from merge; do not deploy                          |
| `needs_human`          | Security, revenue, schema, DNS, secrets, or ambiguous architecture                          | Stop. Request a decision.                                  |

Never merge merely because a branch is green.

## Deployment authority

Cloudflare Workers + GitHub Actions (`.github/workflows/deploy-workers.yml`, `deploy-cloudflare.yml`, `deploy-authichain-com.yml`) are the deploy path.

Vercel workflows and `vercel deploy --prod` are **excluded** unless a human explicitly requests a Vercel action. The CI guard `scripts/guard-vercel-deploy.mjs` fails the PR if a workflow grows a Vercel deploy step.

This session does not deploy. Production health is verified with **read-only** probes from `main`.

## Database

Supabase repair is a separate lane from application deploy.

- Intended remote baseline: `supabase/REMOTE_APPLIED_VERSIONS.txt` (QRON-v2 `nhdnkzhtadfkkluiulhs`, captured 2026-09-20; restored locally in #1133).
- Repair **only** mismatches already identified in that file and #1133. Do not invent schema.
- `20260920000001` is local-only (`ADD COLUMN IF NOT EXISTS`); do not auto-apply it.
- Schema drift is read-only (`scripts/check-schema-drift.mjs`). Exit 2 (cannot reach DB) is infra, not a license to migrate.
- No autonomous production migration changes.

## Production smoke gate

`scripts/production-smoke-gate.ts` walks the money + verification path on `https://authichain.com`:

origin → verification endpoint → signed attestation / JWKS → object lookup → Stripe checkout surface → provisioning health → CRM/status telemetry

It is GET/read-only. It does not create Stripe sessions or write funnel events.

## Autonomous repair loop

On a failed required check:

1. Classify
2. Apply only safe deterministic fixes (format/lint autofix)
3. Commit to a `cursor/ci-repair-*` branch
4. Open a draft PR
5. Required checks must pass
6. Merge only if classified `mergeable` **and** a human approves — green alone is not enough

Hard boundaries: no disabling checks, no weakening permissions, no deleting tests, no production migrations, no Vercel deploy, escalate ambiguous architecture.

## Thin commercial surfaces

AuthiChain verification lives in shared infrastructure (`src/lib/dpp-verify.ts`, `packages/verifier`, `/protocol/jwks.json`). QRON, GovChain, StrainChain, Nightstamp, and Storepilot supply audience UX, pricing, acquisition, onboarding, and copy. They must not reimplement verification.

## Revenue proof

`/admin/revenue-proof` reports only commercial loop signals reconstructed from `funnel_events` (see `src/lib/revenue-proof.ts`).
