# AuthiChain isolated CI runner recovery
Updated: October 31, 2026

## Isolation requirement

Do **not** assign the `authichain-ci-isolated` label to the existing production runner `wsl-zac-arm64` or to any host that contains Stripe signing keys, Cloudflare deploy credentials, Supabase service keys, wallets, or a production deploy agent.

GitHub's Oct 23 green smoke ran on runner ID 21 (`wsl-zac-arm64`), which also performed Oct 31 production publishing. This is **not** independent CI validation. The Oct 31 smoke #2 is queued on the historical `authichain-ops` label. The new CI selector is deliberately different: `authichain-ci-isolated`.

Use a **separate disposable Linux ARM64 VM or machine**, preferably reimaged between untrusted builds. Persistent self-hosted runners on a public repository are a significant security risk. The new machine must not share host storage, a Docker socket, environment variables, SSH agents, or mounted secrets with the production publishing host. Default branch production deployment remains on `authichain-wsl`.

## Provision the dedicated host

1. Prepare a separate Ubuntu ARM64 VM or physical machine with systemd, curl, tar, sha256sum, sudo, Node.js 22+, npm, Git, and enough disk/RAM for the repository build. Do not use the currently running production publishing OS instance.
2. Create an unprivileged Linux account with no sudo access except the setup/service step, no production credentials, and a fresh home directory. If `sudo` is temporarily needed for service installation, remove broad sudo privileges afterwards.
3. Open [repository runner registration](https://github.com/undone0603/authichain-unified/settings/actions/runners/new), select Linux/ARM64, and generate a short-lived registration token. Never commit or paste the token in chat.
4. Run the checked-in script from the new VM as the dedicated user:

```bash
git clone --filter=blob:none --branch fix/isolated-authichain-ci-runner-20261031 https://github.com/undone0603/authichain-unified.git
cd authichain-unified
CONFIRM_ISOLATED_CI_HOST=YES bash ops/ci/bootstrap-isolated-runner.sh
```

The installer downloads GitHub Actions Runner v2.338.2, verifies the ARM64 archive SHA-256 published by the official GitHub release, installs pinned pnpm 10.28.2, registers `authichain-ci-arm64-01` with the unique label `authichain-ci-isolated`, and starts its systemd service. Do not reuse `wsl-zac-arm64` or use `--replace`.

## Verify and release

1. On the repository [runner settings page](https://github.com/undone0603/authichain-unified/settings/actions/runners), verify two distinct runner names/IDs: publisher `wsl-zac-arm64` and CI `authichain-ci-arm64-01`. CI must have `authichain-ci-isolated`; publisher must **not**.
2. From the [self-hosted ops smoke](https://github.com/undone0603/authichain-unified/actions/workflows/self-hosted-ops-smoke.yml) **Run workflow** dropdown, select branch `fix/isolated-authichain-ci-runner-20261031` (which contains the new isolated selector), not `main` yet. Run smoke and verify `runner_name=authichain-ci-arm64-01`, the Identity step passes, and runner ID differs from production publisher ID 21. The previous Smoke #2 targeting the old label is not proof.
3. Review this CI-targeting PR and require its full validation on the new host before merging. Prior PR CI jobs targeting the old `authichain-ops` label will **not** automatically migrate; rerun or update their exact-head checks after merge.
4. Re-run PR #2222 DPP fulfillment and PR #2223 outbound checks. Require green Typecheck/lint, worker build, and test shards on their exact current commits before merging.
5. Use the existing `deploy-workers.yml` targeted dispatches for `stripe-webhook` and `authichain-verify-worker` on the publisher only, then confirm live Cloudflare deployment IDs and read-only smoke checks. No payment or external email is authorized solely by a green smoke.

## Secrets boundary

The compile-only Worker build no longer receives `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID`. It executes `wrangler deploy --dry-run` and fails on the real bundler exit code. The former `NEXT_PUBLIC_SUPABASE_URL` / `DATABASE_URL` format check on each trusted main push is moved onto `authichain-wsl`, not the persistent CI runner. The production launch-proof job also remains on the publisher. No repository secrets, signing keys, customer records, or wallet credentials may be installed on the isolated CI VM.

## Diagnose

```bash
cd ~/actions-runner-authichain-ci
sudo ./svc.sh status
find _diag -maxdepth 1 -name 'Runner_*.log' -printf '%T@ %p\n' | sort -nr | head
```

GitHub-hosted fallback #2225 remains in draft because its hosted jobs failed before executing steps; it is not a substitute for a verified isolated runner.

References:
- https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners
- https://docs.github.com/en/actions/reference/security/secure-use
- https://github.com/actions/runner/releases/tag/v2.338.2
