#!/usr/bin/env bash
# Bounded public GET-only capture. Run on a trusted authorized networked host.
# No credentials, POST, redirect following, agent registration or production mutation.
set -Eeuo pipefail
EVIDENCE_DIR="${1:?Usage: bash CAPTURE-GET.sh /absolute/evidence/dir}"
[[ "$EVIDENCE_DIR" == /* ]] || { echo "Use an absolute evidence directory" >&2; exit 2; }
mkdir -p -- "$EVIDENCE_DIR"
chmod 700 -- "$EVIDENCE_DIR"
[[ ! -e "$EVIDENCE_DIR/raw-body.json" ]] || { echo "Refusing to overwrite existing evidence" >&2; exit 2; }
printf '%s\n' "https://authichain.com/mcp" > "$EVIDENCE_DIR/target.txt"
date -u +%Y-%m-%dT%H:%M:%SZ > "$EVIDENCE_DIR/requested-at-utc.txt"
set +e
curl --proto '=https' --max-redirs 0 --connect-timeout 5 --max-time 15 \
  --silent --show-error --dump-header "$EVIDENCE_DIR/headers.raw.txt" \
  --output "$EVIDENCE_DIR/raw-body.json" \
  --write-out '%{http_code}' 'https://authichain.com/mcp' \
  > "$EVIDENCE_DIR/http-status.txt" 2> "$EVIDENCE_DIR/curl-stderr.txt"
status=$?
set -e
printf '%s\n' "$status" > "$EVIDENCE_DIR/curl-exit-code.txt"
date -u +%Y-%m-%dT%H:%M:%SZ > "$EVIDENCE_DIR/completed-at-utc.txt"
if [[ -f "$EVIDENCE_DIR/raw-body.json" ]]; then
  (cd "$EVIDENCE_DIR" && sha256sum raw-body.json > raw-body.sha256)
else
  echo 'NO_BODY_RECEIVED: no raw-response hash; review DNS/transport diagnostics.' > "$EVIDENCE_DIR/no-body-reason.txt"
fi
echo "GET only. Inspect and REDACT headers before sharing: $EVIDENCE_DIR" >&2
exit "$status"
