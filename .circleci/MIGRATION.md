# GitHub Actions to CircleCI cutover

Prepared against main `cd4cad0f1bb4148e9109bfc0c4a97836bae10c59`. This is a staged CI migration, not a completed cutover or production release.

## Coverage

| GitHub source | CircleCI job |
| --- | --- |
| main.yml typecheck and lint | quality |
| main.yml worker tests | test-workers |
| main.yml remaining workspace tests | test-other |
| main.yml production build | build |
| typecheck-ratchet.yml | typecheck-ratchet |
| ci.yml Drizzle and AgentZ pytest | extras |
| Aggregate success | main-quality-gate |

CircleCI runs all branches including Dependabot. The other-workspaces shard includes all non-worker-path packages rather than additionally excluding package names containing worker. Builds always run. Existing test retry behavior remains visible in job logs.

Each source-executing job verifies HEAD equals CIRCLE_SHA1 before dependency installation and stores the revision as an artifact. No shared dependency caches are restored or saved, avoiding cross-branch cache reuse during migration. Checkout still uses the integration's access; use read-only repository access.

## Activation and acceptance

1. Connect the existing repository to one CircleCI integration and configure its pipeline to read .circleci/config.yml from the code revision. Avoid duplicate OAuth and GitHub App triggers. Enable PR updates and main pushes, including automation-created branches; verify actual event delivery.
2. Verify the project has no production environment variables, additional SSH keys, privileged contexts, remote Docker, self-hosted resource classes, or cloud trust accepting this project's OIDC tokens. Keep fork secret sharing off. Configuration alone cannot establish account settings or credential isolation.
3. Validate with CircleCI CLI: circleci config validate .circleci/config.yml. Run the migration branch and record pipeline URL, revision, six successful jobs, and successful aggregate. Confirm image availability, Python venv support, Chromium installation, dependency registry access, credits and xlarge eligibility. Do not enable paid usage automatically.
4. Obtain independent review of CI coverage and credential boundaries. A second account controlled by the author is not independently attributable security review.
5. In repository rules, add the exact CircleCI aggregate check name observed on the PR, restricted to CircleCI's integration when supported. Test that a failed prerequisite blocks merge. Do not guess a status name or reuse a GitHub status to represent unrun jobs.
6. Only after passing evidence and required-check verification, retire duplicated GitHub CI triggers in a separately reviewed change. Audit remaining PR workflows (AgentZ, contracts, lint, security, Windows and others) and workflow_run consumers individually; the table is not full parity for every workflow in the repository. Preserve production-proof in main.yml, protected deployments, scheduled business workflows, secret binders, and financial holds.
7. Verify a fresh main commit through CircleCI and protected deployment evidence before declaring cutover complete.

## Rollback

Before GitHub retirement, revert this config change if needed; GitHub configuration remains present. After retirement, restore reviewed GitHub CI triggers and obtain current-head successful results before restoring required checks. Never remove a required check merely to merge a failing commit.

## Evidence still required

CircleCI project access/settings, CLI schema validation, live exact-head results, independent approval, required-check administration and protected release evidence are not established by this change.

References: https://circleci.com/docs/reference/configuration-reference/ and https://circleci.com/docs/guides/security/contexts/
