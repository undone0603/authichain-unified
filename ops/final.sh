#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd "$(dirname "$0")/.." || exit 2
echo "=== pnpm run check (tsc --noEmit) ==="
pnpm run check; echo "CHECK_EXIT=$?"
echo "=== pnpm build ==="
pnpm build > /tmp/finalbuild.log 2>&1; echo "BUILD_EXIT=$?"
tail -4 /tmp/finalbuild.log
