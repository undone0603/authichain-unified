# Next actions

Updated 2026-10-22.

```
CURRENT BRANCH:        fix/p1-dpp-fulfill-test-cas-mock (GitHub PR #1995) and fix/p1-qron-launch-checkout-gate (PR #1996, ON HOLD), base main caf0f083
CURRENT COMMIT:        branch head on GitLab (see the draft MR)
LAST SUCCESSFUL PIPELINE: none for this branch yet; GitLab duo_workflow pipeline 2974654044 succeeded on main caf0f083
CURRENT TASK:          Owner decision on monthly Launch (B-1); PR triage (N-5); baselines (N-6)
COMPLETED:             Audit of GitHub and GitLab; secret-pattern scan; baseline tests; 11 stale-test failures fixed;
                       dogfood positive and 6 negative cases run; inventory, migration, CI, evidence and blocker docs;
                       gate-removal PR #1996 drafted, then put on hold after finding PR #1905 (B-1); first-pass PR triage
IN PROGRESS:           N-6 local baselines; N-5 code review of the HOLD, duplicate and stale PRs
FAILED:                git push (403 from session proxy) and GitHub connector write (403); see BLOCKERS B-3
BLOCKED:               B-1 owner decision, B-3 GitHub write path, B-4 GitHub billing, B-5 Cloudflare build log, B-6 deploy
NEXT ACTION:           N-6, then N-4 once sandbox keys are supplied through an approved mechanism; N-1 waits for the owner
```

Ordered by the P0-P5 scale in the brief.

| ID | Priority | Task | Done when |
| -- | -------- | ---- | --------- |
| N-1 | P1 | Owner decision on monthly Launch (BLOCKERS B-1). Recommended: keep it closed, finish the #1905 unlist and show an honest "no longer offered" message. PR #1996 (removes the gate) is on hold | Decision recorded; one PR ships it; a Stripe test-mode check confirms the result |
| N-2 | P3 | GitLab job running the root vitest suite on MRs touching `src`, `protocol`, `workers`, plus schedule; secret scan that does not depend on Cloudflare variables | A real pipeline runs it and the pipeline id is recorded in `CI_STATUS.md` |
| N-3 | P3 | Bind the dogfood record to `CI_COMMIT_SHA`, version, timestamp and a build-artifact SHA-256; verify with the repo verifier; keep negative cases as a vitest test | `VERIFICATION_EVIDENCE.md` shows commit and artifact fields |
| N-4 | P1 | Stripe sandbox end-to-end: checkout, signed webhook, duplicate webhook, unauthorized request, entitlement row; no live money | Test-mode transcript recorded |
| N-5 | P3 | First pass done from PR metadata (`RECOVERED_WORK.md`): 102 open PRs. Next: read the code of the HOLD, duplicate and stale PRs before any merge or close | Each PR classified merge, rework or close after review |
| N-6 | P3 | `agentz` Python tests done (284 passed, 1 skipped). Still to baseline: `pnpm test`, `pnpm lint`, `pnpm build`, `workers/gs1-resolver` tests | Results added to `CI_STATUS.md` |
| N-7 | P3 | Itemise the 4-branch GitHub/GitLab delta; compare the 15 sibling GitLab projects with the monorepo | `GITLAB_MIGRATION.md` updated |
| N-8 | P1 | Owner reads the Cloudflare build log for `Workers Builds: govchain-us` (BLOCKERS B-5); fix the cause | `main` pipeline passes |
| N-9 | P2 | Document the customer loop from `src/lib/plans.ts` and live checkout routes (`REVENUE_LOOP.md`) without inventing metrics | Doc cites real routes and prices |
| N-10 | P3 | Write `AGENT_OPERATIONS.md` from the existing AgentZ code and `autonomy.json` lanes, with retry bounds and idempotency keys | Doc matches code |

Not yet written (no evidence gathered): `ARCHITECTURE_AND_MODULE_MAP.md`, `REVENUE_LOOP.md`, `AGENT_OPERATIONS.md`.
