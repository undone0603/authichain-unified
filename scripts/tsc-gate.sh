#!/usr/bin/env bash
# tsc-gate.sh — run typecheck and report error count (baseline was 17)
set -u
cd /home/zac/authichain-unified
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

echo "=== pnpm check (tsc --noEmit) ==="
OUT=$(pnpm check 2>&1)
CODE=$?
echo "$OUT" | grep -E "error TS" | head -40
COUNT=$(echo "$OUT" | grep -cE "error TS")
echo ""
echo "exit=$CODE error_count=$COUNT (baseline was 17)"
