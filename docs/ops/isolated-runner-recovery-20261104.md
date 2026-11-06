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

## Trusted checkout-only smoke workflow (review-gated, NOT executed)

A proposed updated `.github/workflows/self-hosted-ops-smoke.yml` accepts an explicitly recorded 40-character **default-branch** commit SHA and a manual operator assertion that physical/account/credential isolation was independently checked. It executes only on `refs/heads/main` with `operator_confirms_isolation=yes` and routes exclusively to `authichain-ops`. The default is `no`. This new workflow definition is **not active on main until reviewed and merged**. Do not dispatch it on a shared publishing machine or before the operator has quarantined the corrupt worktree.

The job checks the unprivileged user, strict workspace path, absence of preexisting `.git`, a short list of forbidden ambient credential environment variables (this **does not** establish filesystem or network credential isolation), and the exact expected default-branch SHA. It then performs an ordinary SHA-pinned, credentials-not-persisted `actions/checkout`, verifies `git rev-parse HEAD`, `git cat-file -t`, and `git fsck --full --no-reflogs`, and records the run metadata without printing credentials. No PR head is checked out and no PR code is run. A green result proves only that one checkout completed on the labeled runner. Operator identity, host identity, network/storage isolation, and absence of production credentials must be evidenced **out of band**.

**Operator procedure:** 1) Inspect GitHub runner registration and host separation, 2) stop/quarantine compromised worktree and preserve logs, 3) validate clean unprivileged host without production credentials, 4) record main SHA, 5) after this workflow is approved on main, manually dispatch `Self-hosted ops smoke` on main with the recorded SHA and `yes`, 6) retain job link, timestamp, logs, `fsck` and external host-isolation attestation. Abort if any step fails. This PR has **not** executed these actions.

The built-in Node assertion file `scripts/ci/trusted-ops-smoke.test.mjs` checks non-destructive, default-branch-only, fail-closed workflow properties locally; it is not a replacement for actual checkout or external host evidence.
