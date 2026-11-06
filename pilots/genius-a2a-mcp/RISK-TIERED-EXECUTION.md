# Risk-tiered AgentZ execution and blocked-operation recovery
Status: experimental policy for GENIUS A2A/MCP pilot. This does not supersede repository protection, provider policies, government authorization, or production security gates.

## Tier 0 — autonomous
Local source inspection, public-source research, deterministic synthetic fixtures, local test runs, report generation, and drafting documentation. No secrets, external mutations, or spending. Log input revision, output digest, and test result.

## Tier 1 — autonomous on isolated development branch
Create/update nonproduction documentation, tests, fixtures, and narrowly scoped code changes; open draft pull requests; inspect CI; request independent review. Require branch-scoped credentials, least privilege, immutable source SHA and change summary. Never auto-merge if branch protection or required reviews remain unsatisfied.

## Tier 2 — explicit scoped authorization
Contact third parties, run public endpoint discovery where operator permission is needed, deploy to a nonproduction endpoint, or process customer-supplied documents. Require target identity, permitted methods, request limits, expiration, opt-in record, rollback and audit receipt. No bulk unsolicited government outreach.

## Tier 3 — independent approval and explicit transaction mandate
Production release, economic entitlements, funds acceptance/transfer, legally binding contracts, sensitive data, agency systems, government submissions, or regulated assertions. Require signed mandate and relevant reviewer approvals, existing organizational controls, applicable contracting authority, and verified delivery. No implicit escalation from Tier 0–2.

## Blocker recovery algorithm
1. Record the failed operation, exact target, non-sensitive error category, source revision, timestamp, and side-effect uncertainty.
2. If the block is a safety or policy denial, stop that action. Do not rephrase, fragment, rotate accounts, alter identities, or route through another provider to evade the denial.
3. If transient infrastructure failure, retry only idempotent operations with capped exponential backoff and request correlation. For ambiguous write outcomes, query state before any retry.
4. If missing permission or authorization, request the minimum required scope from the appropriate owner. Do not self-grant.
5. If CI runner unavailable, use an authorized isolated runner or execute local tests; label results clearly as local and do not substitute for independent exact-head CI.
6. If a repository write is blocked, retain the patch as a proposed change in a local artifact or approved alternate review channel; do not claim a commit or try disguised payloads.
7. If third-party contact is unapproved, prepare a draft and public technical artifact; wait for an authorized channel or explicit operator opt-in.
8. If payment or contract gate is unmet, deliver nonbinding evidence and leave economic actions disabled.
9. End with a truthful state: completed, partial, blocked, or needs approval. Never mark unexecuted tests green.

## Mandatory invariants
- No bypass of provider security restrictions, branch protection, billing holds, consent, signing mandates, or rate limits.
- No production secrets in development runners; no autonomous credential expansion.
- No private or government endpoints without authorized scope.
- Evidence status must distinguish observed, not tested, inconclusive, and rejected.
- Production financial actions remain held until independent delivery and explicit authority.
- The operator may lower friction only within preapproved tier limits; escalation always requires a new authorization.

## Pilot application
For PR #2329: autonomously revise source and synthetic tests on the feature branch, inspect workflow status, and prepare independent review evidence. If remote test writes are blocked, preserve a patch and record it. Do not merge, deploy an executable A2A endpoint, or contact government systems without the required gates.
