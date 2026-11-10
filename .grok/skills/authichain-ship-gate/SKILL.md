---
name: authichain-ship-gate
description: Check whether authichain-unified is safe to ship: CI status, open PRs, failing workflows, deploy health and the pilot-readiness chain. Outputs a SHIP or HOLD verdict with blockers. Use before any release and on a daily cadence.
---

Load the authichain-context skill first. Read-only inspection: never merge, never push, never deploy, never change repo or cloud settings.

STEP 1 - INSPECT via the GitHub connector on undone0603/authichain-unified:
- Latest runs of .github/workflows/deploy-cloudflare.yml and any other workflows: status, conclusion, failing job and failing step.
- Open PRs: title, age, review state, CI state, whether they touch billing, auth, tenancy or migrations.
- Commits to the default branch since the last check.
- Any new or changed files under drizzle migrations, workers/, worker/index.ts, wrangler.toml, wrangler.app.jsonc.
Then check the Vercel connector for the latest deployment states.
If a source is unavailable, write NO DATA. Do not infer green from silence.

STEP 2 - GRADE against the pilot-readiness chain: install, typecheck, lint, tests, production build, deploy smoke test, real product scan. Mark each PASS, FAIL or UNKNOWN.

STEP 3 - OUTPUT, under 200 words:
VERDICT: SHIP or HOLD.
BLOCKERS: each with file path, the failing step, and the one-line fix.
RISKY CHANGES: anything touching billing, authz, tenant scoping or migrations, flagged even if CI is green.
ROLLBACK: the exact command to revert the last deploy.
DO NEXT: one action under 60 minutes.
DECIDE: one yes/no question for the founder.

RULES:
- Missing authz, cross-tenant data access, unverified webhook signatures, unbounded API or model spend, and destructive migrations without a down path are always HOLD.
- UNKNOWN is not PASS. If you cannot verify a link in the chain, the verdict is HOLD.
- Never suggest disabling tests, types or auth to unblock a release. Cut scope instead.
- Never print secret values; reference secret names only. If a secret appears in code or logs, mark it as a leak and tell the founder to rotate it.
