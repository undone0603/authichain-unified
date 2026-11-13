#!/usr/bin/env bash
# Cedr v0.8.1 remote MCP live test against AuthiChain. Read-only tool metadata.
# Run only in a separately isolated, network-connected, non-production Linux amd64 VM.
# Requires curl, sha256sum, tar, find; no secrets or wallets.
set -euo pipefail

if [[ "${CEDR_ISOLATED_RUNNER_APPROVED:-}" != "YES" ]]; then
  echo 'BLOCKED: run only on a verified isolated non-production host: set CEDR_ISOLATED_RUNNER_APPROVED=YES after checking isolation.' >&2
  exit 78
fi
case "${RUNNER_NAME:-}" in
  wsl-zac-arm64|authichain-ops|LAPTOP-72MAGTL2) echo "BLOCKED: protected runner ${RUNNER_NAME}; use separate host" >&2; exit 78;;
esac
if [[ $(uname -s) != Linux || $(uname -m) != x86_64 ]]; then
  echo 'BLOCKED: this script requires an isolated Linux amd64 host.' >&2; exit 78
fi
for c in curl sha256sum tar find date mktemp grep; do command -v "$c" >/dev/null || { echo "BLOCKED: missing $c" >&2; exit 78; }; done

OUT_DIR="${CEDR_EVIDENCE_DIR:-${PWD}/cedr-authichain-evidence-$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT
cd "$WORK"
{
  printf 'date_utc=%s\n' "$(date -u +%FT%TZ)"
  printf 'host=%s\n' "$(uname -srm)"
  printf 'release=v0.8.1\n'
  printf 'target=https://authichain.com/mcp\n'
  printf 'purpose=read-only MCP initialize/tools-list; no tools/call\n'
} > "$OUT_DIR/manifest.txt"

BASE=https://github.com/Sheernox/cedr/releases/download/v0.8.1
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time 90 --retry 2 "$BASE/SHA256SUMS" -o SHA256SUMS
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time 90 --retry 2 "$BASE/cedr-linux-x86_64.tar.gz" -o cedr-linux-x86_64.tar.gz
grep -F 'cedr-linux-x86_64.tar.gz' SHA256SUMS | sha256sum --check --status || {
  echo 'FAILED: official Cedr release checksum mismatch' | tee "$OUT_DIR/failure.txt" >&2
  exit 70
}
sha256sum cedr-linux-x86_64.tar.gz > "$OUT_DIR/archive-sha256.txt"
cp SHA256SUMS "$OUT_DIR/upstream-SHA256SUMS.txt"
# Optionally verify build provenance if GitHub CLI is installed; absence != verified.
if command -v gh >/dev/null; then
  gh attestation verify cedr-linux-x86_64.tar.gz --repo Sheernox/cedr >"$OUT_DIR/attestation.txt" 2>&1 || {
    echo 'FAILED: GitHub attestation verification; aborting execution' >&2
    exit 70
  }
else
  printf 'Not performed: gh CLI unavailable\n' > "$OUT_DIR/attestation.txt"
fi
mkdir extracted
tar -xzf cedr-linux-x86_64.tar.gz -C extracted
CEDR_BINARY="$(find "$WORK/extracted" -type f -name cedr -print -quit)"
if [[ -z "$CEDR_BINARY" ]]; then
  echo 'FAILED: Cedr executable not found in release archive' >&2; exit 70
fi
chmod u+x "$CEDR_BINARY"
CEDR_TELEMETRY=0 CEDR_NO_AUTO_UPDATE=1 "$CEDR_BINARY" --version > "$OUT_DIR/cedr-version.txt"
mkdir project
cd project
cat > .mcp.json <<'JSON'
{
  "mcpServers": {
    "authichain": {
      "type": "http",
      "url": "https://authichain.com/mcp"
    }
  }
}
JSON
cp .mcp.json "$OUT_DIR/mcp-configuration.json"
# Cedr guard remote contacts ONLY the remote server in this scratch project.
set +e
CEDR_TELEMETRY=0 CEDR_NO_AUTO_UPDATE=1 "$CEDR_BINARY" guard lock --remote . >"$OUT_DIR/lock.stdout" 2>"$OUT_DIR/lock.stderr"
LOCK_EXIT=$?
if [[ "$LOCK_EXIT" == 0 ]]; then
  CEDR_TELEMETRY=0 CEDR_NO_AUTO_UPDATE=1 "$CEDR_BINARY" guard remote . --force --format json >"$OUT_DIR/remote.stdout.json" 2>"$OUT_DIR/remote.stderr"
  REMOTE_EXIT=$?
else
  REMOTE_EXIT=99
  echo '{"status":"not_run_due_to_failed_lock"}' >"$OUT_DIR/remote.stdout.json"
fi
set -e
{
  printf 'lock_exit=%s\n' "$LOCK_EXIT"
  printf 'remote_exit=%s\n' "$REMOTE_EXIT"
  printf 'date_utc_after=%s\n' "$(date -u +%FT%TZ)"
} | tee "$OUT_DIR/exit-codes.txt"
printf 'Evidence directory: %s\n' "$OUT_DIR"
# A command completing without errors is NOT a third-party endorsement or security certificate.
if [[ "$LOCK_EXIT" != 0 || "$REMOTE_EXIT" != 0 ]]; then exit 2; fi
