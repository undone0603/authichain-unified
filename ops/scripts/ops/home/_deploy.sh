#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd /home/zac/authichain-unified || exit 2
AUTH="/mnt/c/Users/rac/AppData/Roaming/com.vercel.cli/Data/auth.json"
TOKEN=$(node -e "try{console.log(require('$AUTH').token||'')}catch(e){console.log('')}")
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 3; fi
echo "token length: ${#TOKEN}"
echo "=== whoami ==="
npx --yes vercel@latest whoami --token "$TOKEN" 2>&1 | tail -2
echo "=== deploy (PREVIEW) ==="
npx --yes vercel@latest deploy --yes --token "$TOKEN" 2>&1 | tail -45
echo "=== DEPLOY_EXIT=${PIPESTATUS[0]} ==="
