#!/usr/bin/env bash
# Restore apex: re-create the Workers Custom Domain authichain.com -> authichain-com.
# (force-deleting legacy worker `authichain-unified` removed the custom domain + DNS.)
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
ZONE=6580df4e35d347c94fef88b33784a514
API="https://api.cloudflare.com/client/v4"

curl -s -X PUT "$API/accounts/$ACCT/workers/domains" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data "{\"zone_id\":\"$ZONE\",\"hostname\":\"authichain.com\",\"service\":\"authichain-com\",\"environment\":\"production\"}"
echo
