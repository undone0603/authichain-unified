#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/mnt/c/' | paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd /home/zac/authichain-unified || exit 2
npx tsc --noEmit > /tmp/tsc.log 2>&1
echo "=== TOTAL ERROR LINES: $(grep -cE 'error TS' /tmp/tsc.log) ==="
echo "=== ERRORS PER FILE ==="
grep -oE '^[^(]+\.ts' /tmp/tsc.log | sort | uniq -c | sort -rn
