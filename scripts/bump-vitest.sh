#!/usr/bin/env bash
set -u
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1
cd /home/zac/authichain-unified
pnpm up vitest@^3.2.6 2>&1 | tail -5
grep '"vitest"' package.json
pnpm vitest run server/webhooks/stripe-plan-detection.test.ts server/auth.logout.test.ts 2>&1 | tail -6
