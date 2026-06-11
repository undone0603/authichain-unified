#!/usr/bin/env bash
# Archive deployed Cloudflare worker scripts into docs/archive/cf-workers/
# before decommission (Phase 4, 2026-06-10). Uses wrangler's OAuth session.
set -e
source ~/.nvm/nvm.sh
cd ~/authichain-unified

# Refresh wrangler's OAuth token, then read it from its config.
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
[ -f "$CFG" ] || { echo "NO WRANGLER CONFIG FOUND"; exit 1; }
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
[ -n "$TOKEN" ] || { echo "NO TOKEN IN $CFG"; exit 1; }

WORKERS=(
  esktop
  square-feather-870cqron-token-monitor
  proud-unit-9791qron-api-gateway
  strainchain
  api-strainchain
  strainchain-nft-api
  outreach-queue
  qron-seo-engine
  govchain
  qron-demos
  qron-fiverr
  authichain-outreach-engine
)

mkdir -p docs/archive/cf-workers
for w in "${WORKERS[@]}"; do
  curl -s "https://api.cloudflare.com/client/v4/accounts/4c1869b90f13f86940aa3747839bf420/workers/scripts/$w" \
    -H "Authorization: Bearer $TOKEN" -o "docs/archive/cf-workers/$w.js"
done

echo "--- archive contents ---"
ls -la docs/archive/cf-workers/
echo "--- sanity check for API errors ---"
grep -l '"success":false' docs/archive/cf-workers/*.js || echo "no API errors detected"
