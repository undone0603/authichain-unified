#!/usr/bin/env bash
# Delete decommissioned Cloudflare workers (Phase 4 Batch 1 + 2 risk workers).
# Owner approved 2026-06-10. Code archived first in docs/archive/cf-workers/.
set -e
source ~/.nvm/nvm.sh
cd ~/authichain-unified

npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
[ -n "$TOKEN" ] || { echo "NO TOKEN"; exit 1; }

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

for w in "${WORKERS[@]}"; do
  RES=$(curl -s -X DELETE \
    "https://api.cloudflare.com/client/v4/accounts/4c1869b90f13f86940aa3747839bf420/workers/scripts/$w?force=true" \
    -H "Authorization: Bearer $TOKEN")
  OK=$(echo "$RES" | grep -o '"success":[a-z]*' | head -1)
  echo "$w -> $OK"
  if echo "$RES" | grep -q '"success":false'; then
    echo "   ERROR: $RES"
  fi
done
