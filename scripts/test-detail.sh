#!/usr/bin/env bash
# test-detail.sh — show first real error from routers.test.ts
set -u
cd /home/zac/authichain-unified
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

npx vitest run server/routers.test.ts 2>&1 | grep -A 12 -m 3 "FAIL\|Error:" | head -80
