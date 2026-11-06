# CI runner fallback

_Added 2026-11-06._

## The problem

The PR gates (`CI`, `CI Main`, `Lint`, `Typecheck ratchet`) run every
same-repo job on a single self-hosted runner, labelled `authichain-wsl`.
When that runner is offline, every PR waits in the queue and nothing merges.
On 2026-11-06, 18 runs were queued with 0 in progress, and the last success
was 2 hours earlier.

## The switch

These four workflows now read the repository variable
`AUTHICHAIN_CI_SELF_HOSTED`, the same variable that `agentz-ci`,
`build-workers` and the `CI Main` cache paths already use.

| Value           | PR gates run on                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------- |
| unset or `true` | `authichain-wsl` (self-hosted). This is the default and matches the behaviour before this change. |
| `false`         | `ubuntu-24.04` (GitHub-hosted). Jobs start right away, at the cost of Actions minutes.            |

Fork PRs always run on `ubuntu-24.04`, as before.

**To fail over** while the runner is down, go to Settings, then Secrets and
variables, then Actions, then Variables, and set `AUTHICHAIN_CI_SELF_HOSTED`
to `false`. Then re-run the queued workflows. Set it back to `true` once the
runner is healthy.

**To restart the runner** on the WSL host, run
`sudo ./svc.sh stop && sudo ./svc.sh start` from the runner directory, or
restart WSL. Check its state under Settings, then Actions, then Runners.

## Notes

- The `CI Main` cache paths (`PLAYWRIGHT_BROWSERS_PATH`, `TURBO_CACHE_DIR`)
  only switch to the self-hosted locations when the variable is exactly
  `true`. Set it explicitly instead of leaving it unset.
- Deploy workflows (`deploy-*.yml`) are unchanged. They still need the
  self-hosted runner, because it holds the deploy toolchain.
