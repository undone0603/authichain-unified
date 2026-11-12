#!/usr/bin/env bash
# Run the repository's real CircleCI commands on an isolated, no-charge host.
# Then run a new disposable Postgres 17 container, never production Supabase.
set -Eeuo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$root"

expected="${1:?usage: bash scripts/ci/x402-native-release-acceptance.sh <exact-40-character-PR-head-SHA>}"
[[ "$expected" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid exact SHA" >&2; exit 2; }
actual="$(git rev-parse HEAD)"
[[ "$actual" == "$expected" ]] || {
  echo "Refusing stale checkout: current=$actual expected=$expected" >&2
  exit 2
}

# CircleCI quality-check.sh requires this env and itself verifies git HEAD.
export CIRCLE_SHA1="$expected"
echo "[x402] Running native repository jobs at commit $expected"
# No CI provider is charged by this script; all commands execute locally.
for job in quality typecheck-ratchet test-workers test-other build extras; do
  echo "[x402] native job: $job"
  bash .circleci/quality-check.sh "$job"
done

echo '[x402] Running separate disposable PostgreSQL 17 integration'
bash scripts/ci/x402-disposable-postgres.sh
echo '[x402] PASS: six native jobs and isolated PostgreSQL integration completed'
