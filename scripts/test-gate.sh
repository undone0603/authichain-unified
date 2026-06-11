#!/usr/bin/env bash
# test-gate.sh — run vitest suite, report summary lines only
set -u
cd /home/zac/authichain-unified
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

OUT=$(pnpm test 2>&1)
CODE=$?
echo "$OUT" | grep -E "(Test Files|Tests |FAIL|✓ server|✗)" | tail -30
echo "exit=$CODE"
