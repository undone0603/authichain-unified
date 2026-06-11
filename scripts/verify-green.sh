#!/usr/bin/env bash
# Post-merge green gate: pnpm check + pnpm build (node 22 via nvm).
set -u
cd /home/zac/authichain-unified
source ~/.nvm/nvm.sh
nvm use 22 >/dev/null

echo "node: $(node -v)  pnpm: $(pnpm -v)"
echo
echo "=== pnpm check ==="
pnpm check
c=$?
echo "check exit: $c"
echo
echo "=== pnpm build ==="
pnpm build 2>&1 | tail -25
b=${PIPESTATUS[0]}
echo "build exit: $b"
echo
if [ "$c" = "0" ] && [ "$b" = "0" ]; then echo "GREEN: both passed"; else echo "RED: check=$c build=$b"; fi
