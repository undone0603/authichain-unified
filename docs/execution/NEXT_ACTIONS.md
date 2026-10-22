# Next actions

Updated 2026-10-22.

```
CURRENT BRANCH:        fix/p1-dpp-fulfill-test-cas-mock on GitLab (base main caf0f083); not on GitHub
CURRENT COMMIT:        branch head on GitLab (see the draft MR)
LAST SUCCESSFUL PIPELINE: none for this branch yet; GitLab duo_workflow pipeline 2974654044 succeeded on main caf0f083
CURRENT TASK:          Review the draft MR for the test fixes and execution docs
COMPLETED:             Audit of GitHub and GitLab; secret-pattern scan; baseline tests; 11 stale-test failures fixed;
                       dogfood positive and 6 negative cases run; inventory, migration, CI, evidence and blocker docs
IN PROGRESS:           Draft MR for the branch
FAILED:                git push (403 from session proxy) and GitHub connector write (403); see BLOCKERS B-3
BLOCKED:               B-1 token issuer, B-2 mirror direction, B-5 main pipeline failure reason
NEXT ACTION:           N-8, then N-4 (N-1 waits for the B-1 decision)
```

Ordered by the P0-P5 scale in the brief.

| ID | Priority | Task | Done when |
| -- | -------- | ---- | --------- |
| N-1 | P1 | Owner decision on the QRON gate (BLOCKERS B-1). Until then only tests that pin current behaviour and honest wording; no change to which SKUs are gated and no gating of `qron_launch_annual` | Decision recorded, then implement and test |
| N-2 | P3 | GitLab job running the root vitest suite on MRs touching `src`, `protocol`, `workers`, plus schedule; secret scan that does not depend on Cloudflare variables | A real pipeline runs it and the pipeline id is recorded in `CI_STATUS.md` |
| N-3 | P3 | Bind the dogfood record to `CI_COMMIT_SHA`, version, timestamp and a build-artifact SHA-256; verify with the repo verifier; keep negative cases as a vitest test | `VERIFICATION_EVIDENCE.md` shows commit and artifact fields |
| N-4 | P1 | Stripe sandbox end-to-end: checkout, signed webhook, duplicate webhook, unauthorized request, entitlement row; no live money | Test-mode transcript recorded |
| N-5 | P3 | Triage the 45 non-Dependabot open PRs (mostly drafts #1954-#1990) into `RECOVERED_WORK.md` | Each PR classified merge, rework or close |
| N-6 | P3 | Baseline `agentz` Python tests, `pnpm test`, `pnpm lint`, `pnpm build`, `workers/gs1-resolver` tests | Results added to `CI_STATUS.md` |
| N-7 | P3 | Itemise the 4-branch GitHub/GitLab delta; compare the 15 sibling GitLab projects with the monorepo | `GITLAB_MIGRATION.md` updated |
| N-8 | P1 | Read pipeline `2974628977` failure reason in the GitLab UI; fix | `main` pipeline passes |
| N-9 | P2 | Document the customer loop from `src/lib/plans.ts` and live checkout routes (`REVENUE_LOOP.md`) without inventing metrics | Doc cites real routes and prices |
| N-10 | P3 | Write `AGENT_OPERATIONS.md` from the existing AgentZ code and `autonomy.json` lanes, with retry bounds and idempotency keys | Doc matches code |

Not yet written (no evidence gathered): `ARCHITECTURE_AND_MODULE_MAP.md`, `RECOVERED_WORK.md`, `REVENUE_LOOP.md`, `AGENT_OPERATIONS.md`.
