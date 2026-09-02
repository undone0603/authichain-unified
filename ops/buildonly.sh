#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd "$(dirname "$0")/.." || exit 2
echo "=== pnpm build (vite + esbuild) ==="
pnpm build > /tmp/build.log 2>&1
echo "=== EXIT_BUILD=$? ==="
echo "--- last 15 lines ---"
tail -15 /tmp/build.log
echo "--- any ERROR lines ---"
grep -iE '✘|error:' /tmp/build.log | head -20 || echo "(no hard errors)"
