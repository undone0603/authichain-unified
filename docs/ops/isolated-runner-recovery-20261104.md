# Isolated runner recovery — 2026-11-04

## Evidence and scope

PR #2330 exact-head runs [Lint 41745919009](https://github.com/undone0603/authichain-unified/actions/runs/41745919009), [Typecheck 41745918875](https://github.com/undone0603/authichain-unified/actions/runs/41745918875), [CI 41745918809](https://github.com/undone0603/authichain-unified/actions/runs/41745918809), and [CI Main 41745918847](https://github.com/undone0603/authichain-unified/actions/runs/41745918847) all failed checkout on `authichain-wsl`. Logs include `fatal: bad object refs/remotes/pull/2318/merge` and broken `ORIG_HEAD`. This is **not** a source-test result. Do not re-dispatch these jobs on the damaged workspace.

The main-branch Lint workflow routes same-repository PRs to `[self-hosted,Linux,ARM64,authichain-wsl]`; this is not evidence of credential isolation. The intended `authichain-ops` host must be independently provisioned and verified.

## Operator-only recovery (not executed by this PR)

1. In GitHub repository Settings → Actions → Runners, record the registered runner identity, labels, online/offline state and active jobs. Confirm all jobs have stopped before touching its worktree. Do not disable branch protections or grant production secrets.
2. On the runner machine, **stop the runner service** and confirm its process is stopped. Preserve service logs and Git errors. Never run untrusted PR code on the production publishing host.
3. Preserve the affected repository worktree (e.g. `/home/zac/actions-runner-wsl/_work/authichain-unified/authichain-unified`) as a timestamped, access-restricted quarantine copy/move **only after checking the actual configured work directory**. Do not remove or modify other repositories, credentials, runner registration or global Git config. Never `rm -rf` the runner root.
4. Provision a distinct unprivileged runner host/account with no Cloudflare, Stripe, Supabase, Vercel, signing or production secrets, no production network mounts, no write access to production resources, and no persistent checkout reused across untrusted PRs. Register only the intended `authichain-ops` label. Verify host identity and isolation out of band.
5. Before running any PR content, run a **trusted, checkout-only** diagnostic on the new runner: fetch a SHA-pinned trusted default-branch commit into a fresh directory; `git fsck --full`; `git cat-file -t <PINNED_SHA>`; `git rev-parse HEAD`; compare to the pinned SHA. Save job URL, UTC timestamp, runner identity, SHA and outcomes. A PR merge ref is not an exact PR head.
6. Only after isolation and checkout proof, change affected workflow routing in a separate reviewed PR to `authichain-ops` (or use a verified eligible hosted runner within existing budget), then run exact-head lint, typecheck, tests and Main gate. Confirm every applicable check, independent review and protection before merge.
7. Keep `humanHold=true`, `production_send=false`, Stripe reconciliation audit-only until canonical webhook-handler deployment evidence, and all protected deploy/payment/contract restrictions. No self-buy or synthetic revenue.

## Abort criteria

Stop if runner identity, host isolation, credential separation, exact SHA, or Git object integrity cannot be verified. Never silently fall back to `authichain-wsl`, a production machine, or a billed runner. Do not retry deterministic checkout failures.

## Acceptance evidence still required

- Clean independent runner registration and isolation attestation.
- Checkout-only job URL with exact pinned SHA and `git fsck` success.
- Exact-head PR #2330 CI and independent review.
- Subsequent independent review and protected deploy proof for DPP receipt #2273 and payment/fulfillment #2270.

This document is an operator procedure, **not** evidence that any host was repaired, a runner registered, a workflow activated, or customer revenue received.
