#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
export PATH="$(echo "$PATH"|tr ':' '\n'|grep -v /mnt/c/|paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd /home/zac/authichain-unified || exit 2
echo "=== vitest: new + existing auth tests ==="
npx vitest run server/_core/auth-roles.test.ts server/_core/google-oauth.test.ts server/auth.logout.test.ts 2>&1 | tail -25
echo "=== tsc --noEmit ==="
npx tsc --noEmit 2>&1 | tail -20
echo "=== CHECK_EXIT=${PIPESTATUS[0]} (0=green) ==="
