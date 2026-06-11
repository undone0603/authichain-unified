#!/usr/bin/env bash
# Page 2 of Pages projects + git-connection check for the two that deployed today.
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"

echo "=== page 2 ==="
curl -s "$API/accounts/$ACCT/pages/projects?page=2" -H "Authorization: Bearer $TOKEN" > /tmp/pages-p2.json
python3 - <<'EOF'
import json
d = json.load(open('/tmp/pages-p2.json'))
if not d.get('success'):
    print('API ERROR:', d.get('errors')); raise SystemExit(1)
for p in sorted(d['result'], key=lambda x: x['name']):
    dep = p.get('latest_deployment') or {}
    print(f"{p['name']}|{p.get('subdomain','')}|domains={','.join(p.get('domains',[])) or '-'}|created={p.get('created_on','')[:10]}|last_deploy={(dep.get('created_on') or '')[:10]}")
EOF

echo "=== live status (page 2) ==="
python3 -c "import json; [print(p.get('subdomain','')) for p in json.load(open('/tmp/pages-p2.json'))['result']]" \
| while read -r sub; do
  [ -n "$sub" ] || continue
  code=$(curl -s -o /dev/null -m 12 -w "%{http_code}" "https://$sub/")
  echo "$sub -> $code"
done

echo "=== git connection of today-deploying projects ==="
for p in authichain-com authichain-unified; do
  curl -s "$API/accounts/$ACCT/pages/projects/$p" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)['result']
src=d.get('source') or {}
cfg=(src.get('config') or {})
print(d['name'],'source_type=',src.get('type','none'),'repo=',cfg.get('owner','?'),'/',cfg.get('repo_name','?'),'branch=',cfg.get('production_branch','?'))
"
done
