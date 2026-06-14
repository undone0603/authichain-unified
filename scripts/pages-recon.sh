#!/usr/bin/env bash
# Pages batch recon: list all Pages projects with custom domains, latest deploy,
# and live HTTP status of their *.pages.dev subdomain. Read-only.
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"

curl -s "$API/accounts/$ACCT/pages/projects" -H "Authorization: Bearer $TOKEN" \
  > /tmp/pages-projects.json

python3 - <<'EOF'
import json
d = json.load(open('/tmp/pages-projects.json'))
if not d.get('success'):
    print('API ERROR:', d.get('errors')); raise SystemExit(1)
for p in sorted(d['result'], key=lambda x: x['name']):
    dep = p.get('latest_deployment') or {}
    print(f"{p['name']}|{p.get('subdomain','')}|domains={','.join(p.get('domains',[])) or '-'}|created={p.get('created_on','')[:10]}|last_deploy={(dep.get('created_on') or '')[:10]}")
EOF

echo "=== live status of each pages.dev subdomain ==="
python3 -c "import json; [print(p.get('subdomain','')) for p in json.load(open('/tmp/pages-projects.json'))['result']]" \
| while read -r sub; do
  [ -n "$sub" ] || continue
  code=$(curl -s -o /dev/null -m 12 -w "%{http_code}" "https://$sub/")
  echo "$sub -> $code"
done
