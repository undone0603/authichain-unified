#!/usr/bin/env bash
# Finish Batch 1: detach outreach-queue worker as consumer of the dead
# outreach-jobs queue (0 producers), delete the worker, delete the queue.
set -e
source ~/.nvm/nvm.sh
cd ~/authichain-unified
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4/accounts/$ACCT"
QUEUE=26c09420559247e7b0d4f8709abed94a
CONSUMER=fde651d9a3894d4fbccdbad28cdac4aa

echo "--- 1. remove consumer ---"
curl -s -X DELETE "$API/queues/$QUEUE/consumers/$CONSUMER" -H "Authorization: Bearer $TOKEN"
echo
echo "--- 2. delete worker ---"
curl -s -X DELETE "$API/workers/scripts/outreach-queue?force=true" -H "Authorization: Bearer $TOKEN"
echo
echo "--- 3. delete dead queue (0 producers) ---"
curl -s -X DELETE "$API/queues/$QUEUE" -H "Authorization: Bearer $TOKEN"
echo
