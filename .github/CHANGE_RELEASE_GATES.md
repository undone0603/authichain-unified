# Risk-based change, CI, and release gates

Status: proposed policy on draft PR #2368. This document is operational guidance, **not** evidence that GitHub enforces it. Existing repository rules and protected deployment controls remain authoritative until deliberately configured and verified by an administrator.

## Non-negotiable trust boundaries

- Never execute untrusted pull-request code on persistent/self-hosted runners with production credentials, **write-capable or broadly scoped** deploy keys, host mounts, broad write tokens, privileged network access, or access to secrets. A single-repository read-only checkout key on an eligible hosted ephemeral executor is a different, narrower trust boundary but must still be inventoried and protected. Use an eligible credential-isolated executor, or hold execution.
- Never expose Stripe, Cloudflare, database, signing, production GitHub, or equivalent privileged credentials to PR tests. Confirm CircleCI/GitHub project settings, contexts, checkout keys, OIDC trust, SSH keys, and fork policies before treating that environment as safe.
- Never treat skipped, queued, stale, cancelled, simulated, local shim, or different-commit test evidence as successful **exact-head** CI. A required check cannot be disabled or relabeled just because the original provider is unavailable.
- Do not bypass pull-request protection with deploy keys/admin overrides; do not enable unattended merges without independently verified review/check/hold behavior. The accessible main ruleset currently requires zero reviews and grants an always-on DeployKey bypass, so do not claim the policy is enforced.
- Preserve financial and production holds (`humanHold=true`, `production_send=false`) and require explicit authorization for a protected live deployment. Releasing code and enabling payment/production behavior are distinct decisions.

## DeployKey moat: narrowly scoped checkout, never a universal merge pass

- **Read-only checkout:** For a legacy CircleCI GitHub OAuth pipeline, permit only the provider-issued **read-only key scoped to this one repository** to fetch source. The current CircleCI config has six `checkout` steps and does not contain `add_ssh_keys` or attached contexts. This is source inspection, **not** confirmation of the actual key's permissions or CircleCI account settings.
- **No PR write path:** Never attach a repository-write key, user/machine key, deployment key to a private infrastructure host, production secrets, or a broad GitHub token to PR jobs. Disable SSH debug sessions and remove extra keys from CircleCI project settings unless specifically required for a separately protected trusted job. Rotate any improperly scoped key and investigate its audit history.
- **Separate the bypass:** The active GitHub ruleset `main-no-direct-push` (ID `24073494`) includes `actor_type=DeployKey, bypass_mode=always`. That is a **bypass capability, not a moat**. GitHub's actor rule is not restricted by fingerprint in the observed ruleset. A read-only checkout key cannot push, but **any write-capable key covered by the bypass could defeat the pull-request control**. Audit *all* deploy keys and whether each has write access before treating this configuration as safe.
- **Recommended enforcement:** Remove the blanket DeployKey bypass from the ruleset after administrator review, keeping the narrow read-only CircleCI checkout key. If a trusted automation truly needs write privileges, use a separately scoped, auditable GitHub App/automation identity with protected merge and required-check enforcement; do not attach it to PR test jobs. No ruleset or deploy-key mutation is authorized by this document.
- **Verify in provider consoles:** GitHub repo Settings → Deploy keys: list keys, created/last-used information when available, read/write flag, owner, purpose and fingerprint. CircleCI Project Settings → SSH Keys, environment variables, contexts, pipeline source and Advanced Settings: compare fingerprints without revealing private key material. Include SSH/OIDC trust and fork-trigger coverage. The connected APIs in this chat cannot inspect either account's sensitive key settings; record **unverified** rather than declaring a completed security audit.
- **Release invariant:** A key must not independently convert a failed, absent, pending, or skipped required check into an accepted merge. Maintain the PR/CI/release separation regardless of the key used for checkout.

## Proportional acceptance by actual changed surface

| Tier | Typical scope | Minimum acceptance | When independent human review is needed |
| --- | --- | --- | --- |
| A: low-risk | Docs, comments, examples, ordinary test descriptions, no executable or policy/permission changes | Diff reviewed by an authorized maintainer; relevant formatting or targeted checks where applicable; existing PR protections | Not a blanket requirement |
| B: ordinary source and **non-privilege-expanding** CI maintenance | App features, standard tests, CI dependency/cache/job ordering, additions to existing isolated test pipelines | Exact-head relevant tests (and new aggregate where claimed); credential-isolation evidence for any PR-executing CI; authorized maintainer records acceptance | Only when the actual diff changes a trust boundary or active rules require it |
| C: security, money, or operational privilege boundary | Authentication, signatures, permissions, CI runner trust/routing or token access, automatic merge, branch-rule bypass, checkout charging/settlement, customer-data access, production configuration/deployment | Exact-head appropriate regression/security checks; confirmed isolation; independent qualified human security approval; owner/operator approval for any production or payment activation | Required |

**Escalation rules:** Classify by behavior, not filename or title. A YAML-only change that routes PRs to a privileged runner is Tier C. A CircleCI migration is Tier B **only after** proving that it does not grant new privilege, exposure, write permissions, privileged contexts, or automatic production effects; otherwise classify it Tier C. Uncertainty defaults to the higher tier until resolved.

## Do not create artificial blockers

1. GitHub Actions recovery is **not** a universal prerequisite if a separate eligible, credential-isolated CI provider runs the actual required tests on the exact candidate commit. Enforced branch rules and provider-specific required checks still have to be satisfied legitimately.
2. Do not require provisioning a self-hosted runner merely because one existed before. Prefer hosted ephemeral execution if available and authorized; audit its tokens and project-level access.
3. A separate human security reviewer is not mandatory for every Tier A/B change solely because the old CI is broken. Never substitute the author's second account, a code-review bot, or a source-only test for **independent** review when Tier C actually requires it.
4. Keep a no-unexpected-spend policy. The 5,000 CircleCI-credit reserve is an operator budget threshold, not proof of security or a substitute for tests; check available balance before authorizing costly runs. No automatic paid upgrade.
5. If CI is missing, classify it as **not tested** rather than inventing a pass or removing a required gate to merge.
6. Avoid making unrelated checkout, pricing, or product changes while repairing CI. Validate each change at its own head SHA.

## Merge versus deploy

A merge may proceed only after its tier's acceptance, actual enforced repository rules, and successful required exact-head checks. A successful merge does **not** authorize production deployment, payment activation, signing-key use, or enabling unattended outbound operations. Protected production releases require separate explicit authorization, real post-deploy evidence, and rollback controls.

## Evidence record (keep concise)

For each candidate: PR number, exact head SHA, touched paths, tier and rationale, isolated executor identity and trust boundary, relevant test/aggregate results, known skipped/unavailable checks, maintainer acceptance, independent approval when Tier C, and distinct deployment decision. Reuse current, verifiable evidence; do not demand repeating an identical audit unless the boundary or settings changed.
