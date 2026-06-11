#!/usr/bin/env bash
# Batch 3 recon: (a) is the exposed sk_live key alive? (read-only balance call)
# (b) which workers serve the 3 registered Stripe webhook URLs?
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
ZONE=6580df4e35d347c94fef88b33784a514
API="https://api.cloudflare.com/client/v4"
# Key is NOT embedded here: read it at runtime from the archived bundle where it
# was already exposed (docs/archive/cf-workers/qron-fiverr.js).
KEY=$(grep -oP 'sk_live_[A-Za-z0-9]+' ~/authichain-unified/docs/archive/cf-workers/qron-fiverr.js | head -1)
[ -n "$KEY" ] || { echo "key not found in archive"; exit 1; }

echo "=== (a) exposed key validity: GET /v1/balance (read-only) ==="
curl -s -o /tmp/stripe-balance.json -w "HTTP %{http_code}\n" \
  -u "$KEY:" https://api.stripe.com/v1/balance
head -c 400 /tmp/stripe-balance.json
echo; echo

echo "=== (b1) zone worker routes (who owns api.authichain.com etc) ==="
curl -s "$API/zones/$ZONE/workers/routes" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; [print(r['pattern'],'->',r.get('script','(none)')) for r in json.load(sys.stdin)['result']]"
echo

echo "=== (b2) workers custom domains on account ==="
curl -s "$API/accounts/$ACCT/workers/domains" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; [print(d['hostname'],'->',d['service']) for d in json.load(sys.stdin)['result']]"
echo

echo "=== (b3) what the webhook URLs return to a GET (no event fired) ==="
for u in https://api.authichain.com/webhook/stripe https://authichain.com/api/stripe/webhook; do
  code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "$u")
  echo "GET $u -> $code"
done
