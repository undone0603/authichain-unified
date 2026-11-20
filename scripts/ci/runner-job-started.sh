#!/usr/bin/env bash
# Self-hosted runner job-started hook (ACTIONS_RUNNER_HOOK_JOB_STARTED).
# Installed as hooks/job-started.sh in each runner directory on the WSL host;
# this file is the source of truth. Never fails the job.
#
# 1. The persistent checkout keeps refs/remotes/pull/N/merge from earlier PRs.
#    Once a PR merges, GitHub prunes that merge commit and the next checkout
#    fails with "fatal: bad object refs/remotes/pull/N/merge". actions/checkout
#    re-fetches the one ref it needs, so clearing them all is safe.
# 2. A job that checked out sparsely (the protected deploy workflows) leaves
#    sparse config and skip-worktree entries behind. actions/checkout's own
#    "sparse-checkout disable" did not bring files back, so the next job ran
#    without pnpm-lock.yaml (production-smoke-gate run 44528701100). When that
#    state is present, empty the workspace so actions/checkout clones fresh.
d="${GITHUB_WORKSPACE:-}"
[ -n "$d" ] && [ -d "$d/.git" ] || exit 0

rm -rf "$d/.git/refs/remotes/pull" 2>/dev/null || true
if [ -f "$d/.git/packed-refs" ]; then
  sed -i '\# refs/remotes/pull/#d' "$d/.git/packed-refs" 2>/dev/null || true
fi
echo "[job-started hook] cleared refs/remotes/pull in $d"

sparse="$(git -C "$d" config --get core.sparseCheckout 2>/dev/null || true)"
if [ "$sparse" = "true" ] || git -C "$d" ls-files -v 2>/dev/null | grep -q '^S'; then
  find "$d" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
  echo "[job-started hook] removed sparse workspace $d; actions/checkout will clone fresh"
fi
exit 0
