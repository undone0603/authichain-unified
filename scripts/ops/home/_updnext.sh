#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd /home/zac/authichain-unified || exit 2
echo "=== updating next to latest patched ==="
pnpm add next@latest 2>&1 | tail -8
echo "=== new next version ==="
node -e "console.log(require('./package.json').dependencies.next)"
echo "=== tsc check after bump ==="
npx tsc --noEmit 2>&1 | tail -15
echo "=== CHECK_EXIT=${PIPESTATUS[0]} (0=green) ==="
