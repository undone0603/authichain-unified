#!/usr/bin/env bash
# Credential-free, disposable proof for AuthiChain PR #2430.
# Run on a Docker-capable machine with network access; no host volumes or secrets.
set -euo pipefail
SHA="${2:?Usage: bash scripts/ci/run-disposable-worker-proof.sh OUTPUT_DIR EXACT_40_CHAR_PR_HEAD_SHA}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid commit SHA" >&2; exit 2; }
OUT="${1:-./evidence/pr-2430-${SHA}}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
command -v docker >/dev/null
docker info >/dev/null
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/started-utc.txt"
printf '%s\n' "$SHA" > "$OUT/expected-sha.txt"
docker version --format '{{.Server.Version}}' > "$OUT/docker-version.txt"
set +e
docker run --rm --pull=missing --name "authichain-proof-${SHA:0:12}-$$" \
  --network bridge --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 512 --memory 6g --cpus 4 \
  --workdir /tmp --env CI=true \
  node:22-bookworm bash -euo pipefail -c '
    SHA="$1"
    git clone --no-checkout https://github.com/undone0603/authichain-unified.git repo
    cd repo
    git checkout --detach "$SHA"
    test "$(git rev-parse HEAD)" = "$SHA"
    echo "PROOF_SHA=$(git rev-parse HEAD)"
    node --version
    corepack pnpm --version
    corepack pnpm install --frozen-lockfile --config.minimumReleaseAge=0
    test -x node_modules/.bin/vitest
    test -x node_modules/.bin/tsx
    cd workers/authichain-com
    ../../node_modules/.bin/vitest run src/dpp-routes.test.ts
    ../../node_modules/.bin/tsx --import ./test/register-md.mjs --test src/routing.test.ts
  ' _ "$SHA" > "$OUT/test.log" 2>&1
RC=$?
set -e
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/finished-utc.txt"
printf '%s\n' "$RC" > "$OUT/exit-code.txt"
(cd "$OUT" && sha256sum test.log expected-sha.txt started-utc.txt finished-utc.txt exit-code.txt docker-version.txt > SHA256SUMS)
echo "Proof exit code: $RC; evidence directory: $OUT"
echo "Review logs before attaching evidence to PR. This script does not publish or deploy."
exit "$RC"
