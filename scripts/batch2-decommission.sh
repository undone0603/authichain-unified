#!/usr/bin/env bash
# Phase 4 Batch 2 (owner-approved 2026-06-10):
# 1. Archive staged code for the 24 workers being deleted.
# 2. Re-point authichain.com/* and www.authichain.com/* globs -> authichain-com.
# 3. Delete the 23 orphans + authichain-unified.
set -e
source ~/.nvm/nvm.sh
cd ~/authichain-unified
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
ZONE=6580df4e35d347c94fef88b33784a514
API="https://api.cloudflare.com/client/v4"

WORKERS=(
  govchain-resolver auth analytics ai-classification blockchain
  authichain-landing-com authichain-landing-qron authentic-economy-portal
  authichain-qron-agentz authichain-autonomous-nexus authichain-ecosystem-pulse
  authichain-consensus-engine qron-images authichain-verify authichain-verifier
  admin-dashboard health-monitor watchchain-io-vertical maison-elite-store
  qron-edge-fleet authichain-infra authichain-marketplace-webhook
  qrontoken-telegram-bot authichain-unified
)

echo "=== 1. archive ==="
mkdir -p docs/archive/cf-workers
for w in "${WORKERS[@]}"; do
  cp ~/cf-skim/"$w".js docs/archive/cf-workers/"$w".js
done
ls docs/archive/cf-workers/ | wc -l

echo "=== 2. re-point apex globs to authichain-com ==="
curl -s -X PUT "$API/zones/$ZONE/workers/routes/5815bba4370e4a1b942af570523ac81b" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"pattern":"authichain.com/*","script":"authichain-com"}'
echo
curl -s -X PUT "$API/zones/$ZONE/workers/routes/799c59530d6f4193ac4e28463eb239a6" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"pattern":"www.authichain.com/*","script":"authichain-com"}'
echo

echo "=== 3. delete workers ==="
for w in "${WORKERS[@]}"; do
  RES=$(curl -s -X DELETE "$API/accounts/$ACCT/workers/scripts/$w?force=true" -H "Authorization: Bearer $TOKEN")
  if echo "$RES" | grep -q '"success": *true'; then
    echo "$w -> deleted"
  else
    echo "$w -> FAILED: $RES"
  fi
done
