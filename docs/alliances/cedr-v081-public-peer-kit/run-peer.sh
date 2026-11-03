#!/usr/bin/env bash
# Self-contained public, read-only Cedr 0.8.1 MCP Streamable HTTP validation.
# No GitLab access, production secrets, payments, tool execution, or deployments.
set -euo pipefail
umask 077
# The release binary is executable code; never run it on a production machine.
if [[ "${CEDR_ISOLATED_RUNNER_APPROVED:-}" != "YES" ]]; then
  echo 'BLOCKED: explicitly approve a separately isolated disposable non-production Linux runner (CEDR_ISOLATED_RUNNER_APPROVED=YES)' >&2
  exit 78
fi
case "${RUNNER_NAME:-}" in
  authichain-ops|wsl-*|LAPTOP-*)
    echo "BLOCKED: protected runner name: ${RUNNER_NAME}" >&2
    exit 78;;
esac
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${CEDR_PEER_EVIDENCE_DIR:-$PWD/cedr-public-peer-evidence}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
for command in node curl sha256sum tar timeout gh; do
  command -v "$command" >/dev/null || { echo "Required command missing: $command" >&2; exit 3; }
done
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64) ARCHIVE='cedr-linux-x86_64.tar.gz'; EXPECTED_SHA='5907516b4d2d817ba2089210205b6c22af216da20fa20479cb4ac2b666690dc6';;
  Linux/aarch64|Linux/arm64) ARCHIVE='cedr-linux-arm64.tar.gz'; EXPECTED_SHA='7780b0a2652874c1cd0c91cdb9c4559556716b1ba86b59848a92870e589ad449';;
  *) echo 'Requires isolated Linux x86_64 or arm64 host' >&2; exit 3;;
esac
EXPECTED_SUMS_SHA='80ca80ea8b0110391283246751f817fc1995ea4b743fcd7bd98804c240cd38ba'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/home" "$TMP/work/.cedr"
printf '%s\n' '{"mcpServers":{"authichain":{"url":"https://authichain.com/mcp"}}}' > "$TMP/work/.mcp.json"
printf 'version = 1\n[remote]\ninterval_minutes = 60\n' > "$TMP/work/.cedr/guard.toml"
RELEASE='https://github.com/Sheernox/cedr/releases/download/v0.8.1'
# No local ~/.curlrc and only HTTPS; no remote inputs except the pinned upstream release.
if [ -n "${CEDR_V081_ARCHIVE:-}" ]; then cp -- "$CEDR_V081_ARCHIVE" "$TMP/$ARCHIVE"; else
  curl -q --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --max-time 90 "$RELEASE/$ARCHIVE" -o "$TMP/$ARCHIVE"
fi
if [ -n "${CEDR_V081_SHA256SUMS:-}" ]; then cp -- "$CEDR_V081_SHA256SUMS" "$TMP/SHA256SUMS"; else
  curl -q --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --max-time 90 "$RELEASE/SHA256SUMS" -o "$TMP/SHA256SUMS"
fi
printf '%s  %s\n' "$EXPECTED_SHA" "$TMP/$ARCHIVE" | sha256sum -c - > "$OUT/binary-digest.txt"
printf '%s  %s\n' "$EXPECTED_SUMS_SHA" "$TMP/SHA256SUMS" | sha256sum -c - > "$OUT/manifest-digest.txt"
(cd "$TMP" && grep -E "^[0-9a-fA-F]{64} [ *]${ARCHIVE//./\.}$" SHA256SUMS | sha256sum -c -) > "$OUT/manifest-match.txt"
GH_PROMPT_DISABLED=1 timeout 60 gh attestation verify "$TMP/$ARCHIVE" --repo Sheernox/cedr > "$OUT/attestation.txt" 2>&1
(cd "$TMP" && tar -xzf "$ARCHIVE")
CEDR="$TMP/${ARCHIVE%.tar.gz}/cedr"
test -f "$CEDR" || { echo 'Unexpected release archive layout' >&2; exit 3; }
chmod u+x "$CEDR"
"$CEDR" --version > "$OUT/cedr-version.txt"
grep -Eq '(^|[^0-9])0\.8\.1([^0-9]|$)' "$OUT/cedr-version.txt" || { echo 'Wrong Cedr version' >&2; exit 3; }
RUNNER=(env -i PATH="$PATH" HOME="$TMP/home" LANG=C.UTF-8 CEDR_TELEMETRY=0 DO_NOT_TRACK=1)
(cd "$TMP/work" && timeout 40 "${RUNNER[@]}" "$CEDR" guard lint . --format json > "$OUT/lint.json")
(cd "$TMP/work" && timeout 100 "${RUNNER[@]}" "$CEDR" guard lock --remote . > "$OUT/lock-output.txt" 2> "$OUT/lock-errors.txt")
test -s "$TMP/work/.cedr/guard.lock" || { echo 'No remote lock' >&2; exit 2; }
SURFACE="$TMP/work/.cedr/surfaces/claude.authichain.json"
test -s "$SURFACE" || { echo 'No introspected surface' >&2; exit 2; }
set +e
(cd "$TMP/work" && timeout 100 "${RUNNER[@]}" "$CEDR" guard remote . --force --format json > "$OUT/remote-report.json" 2> "$OUT/remote-errors.txt")
RC=$?
set -e
printf '%s\n' "$RC" > "$OUT/remote-exit.txt"
node "$BASE_DIR/verify-report.mjs" "$OUT/remote-report.json" "$SURFACE" > "$OUT/verdict.json"
test "$RC" -eq 0 || { echo 'Cedr remote returned nonzero' >&2; exit 2; }
cp "$TMP/work/.cedr/guard.lock" "$OUT/guard.lock"
cp "$SURFACE" "$OUT/claude.authichain.json"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$OUT/checked-at-utc.txt"
sha256sum "$OUT/guard.lock" "$OUT/claude.authichain.json" "$OUT/remote-report.json" "$OUT/verdict.json" > "$OUT/evidence-digests.txt"
printf 'PASS (self-baselined public MCP tool surface only); evidence: %s\n' "$OUT"
