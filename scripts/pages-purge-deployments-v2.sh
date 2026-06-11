#!/usr/bin/env bash
# Pages Batch A finisher v2: parallel deployment purge (xargs -P4, within CF's
# 1200 req/5min rate limit), no low pass cap. Then delete the project.
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"
export TOKEN ACCT API

for p in authichain-com authichain-unified authichain-pages; do
  export p
  echo "=== $p ==="
  pass=0
  while : ; do
    pass=$((pass+1))
    ids=$(curl -s "$API/accounts/$ACCT/pages/projects/$p/deployments?per_page=25" -H "Authorization: Bearer $TOKEN" \
      | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(x['id'] for x in d.get('result',[])))")
    [ -n "$ids" ] || break
    n=$(echo "$ids" | wc -l)
    echo "  pass $pass: deleting $n deployments (parallel)…"
    echo "$ids" | xargs -P 4 -I {} curl -s -X DELETE \
      "$API/accounts/$ACCT/pages/projects/$p/deployments/{}?force=true" \
      -H "Authorization: Bearer $TOKEN" -o /dev/null
    [ $pass -lt 120 ] || { echo "  pass cap hit — bail"; break; }
  done
  r=$(curl -s -X DELETE "$API/accounts/$ACCT/pages/projects/$p" -H "Authorization: Bearer $TOKEN")
  echo "  project: $(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print('DELETED' if d.get('success') else d.get('errors'))")"
done

echo "=== final Pages list ==="
curl -s "$API/accounts/$ACCT/pages/projects" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['result']; print(len(r),'projects remain:'); [print(' -',p['name']) for p in r]"
