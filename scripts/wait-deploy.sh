#!/usr/bin/env bash
set -u
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1
cd /home/zac/authichain-unified
for i in $(seq 1 30); do
  line=$(vercel ls 2>/dev/null | grep -m1 'Production')
  echo "[$i] $line"
  case "$line" in
    *Ready*) echo "DEPLOY READY"; break ;;
    *Error*) echo "DEPLOY ERROR"; break ;;
  esac
  sleep 20
done
echo
echo "=== prod bundle hash (was index-GMZb8yuS.js) ==="
curl -s -m 15 https://app.authichain.com/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1
echo "=== prod health ==="
curl -s -m 15 https://app.authichain.com/api/health
echo
echo "=== webhook endpoint sanity (unsigned POST must 400) ==="
curl -s -m 15 -o /dev/null -w 'HTTP %{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' https://app.authichain.com/api/stripe/webhook
