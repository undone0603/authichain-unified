#!/usr/bin/env bash
# Pages decommission (owner-approved 2026-06-11):
#  Batch A: delete 11 dead projects (404/500/522, no custom domains).
#  Batch B: snapshot homepage HTML of 4 live StrainChain promos, then delete.
#  Keep: authichain-dashboard.
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"
SNAP=~/authichain-unified/docs/archive/cf-pages
mkdir -p "$SNAP"

DEAD="authichain authichain-com authichain-landing authichain-pages authichain-premium authichain-unified deploy-cloudflare govchain qrartistry sc strainchain-pay"
LIVE="strainchain:strainchain.pages.dev strainchain-frontend:strainchain-frontend.pages.dev strainchain1:strainchain1.pages.dev vite-react-template:vite-react-template-3ub.pages.dev"

echo "=== Batch B snapshots ==="
for pair in $LIVE; do
  name=${pair%%:*}; sub=${pair##*:}
  curl -s -m 20 "https://$sub/" -o "$SNAP/$name.html" || true
  echo "$name: snapshot $(stat -c%s "$SNAP/$name.html" 2>/dev/null || echo 0) bytes"
done

echo "=== Batch B sanity: snapshots non-trivial ==="
for pair in $LIVE; do
  name=${pair%%:*}
  sz=$(stat -c%s "$SNAP/$name.html" 2>/dev/null || echo 0)
  [ "$sz" -gt 500 ] || { echo "$name snapshot too small ($sz bytes) — ABORT before deleting live projects"; exit 1; }
done
echo "ok"

echo "=== delete Batch A (11 dead) ==="
for p in $DEAD; do
  r=$(curl -s -X DELETE "$API/accounts/$ACCT/pages/projects/$p" -H "Authorization: Bearer $TOKEN")
  echo "$p: $(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print('DELETED' if d.get('success') else d.get('errors'))")"
done

echo "=== delete Batch B (4 promos) ==="
for pair in $LIVE; do
  p=${pair%%:*}
  r=$(curl -s -X DELETE "$API/accounts/$ACCT/pages/projects/$p" -H "Authorization: Bearer $TOKEN")
  echo "$p: $(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print('DELETED' if d.get('success') else d.get('errors'))")"
done

echo "=== final Pages list ==="
curl -s "$API/accounts/$ACCT/pages/projects" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['result']; print(len(r),'projects remain:'); [print(' -',p['name']) for p in r]"
