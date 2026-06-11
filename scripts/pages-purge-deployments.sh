#!/usr/bin/env bash
# Finish Pages Batch A: the 3 projects blocked by error 8000076 (too many deployments).
# Per CF guide: delete all deployments (force=true skips aliased-deployment guard), then the project.
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"

for p in authichain-com authichain-unified authichain-pages; do
  echo "=== $p ==="
  pass=0
  while : ; do
    pass=$((pass+1))
    ids=$(curl -s "$API/accounts/$ACCT/pages/projects/$p/deployments" -H "Authorization: Bearer $TOKEN" \
      | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(x['id'] for x in d.get('result',[])))")
    [ -n "$ids" ] || break
    n=$(echo "$ids" | wc -l)
    echo "  pass $pass: deleting $n deployments…"
    for id in $ids; do
      curl -s -X DELETE "$API/accounts/$ACCT/pages/projects/$p/deployments/$id?force=true" \
        -H "Authorization: Bearer $TOKEN" -o /dev/null
    done
    [ $pass -lt 40 ] || { echo "  too many passes — bail"; break; }
  done
  r=$(curl -s -X DELETE "$API/accounts/$ACCT/pages/projects/$p" -H "Authorization: Bearer $TOKEN")
  echo "  project: $(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print('DELETED' if d.get('success') else d.get('errors'))")"
done

echo "=== final Pages list ==="
curl -s "$API/accounts/$ACCT/pages/projects" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['result']; print(len(r),'projects remain:'); [print(' -',p['name']) for p in r]"
