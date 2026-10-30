#!/usr/bin/env bash
# Hold the machine-wide heavy-build lock, then replace this process with
# the given command. Both self-hosted runners share this user's home, so
# one next/OpenNext build runs at a time. Lint, tests, and installs do not
# take this lock.
set -euo pipefail
if [[ $# -lt 1 ]]; then
  echo "usage: with-build-lock.sh command [args...]" >&2
  exit 2
fi
lock="${AUTHICHAIN_BUILD_LOCK:-$HOME/.cache/authichain-heavy-build.lock}"
wait_s="${AUTHICHAIN_BUILD_LOCK_WAIT:-1500}"
mkdir -p "$(dirname "$lock")"
exec 9>"$lock"
echo "[build-lock] waiting up to ${wait_s}s for ${lock}"
if ! flock -w "$wait_s" 9; then
  echo "[build-lock] timed out waiting for the other build on this machine" >&2
  exit 1
fi
echo "[build-lock] acquired"
exec "$@"
