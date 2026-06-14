#!/usr/bin/env bash
# Batch 3 (owner-approved 2026-06-11): archive + delete the 5 orphan Stripe workers.
# Pre-verified: zero routes, zero custom domains, zero crons; embedded sk_live key EXPIRED;
# no registered Stripe webhook endpoint reaches any of them.
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"
ARCHIVE=~/authichain-unified/docs/archive/cf-workers

WORKERS="stripe-webhook stripe-provisioner stripe-listener authichain-stripe-listener qron-stripe-webhook"

echo "=== archive ==="
for w in $WORKERS; do
  if [ -s "$ARCHIVE/$w.js" ]; then
    echo "$w: already archived ($(stat -c%s "$ARCHIVE/$w.js") bytes)"
  else
    curl -s "$API/accounts/$ACCT/workers/scripts/$w" -H "Authorization: Bearer $TOKEN" -o "$ARCHIVE/$w.js"
    echo "$w: archived $(stat -c%s "$ARCHIVE/$w.js") bytes"
  fi
done

echo "=== sanity: archives non-empty and not JSON error bodies ==="
for w in $WORKERS; do
  head -c 60 "$ARCHIVE/$w.js" | grep -q '"success":false' && { echo "$w archive looks like an API error — ABORT"; exit 1; }
done
echo "ok"

echo "=== delete ==="
for w in $WORKERS; do
  r=$(curl -s -X DELETE "$API/accounts/$ACCT/workers/scripts/$w?force=true" -H "Authorization: Bearer $TOKEN")
  echo "$w: $(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print('DELETED' if d['success'] else d['errors'])")"
done

echo "=== final count ==="
curl -s "$API/accounts/$ACCT/workers/scripts?per_page=100" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['result']; print(len(r),'workers remain'); [print(' -',w['id']) for w in sorted(r,key=lambda x:x['id'])]"

echo "=== apex still healthy? ==="
for u in https://authichain.com/ https://api.authichain.com/; do
  code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "$u")
  echo "GET $u -> $code"
done
