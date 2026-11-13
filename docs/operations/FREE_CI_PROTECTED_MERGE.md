# Credential-free CI and protected merge runbook

Applies to the public `undone0603/authichain-unified` repository, including AgentZ PR #2455.

## Trust boundaries

- GitHub Actions hosted jobs may fail *before execution* while the repository account has a billing lock. An unavailable hosted runner is not test evidence; never rerun it repeatedly to fix an account-level issue.
- Use the existing CircleCI `.circleci/config.yml` Docker executor and `.circleci/quality-check.sh` to validate untrusted pull requests. **No production contexts, protected credentials, production tokens, host mounts, or privileged runners** may enter PR jobs.
- Enforce the previously established **5,000-credit reserve**. Avoid redundant pipelines and do not start extra paid executors. CircleCI free account balance is not asserted by this document.
- The six bounded jobs (`quality`, `typecheck-ratchet`, `test-workers`, `test-other`, `build`, and `extras`) must all succeed before `main-quality-gate`. Do not treat a successful aggregate status without its upstream job evidence as sufficient.
- AgentZ coverage in `test-workers` includes `worker-runtime.test.mjs`, `automation-integration.test.mjs`, and `memory.test.mjs`. `extras` runs the five Python `test_agentz_*.py` focused suites individually, an MCP import smoke, and the existing `agentz/tests` pytest suite.

## Gate inventory and current blocker (2026-11-11 UTC)

- The GitHub branch metadata for `main` declares a required status context **`ae/rule18-gate`**; the active repository rulesets also require pull requests and prohibit bypass actors.
- No producer for `ae/rule18-gate` was identified in repository code search or the recorded statuses for PR #2455 (`7a6f9db98025dafb90231ef0e0f85412262b8023`) and current `main`. **Its ownership and security semantics remain unknown.** Treat it as an active unresolved dependency, not a nuisance to spoof or skip.
- The proven external status currently emitted by the CircleCI integration is **`ci/circleci: main-quality-gate`**, with six accompanying `ci/circleci:` job statuses. GitHub checks from billing-locked hosted jobs do not substitute for these.
- PR #2455 is a draft; no independent review was recorded during this investigation. No branch-protection, release, deployment, migration, or billing setting was changed.

## Reusable protected merge procedure

1. **Read exact heads.** Confirm the candidate PR branch SHA and current `main` SHA; stop if the PR head changes before results are reviewed. Inspect the changed files, permissions, worker/runner routing, migrations, and potential secret/credential exposure.
2. **Validate externally.** Read CircleCI's reported statuses and job logs for that exact SHA. Require all six jobs and `ci/circleci: main-quality-gate` to be successful and verify that the aggregate job actually depends on all six. A green status from an older SHA is invalid. If a check is missing, leave the PR blocked.
3. **Preserve independent security review.** Obtain an eligible reviewer distinct from the author for changes affecting runner routing, trust policy, schedules, database migrations, or deployments. No automated green test can impersonate an independent approval. Resolve material findings; do not move a draft to ready or merge before accepted scope and applicable approvals.
4. **Reconcile the legacy required status.** Identify the original owner/producer and actual policy of `ae/rule18-gate` with repository administrator evidence. If still live, restore its legitimate status-producing integration. If independently confirmed retired, an authorized administrator may **replace** the stale required context with `ci/circleci: main-quality-gate` (and any other necessary equivalent security checks), retaining the required-status policy, PR protections, and no-bypass controls. Treat this as a separately reviewed security-policy change; never merely delete the required-check requirement or post a synthetic success.
5. **Confirm GitHub's merge box.** Verify the selected branch protection and ruleset requirements using the administrator's view; this read-only connector may not expose all protected-rule details. Ensure GitHub recognizes the CircleCI status source and evaluates the latest commit or test-merge SHA correctly. Require the actual checks and review evidence before using the normal protected PR merge.
6. **Separate release.** A merge is not a deployment authorization. Keep production Cron activation, D1 migrations, `humanHold`, `production_send=false`, payment/entitlement actions, customer messages, and release secrets under their existing protected processes. For PR #2455, review existing D1 row mutation impact before any remote migration.

## Read-only evidence commands (with authenticated `gh` CLI)

```bash
REPO=undone0603/authichain-unified
SHA=$(gh pr view 2455 -R "$REPO" --json headRefOid --jq .headRefOid)
gh api "repos/$REPO/commits/$SHA/status" --jq '.statuses[] | [.context,.state,.target_url] | @tsv'
gh api "repos/$REPO/commits/$SHA/check-runs" --jq '.check_runs[] | [.name,.status,.conclusion] | @tsv'
gh api "repos/$REPO/branches/main" --jq '.protection.required_status_checks.contexts'
```

Only use these commands to inspect real provider evidence. They do not approve, synthesize status checks, merge, or deploy.
