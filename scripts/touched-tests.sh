#!/usr/bin/env bash
# touched-tests.sh — run tests covering files edited in the tsc-fix batch
set -u
cd /home/zac/authichain-unified
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

npx vitest run server/new-features.test.ts server/loyalty-service.test.ts server/vouchers-service.test.ts 2>&1 | grep -E "Test Files|Tests |FAIL" | tail -10
