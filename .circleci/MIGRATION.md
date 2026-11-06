# Staged CircleCI migration and recovery

This draft was reconciled against `main` at `0fa5f1829ff6c19a6522e0bf6aefffc90ad5f1ef` following the merge conflict in PR #2368. It changes only the CI configuration and this document. The prior Launch/Farm pricing and checkout edits are intentionally **not** part of this CI migration; review those in separate feature/checkout PRs rather than overwriting the currently green main branch.

## Exact coverage

- Existing successful CircleCI jobs remain: `quality`, `typecheck-ratchet`, `test-workers`, `test-other`, and `build`. Main at `0fa5f1829ff6c19a6522e0bf6aefffc90ad5f1ef` showed success for all five in CircleCI.
- New `extras` checks the Drizzle migration source of truth and runs AgentZ pytest in a dedicated Python venv.
- New `main-quality-gate` depends on all six jobs. Do **not** make it required until its real integration-provided check name is observed and the gate genuinely passes.
- Each source-executing job verifies the checked-out revision matches `CIRCLE_SHA1` before installing repository dependencies.
- Shared pnpm caches were removed to avoid unreviewed cross-branch cache reuse. The existing known-green large executor and main job commands remain intact.
- The existing `test-workers` job is the first prerequisite for other jobs, to avoid wasting credits on downstream work after worker failures.
- No deploy, production, payment, or secret-bearing job is added. No existing GitHub job is disabled.

## Acceptance order

1. Verify CircleCI project and org credits plus free-plan/OSS eligibility. Maintain the 5,000-credit reserve and disable paid overage/refill.
2. Audit CircleCI environment variables, contexts, checkout keys, project tokens, OIDC trust, and fork settings. Confirm production credentials are inaccessible to PR code.
3. Independently review YAML, checkout SHA verification, root-source test commands, required-job graph, cache policy, and source-only scope.
4. On a credential-isolated eligible hosted executor, validate `.circleci/config.yml` with CircleCI CLI, run this PR's **exact head** and collect job IDs, logs and JUnit artifacts from all six jobs plus the aggregate.
5. Audit effective main branch protections and their DeployKey bypass. Require independently attributable human APPROVED review on the exact head before merge. The repository ruleset currently shows zero mandatory approvals; the operator must establish real enforced protections rather than merely trusting that setting.
6. After all gates pass, merge through reviewed protected path. Any actual production deployment needs a separate protected workflow and evidence.

## Not yet established

- CircleCI project credential isolation and exact-head migration CI.
- GitHub Actions hosted billing eligibility or independent credential-isolated runner attestation.
- An eligible independent human approval.
- Effective branch protection independent of the active DeployKey bypass.
- Production deployment authorization and post-deploy checks.

## Rollback

Revert the migration commit only after reviewing its replacement checks; do not remove a failing required check merely to unblock a merge. No production changes are made by this draft.
