# Staged CircleCI migration and recovery

This draft was reconciled against `main` at `0fa5f1829ff6c19a6522e0bf6aefffc90ad5f1ef` following the merge conflict in PR #2368. Checkout, pricing, and Launch/Farm behavior changes are deliberately out of scope. Follow [risk-based change and release gates](../.github/CHANGE_RELEASE_GATES.md) rather than requiring the same approvals for every change.

## Scope and evidence

- The five core CircleCI jobs on `main` (`quality`, `typecheck-ratchet`, `test-workers`, `test-other`, and `build`) reported success at `0fa5f1829ff6c19a6522e0bf6aefffc90ad5f1ef`. **This is not evidence for this PR head.**
- The draft preserves those jobs and adds `extras`: Drizzle migration-source checking plus AgentZ pytest in a dedicated Python venv.
- The new `main-quality-gate` depends on all six jobs. Its actual provider-reported name, success, and correct branch-protection source must be verified before it becomes a required check.
- Each repository-code-executing job compares checkout HEAD to `CIRCLE_SHA1` before installing dependencies. Cross-branch pnpm caches were removed on this draft.
- `test-workers` runs first; dependent jobs do not start if it fails. No production deployment, signing, financial, merge, or credentials job was added. Existing GitHub workflows are unchanged.

## Risk classification for this PR

**Tier B, conditional.** A CI migration changes where untrusted repository source executes; it is eligible for ordinary maintainer acceptance **only after** independent evidence shows the new CircleCI project and hosted executor are credential-isolated and do not gain privileged contexts, deploy keys, broad repository tokens, OIDC cloud trust, production secrets, or self-hosted access. If any access expands or the boundary remains uncertain, escalate to **Tier C**, with qualified independent human security approval.

This is not merely a documentation PR. A source-only review does not establish provider configuration, execution eligibility, or security containment.

## Shortest legitimate acceptance path

1. Check CircleCI's actual free-plan eligibility, current credit balance, and the operator's 5,000-credit reserve. No paid overage/automatic upgrade or repeated full-suite runs without need.
2. Inspect CircleCI project secrets, contexts, tokens/checkout key, SSH, OIDC trust, fork policies, runner class, and branch source; confirm PR code cannot access privileged credentials. Reuse a current attestation if still valid.
3. Validate configuration syntax with the actual CircleCI CLI. Run the candidate's **exact head** in an eligible credential-free executor and collect actual statuses/logs, Drizzle/AgentZ pytest JUnit, all six jobs, and aggregate. No skipped/pending states counted as passes.
4. If the config is non-privilege-expanding after step 2, obtain a recorded acceptance from an authorized maintainer and comply with **actual** enforced GitHub rules. A separate security review is optional for Tier B unless rules require it. If step 2 finds a trust-boundary change, obtain independent qualified human approval under Tier C instead.
5. Merge through the authorized PR path only if required exact-head checks pass and effective branch protection is satisfied. GitHub Actions billing/runner recovery is **not** an extra mandatory gate if equivalent required checks genuinely run on safe CircleCI; do not silently remove enforced GitHub checks.
6. Keep all production, payment, outbound, and auto-merge controls held. Any future release uses a separate protected decision and evidence record.

## Known gaps as of this draft

- No successful exact-head CircleCI run (including `extras` and `main-quality-gate`) on this migration candidate.
- CircleCI project credential settings, current free credits, and fully isolated execution have not been verified from this connection.
- GitHub Actions jobs remain queued/unavailable; do not send PR code to an unattested persistent runner.
- Main's accessible ruleset shows zero required reviews and a DeployKey bypass; this risk is documented, **not repaired or verified as safe**.
- No protected release or payment change is authorized or implied by this draft.

## Rollback

If the reviewed migration is later found unsafe or fails validation, revert the CI-only commit and restore approved required checks via the normal protected path. Never remove a failing required check merely to force a merge.
