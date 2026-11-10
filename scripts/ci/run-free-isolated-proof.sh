#!/usr/bin/env bash
# Zero-CI-credit, credential-free proof for a pinned AuthiChain commit.
# Requires a disposable container engine (Podman preferred; Docker supported).
# Does not register a GitHub runner, deploy, merge, or publish evidence.
set -euo pipefail
OUT="${1:?Usage: bash scripts/ci/run-free-isolated-proof.sh OUTPUT_DIR EXACT_SHA}"
SHA="${2:?Usage: bash scripts/ci/run-free-isolated-proof.sh OUTPUT_DIR EXACT_SHA}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid SHA" >&2; exit 2; }
if command -v podman >/dev/null 2>&1; then ENGINE=podman
elif command -v docker >/dev/null 2>&1; then ENGINE=docker
else echo "BLOCKED: install rootless Podman or Docker; refusing host execution" >&2; exit 78
fi
"$ENGINE" info >/dev/null || { echo "BLOCKED: container engine unavailable" >&2; exit 78; }
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/started-utc.txt"
printf '%s\n' "$SHA" > "$OUT/expected-sha.txt"
printf '%s\n' "$ENGINE" > "$OUT/container-engine.txt"
set +e
"$ENGINE" run --rm --pull=missing --network bridge --cap-drop=ALL \
  --security-opt=no-new-privileges --pids-limit=512 --memory=6g --cpus=4 \
  --env CI=true --workdir /tmp docker.io/library/node:22-bookworm \
  bash -euo pipefail -c '
    SHA="$1"
    git clone --no-checkout https://github.com/undone0603/authichain-unified.git repo
    cd repo
    git checkout --detach "$SHA"
    test "$(git rev-parse HEAD)" = "$SHA"
    echo "PROOF_SHA=$(git rev-parse HEAD)"
    corepack pnpm install --frozen-lockfile --config.minimumReleaseAge=0
    cd workers/authichain-com
    set +e
    ../../node_modules/.bin/vitest run src/dpp-routes.test.ts
    VITEST_RC=$?
    echo "VITEST_EXIT=$VITEST_RC"
    ../../node_modules/.bin/tsx --import ./test/register-md.mjs --test src/routing.test.ts
    TSX_RC=$?
    echo "TSX_EXIT=$TSX_RC"
    test "$VITEST_RC" -eq 0 && test "$TSX_RC" -eq 0
  ' _ "$SHA" > "$OUT/test.log" 2>&1
RC=$?
set -e
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/finished-utc.txt"
printf '%s\n' "$RC" > "$OUT/exit-code.txt"
(cd "$OUT" && sha256sum test.log expected-sha.txt started-utc.txt finished-utc.txt exit-code.txt container-engine.txt > SHA256SUMS)
echo "Exit=$RC evidence=$OUT (not uploaded; inspect for sensitive content)"
exit "$RC"
