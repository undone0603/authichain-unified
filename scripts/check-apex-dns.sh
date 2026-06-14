#!/usr/bin/env bash
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ZONE=6580df4e35d347c94fef88b33784a514
API="https://api.cloudflare.com/client/v4"

echo "=== public resolution ==="
getent hosts authichain.com || echo "apex: NO RESOLUTION"
getent hosts www.authichain.com || echo "www: NO RESOLUTION"

echo "=== raw dns_records response (first 800 chars) ==="
curl -s "$API/zones/$ZONE/dns_records?per_page=100" -H "Authorization: Bearer $TOKEN" | head -c 800
echo

echo "=== custom domains (workers domains) on account ==="
curl -s "$API/accounts/4c1869b90f13f86940aa3747839bf420/workers/domains" -H "Authorization: Bearer $TOKEN" | head -c 1200
echo
