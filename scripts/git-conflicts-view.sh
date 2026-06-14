#!/usr/bin/env bash
# Show conflict hunks for the 5 non-lockfile conflicts + conflict sizes.
set -u
cd /home/zac/authichain-unified

for f in package.json server/db.ts server/missions.test.ts server/routers.test.ts server/services/order-payment-handler.ts; do
  n=$(grep -c '^<<<<<<<' "$f")
  echo "##### $f — $n conflict hunk(s) #####"
  awk '/^<<<<<<</,/^>>>>>>>/' "$f" | head -120
  echo
done
echo "##### pnpm-lock.yaml hunks: $(grep -c '^<<<<<<<' pnpm-lock.yaml) #####"
