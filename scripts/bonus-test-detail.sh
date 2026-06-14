#!/usr/bin/env bash
# bonus-test-detail.sh — detail on the single new-features failure
set -u
cd /home/zac/authichain-unified
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

npx vitest run server/new-features.test.ts -t "createUserBonuses" 2>&1 | grep -B 2 -A 15 "FAIL\|AssertionError\|Error:" | head -60
