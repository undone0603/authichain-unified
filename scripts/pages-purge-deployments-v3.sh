#!/usr/bin/env bash
# Pages Batch A finisher v3: resume purge of authichain-unified + authichain-pages.
# v2 lessons: tolerate individual curl failures (xargs 123 + set -e killed v2);
# detect "stuck" (same ids two passes in a row) instead of a blind pass cap —
# the project DELETE succeeds once the bulk is gone even if one deployment lingers.
set -u
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"

for p in authichain-unified authichain-pages; do
  echo "=== $p ==="
  prev=""
  pass=0
  while : ; do
    pass=$((pass+1))
    ids=$(curl -s "$API/accounts/$ACCT/pages/projects/$p/deployments?per_page=25" -H "Authorization: Bearer $TOKEN" \
      | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(x['id'] for x in d.get('result',[])))" 2>/dev/null || true)
    [ -n "$ids" ] || { echo "  empty after $((pass-1)) passes"; break; }
    if [ "$ids" = "$prev" ]; then echo "  stuck on $(echo "$ids" | wc -l) undeletable deployment(s) — proceeding to project delete"; break; fi
    prev="$ids"
    n=$(echo "$ids" | wc -l)
    echo "  pass $pass: deleting $n deployments…"
    echo "$ids" | xargs -P 4 -I {} curl -s -X DELETE \
      "$API/accounts/$ACCT/pages/projects/$p/deployments/{}?force=true" \
      -H "Authorization: Bearer $TOKEN" -o /dev/null || true
  done
  r=$(curl -s -X DELETE "$API/accounts/$ACCT/pages/projects/$p" -H "Authorization: Bearer $TOKEN")
  echo "  project: $(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print('DELETED' if d.get('success') else d.get('errors'))")"
done

echo "=== final Pages list ==="
curl -s "$API/accounts/$ACCT/pages/projects" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['result']; print(len(r),'projects remain:'); [print(' -',p['name']) for p in r]"
