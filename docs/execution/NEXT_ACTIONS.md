# Next actions

Updated 2026-10-22.

```
CURRENT BRANCH:        fix/p1-dpp-fulfill-test-cas-mock (!1998) and fix/p1-qron-launch-checkout-gate (!1999), base main caf0f083; GitLab only
CURRENT COMMIT:        branch head on GitLab (see the draft MR)
LAST SUCCESSFUL PIPELINE: none for this branch yet; GitLab duo_workflow pipeline 2974654044 succeeded on main caf0f083
CURRENT TASK:          Carry !1998 and !1999 to GitHub; baselines (N-6); Stripe test-mode run (N-4)
COMPLETED:             Audit of GitHub and GitLab; secret-pattern scan; baseline tests; 11 stale-test failures fixed;
                       dogfood positive and 6 negative cases run; inventory, migration, CI, evidence and blocker docs;
                       QRON Launch gate removed in draft !1999 with a regression test; issue #2005
IN PROGRESS:           N-6 local baselines
FAILED:                git push (403 from session proxy) and GitHub connector write (403); see BLOCKERS B-3
BLOCKED:               B-3 GitHub write path, B-5 Cloudflare build log, B-6 deploy
NEXT ACTION:           N-6, then N-4 once sandbox keys are supplied through an approved mechanism
```

Ordered by the P0-P5 scale in the brief.

| ID | Priority | Task | Done when |
| -- | -------- | ---- | --------- |
| N-1 | P1 | QRON Launch gate removed in draft !1999 (decision recorded, BLOCKERS B-1). Merge on GitHub, deploy with owner confirmation, then Stripe test-mode check on `/checkout/qron_launch` | Merged, deployed, test-mode checkout reaches Stripe and entitlement row appears |
| N-2 | P3 | GitLab job running the root vitest suite on MRs touching `src`, `protocol`, `workers`, plus schedule; secret scan that does not depend on Cloudflare variables | A real pipeline runs it and the pipeline id is recorded in `CI_STATUS.md` |
| N-3 | P3 | Bind the dogfood record to `CI_COMMIT_SHA`, version, timestamp and a build-artifact SHA-256; verify with the repo verifier; keep negative cases as a vitest test | `VERIFICATION_EVIDENCE.md` shows commit and artifact fields |
| N-4 | P1 | Stripe sandbox end-to-end: checkout, signed webhook, duplicate webhook, unauthorized request, entitlement row; no live money | Test-mode transcript recorded |
| N-5 | P3 | Triage the 45 non-Dependabot open PRs (mostly drafts #1954-#1990) into `RECOVERED_WORK.md` | Each PR classified merge, rework or close |
| N-6 | P3 | Baseline `agentz` Python tests, `pnpm test`, `pnpm lint`, `pnpm build`, `workers/gs1-resolver` tests | Results added to `CI_STATUS.md` |
| N-7 | P3 | Itemise the 4-branch GitHub/GitLab delta; compare the 15 sibling GitLab projects with the monorepo | `GITLAB_MIGRATION.md` updated |
| N-8 | P1 | Owner reads the Cloudflare build log for `Workers Builds: govchain-us` (BLOCKERS B-5); fix the cause | `main` pipeline passes |
| N-9 | P2 | Document the customer loop from `src/lib/plans.ts` and live checkout routes (`REVENUE_LOOP.md`) without inventing metrics | Doc cites real routes and prices |
| N-10 | P3 | Write `AGENT_OPERATIONS.md` from the existing AgentZ code and `autonomy.json` lanes, with retry bounds and idempotency keys | Doc matches code |

Not yet written (no evidence gathered): `ARCHITECTURE_AND_MODULE_MAP.md`, `RECOVERED_WORK.md`, `REVENUE_LOOP.md`, `AGENT_OPERATIONS.md`.
