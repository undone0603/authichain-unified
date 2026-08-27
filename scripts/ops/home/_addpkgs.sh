#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd /home/zac/authichain-unified || exit 2
pnpm add docusign-esign vectra @paddle/paddle-node-sdk 2>&1 | tail -25
echo "=== EXIT=$? ==="
