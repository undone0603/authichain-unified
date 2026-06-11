#!/usr/bin/env bash
# baseline-test-check.sh — stash working changes, run routers tests, restore
set -u
cd /home/zac/authichain-unified
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

git stash push -m "tsc-fix-wip" >/dev/null 2>&1 || { echo "STASH FAILED"; exit 1; }
echo "--- baseline (HEAD, no local edits) ---"
npx vitest run server/routers.test.ts 2>&1 | grep -E "Test Files|Tests " | tail -4
git stash pop >/dev/null 2>&1 || { echo "STASH POP FAILED — manual recovery needed"; exit 1; }
echo "--- stash restored ---"
git status --short | head -15
