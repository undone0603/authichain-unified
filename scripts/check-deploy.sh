#!/usr/bin/env bash
set -u
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1
cd /home/zac/authichain-unified
echo "=== latest deployments ==="
vercel ls 2>&1 | head -8
echo
echo "=== prod health ==="
curl -s -m 15 https://app.authichain.com/api/health
echo
echo "=== prod bundle hash ==="
curl -s -m 15 https://app.authichain.com/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1
