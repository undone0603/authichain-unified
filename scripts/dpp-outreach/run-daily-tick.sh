#!/usr/bin/env bash
# Continuous outreach research tick — load secrets and run daily-tick.mjs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Prefer job-runner env, then .env.local
set -a
# shellcheck disable=SC1091
[[ -f server/.env.job-runner ]] && source server/.env.job-runner
# shellcheck disable=SC1091
[[ -f .env.local ]] && source .env.local
set +a

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET missing" >&2
  exit 1
fi

export OUTREACH_WORKER_URL="${OUTREACH_WORKER_URL:-https://authichain.undone-k.workers.dev}"
# Optional: set APOLLO_API_KEY in env to unlock automated people search
# Optional: RUN_CYCLE=1 to force Worker send/reply after promote

exec /home/zac/.nvm/versions/node/v22.23.2/bin/node scripts/dpp-outreach/daily-tick.mjs
