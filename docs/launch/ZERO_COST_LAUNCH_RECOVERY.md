# AuthiChain $0 incremental launch route — verified blockers and hold points

Checked: 2026-11-02. This is an execution guide, **not** a certification, live transaction receipt, independent partnership, or approval to ship unreviewed security/economic changes.

## Already usable without another host
- Public homepage: https://authichain.com
- Demo record: https://authichain.com/api/verify?id=polygon-anchor-1 — published **demonstration**, not customer/physical-product verification.
- Human interpretation: https://authichain.com/verify?id=polygon-anchor-1
- MCP GET discovery: https://authichain.com/mcp — **metadata**, not MCP POST initialize/tools/list conformance.
- Existing Stripe checkout routes: https://authichain.com/pricing — listing or session creation does not imply a fulfilled paying customer.
- Public no-wallet reviewer harness: https://github.com/undone0603/authichain-unified/pull/2285 — **draft**; not a security review or A2A TCK.

No DNS move, additional paid services, economic merge or new Cloudflare deployment is required to keep these **existing** public pages reachable.

## Blocker → no-new-bill alternative → proof demanded

| Blocker | Zero-additional-vendor-spend route | Required evidence / stop condition |
| --- | --- | --- |
| GitLab CI `ci_quota_exceeded` | An **authorized project runner** on an existing, dedicated, isolated computer; never add GitLab minutes | Runner identity and scope, job allocation, exact commit SHA, complete logs, green tests |
| GitHub public hosted jobs fail before executing steps | Public standard GitHub-hosted runners are normally free **when account-eligible**; a dedicated self-hosted runner is the alternative | Do not evade account enforcement or switch identities; verify runner ran actual steps for the PR head |
| Windows ARM64 host available | Native Windows ARM64 GitLab Runner build is documented, if a suitable non-production host is actually available | Install as unprivileged runner account, restrict projects and tags, no sensitive env/config |
| Vercel billing / blocked deploy | **Reuse** existing Cloudflare-based AuthiChain public site and existing free verification demo | Read-only health checks; no new deploy, domain changes or production policy overrides |
| External reviewer cannot open private GitLab !2030 | Publish reproducible, sanitized no-payment fixtures in **public GitHub draft PR #2285** | External person or operator returns pinned report with commands, UTC, independent authorship |
| A2A/MCP implementation conformance unproven | Isolated staging TCK and actual MCP `initialize`/`tools/list` by independent operator, after permission | Do not promote GET AgentCard or registry JSON to certified identity |
| $0.10 x402 monitoring claim | Independently read Base USDC transaction hashes and reconcile controlled receiving address **and** paid service response | No paid service delivery claim without receipt and output; no self-pay classified as customer |
| Stripe checkout sessions but no independent purchase | Keep existing payment links; verify one unsolicited/opt-in customer completion and persisted entitlement without charging founder again | External buyer, succeeded non-refunded payment, webhook, durable entitlement and usable access |

## Isolated runner path (human-controlled infrastructure only)

1. Confirm an **existing non-production** computer that can run 5-minute tests without privileged deployment secrets, payment keys, or access to production databases. Do not use a production publishing host for arbitrary PR code.
2. In the private GitLab project, Settings → CI/CD → Runners, create an authorized **project runner** limited to this project. Prefer an isolated disposable VM/container executor where available. The runner authentication token is confidential: **never** copy it into Git, screenshots or chat.
3. Install GitLab Runner on the host using the official Windows ARM64 (if Windows ARM64) or Linux ARM64 release; the current official documentation supports those platforms. Run as a dedicated least-privilege account. Set protected scopes and tags according to trusted job requirements.
4. Register interactively with `https://gitlab.com` and the token provided by GitLab (no hardcoded credentials). Do not enable unrestricted `run untagged` on a host that holds secrets.
5. First execute a minimal **no-secret**, trusted branch test and confirm the job has a runner ID, actual step logs and exit code 0. Then run each required GitLab job for the **exact MR head**; a separate local test cannot satisfy the merge gate.

Official guidance:
- https://docs.gitlab.com/runner/register/
- https://docs.gitlab.com/runner/install/requirements/
- https://docs.gitlab.com/ci/pipelines/compute_minutes/
- https://docs.github.com/en/actions/concepts/billing-and-usage

## Safe release / commercial launch decision

**PUBLIC DISCOVERY: AVAILABLE. VERIFIED REVENUE: NOT ESTABLISHED. SECURITY RELEASE: HOLD.**

- Never disable `humanHold`, `production_send`, branch protections, or require less independent review to force the release.
- Never attribute a payment, partner endorsement, independent agent consensus, counterfeit verdict or service certification to unverified metadata, a self-test or third-party listings alone.
- Do not send unsolicited outreach, buy services, add Cron triggers, merge economic code, or change production deployments.
- Public no-wallet negative fixtures can be reproduced **before** independent review. Production A2A task persistence and releases remain gated until approved.

