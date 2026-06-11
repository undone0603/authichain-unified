#!/usr/bin/env bash
# Read-only: total deployment counts of the 3 blocked Pages projects.
set -e
source ~/.nvm/nvm.sh
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"
for p in authichain-com authichain-unified authichain-pages; do
  curl -s "$API/accounts/$ACCT/pages/projects/$p/deployments?per_page=1" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); ri=d.get('result_info') or {}; print('$p:', ri.get('total_count','?'),'deployments remaining')"
done
