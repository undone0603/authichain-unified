#!/usr/bin/env bash
# Status check for local GovChain engine runs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${GOV_ENGINE_LOG_DIR:-$ROOT/.logs}"
LOG="$LOG_DIR/govchain-engine.log"

echo "=== GovChain monitor $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "repo: $ROOT"
echo "engine: src/agents/government-lead-gen-v2.ts"
echo "entry:  server/scripts/run_gov_engine.ts"
echo "cron:   .github/workflows/gov-engine.yml (06:00 UTC + workflow_dispatch)"
echo

if pgrep -af "run_gov_engine" >/dev/null 2>&1; then
  echo "process: running"
  pgrep -af "run_gov_engine" || true
else
  echo "process: not running"
fi

echo
if [[ -f "$LOG" ]]; then
  echo "--- last 50 log lines ($LOG) ---"
  tail -n 50 "$LOG"
else
  echo "no local log yet at $LOG — run scripts/ops/run-gov-engine.sh first"
fi
