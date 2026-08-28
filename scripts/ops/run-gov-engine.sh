#!/usr/bin/env bash
# Local wrapper for GovChain federal discovery engine (v2.5).
# Defaults to DRY_RUN. Does not send email or mint unless DRY_RUN=false.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOG_DIR="${GOV_ENGINE_LOG_DIR:-$ROOT/.logs}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/govchain-engine.log"

export DRY_RUN="${DRY_RUN:-true}"

echo "=== GovChain engine $(date -u +%Y-%m-%dT%H:%M:%SZ) DRY_RUN=${DRY_RUN} ===" | tee -a "$LOG"

if [[ ! -f "$ROOT/server/scripts/run_gov_engine.ts" ]]; then
  echo "missing server/scripts/run_gov_engine.ts" | tee -a "$LOG"
  exit 1
fi

npx tsx server/scripts/run_gov_engine.ts 2>&1 | tee -a "$LOG"
STATUS=${PIPESTATUS[0]}

echo "=== completed $(date -u +%Y-%m-%dT%H:%M:%SZ) exit=${STATUS} ===" | tee -a "$LOG"
exit "$STATUS"
