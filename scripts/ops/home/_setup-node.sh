#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
# strip Windows paths so we don't pick up Windows node/pnpm shims
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -)"
. "$NVM_DIR/nvm.sh"
nvm install 22
nvm alias default 22
nvm use 22
corepack enable
corepack prepare pnpm@10.28.2 --activate
echo "=== INSTALLED ==="
echo "HOME=$HOME"
echo "node: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "which node: $(command -v node)"
echo "which pnpm: $(command -v pnpm)"
