#!/usr/bin/env bash
# Continuous outreach research tick — load secrets and run daily-tick.mjs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Secrets: ~/.config/authichain/outreach.env (outside any checkout, mode 600),
# then job-runner env, then .env.local. CRON_SECRET is only needed when
# OUTREACH_ENQUEUE=1; research runs without it.
set -a
# shellcheck disable=SC1091
[[ -f "${HOME}/.config/authichain/outreach.env" ]] && source "${HOME}/.config/authichain/outreach.env"
# shellcheck disable=SC1091
[[ -f server/.env.job-runner ]] && source server/.env.job-runner
# shellcheck disable=SC1091
[[ -f .env.local ]] && source .env.local
set +a

export OUTREACH_WORKER_URL="${OUTREACH_WORKER_URL:-https://authichain.undone-k.workers.dev}"
# Optional: set APOLLO_API_KEY in env to unlock automated people search
# Optional: OUTREACH_ENQUEUE=1 to promote verified DMs into the Worker queue
# Optional: RUN_CYCLE=1 to force Worker send/reply after promote

# systemd user units do not get the nvm PATH, and a pinned nvm version path
# breaks on every Node upgrade. Use NODE_BIN, then PATH, then newest nvm v22.
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$(ls -d "${HOME}"/.nvm/versions/node/v22.*/bin/node 2>/dev/null | sort -V | tail -1 || true)"
fi
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "node not found (set NODE_BIN)" >&2
  exit 1
fi

exec "$NODE_BIN" scripts/dpp-outreach/daily-tick.mjs
