#!/usr/bin/env bash
# Pages Batch A finisher v4. Lessons from v2/v3:
#  - v2: xargs exit 123 + set -e aborted on one failed curl.
#  - v3: a rate-limited LIST call looked like an empty list -> false "done", project delete 8000076.
# v4: trust result_info.total_count, distinguish API errors from empty, back off on failures,
#     pace deletes to stay under the 1200 req/5min API limit.
set -u
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"

list() { # $1=project -> "TOTAL\nid1\nid2…" or "ERR"
  curl -s -m 30 "$API/accounts/$ACCT/pages/projects/$1/deployments?per_page=25" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if not d.get('success'): print('ERR'); sys.exit()
    print((d.get('result_info') or {}).get('total_count','?'))
    for x in d.get('result',[]): print(x['id'])
except Exception: print('ERR')"
}

for p in authichain-unified authichain-pages; do
  echo "=== $p ==="
  errstreak=0
  prev=""
  while : ; do
    out=$(list "$p")
    if [ "$out" = "ERR" ] || [ -z "$out" ]; then
      errstreak=$((errstreak+1))
      [ $errstreak -le 10 ] || { echo "  list failing persistently — abort this project"; break; }
      echo "  list error — backing off 30s ($errstreak/10)"
      sleep 30
      continue
    fi
    errstreak=0
    total=$(echo "$out" | head -1)
    ids=$(echo "$out" | tail -n +2)
    if [ "$total" = "0" ] || [ -z "$ids" ]; then echo "  total_count=$total — purge complete"; break; fi
    if [ "$ids" = "$prev" ]; then echo "  stuck on $(echo "$ids" | wc -l) undeletable deployment(s) (total=$total) — trying project delete"; break; fi
    prev="$ids"
    echo "  total=$total, deleting next $(echo "$ids" | wc -l)…"
    for id in $ids; do
      curl -s -m 30 -X DELETE "$API/accounts/$ACCT/pages/projects/$p/deployments/$id?force=true" \
        -H "Authorization: Bearer $TOKEN" -o /dev/null || true
      sleep 0.3   # ~3 req/s < 4 req/s account limit
    done
  done
  r=$(curl -s -X DELETE "$API/accounts/$ACCT/pages/projects/$p" -H "Authorization: Bearer $TOKEN")
  echo "  project: $(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print('DELETED' if d.get('success') else d.get('errors'))" 2>/dev/null || echo 'parse-fail')"
done

echo "=== final Pages list ==="
curl -s "$API/accounts/$ACCT/pages/projects" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['result']; print(len(r),'projects remain:'); [print(' -',p['name']) for p in r]"
