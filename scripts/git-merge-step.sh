#!/usr/bin/env bash
# Approved reconciliation, step 1: discard CRLF-only mods on the 13 merge-path files
# (verified content-identical via --ignore-cr-at-eol), then merge origin/main.
set -u
cd /home/zac/authichain-unified

FILES="package.json pnpm-lock.yaml server/_core/bayesian.ts server/_core/imageGeneration.ts server/db.ts server/missions.test.ts server/routers.test.ts server/services/order-payment-handler.test.ts server/services/order-payment-handler.ts server/stripe-connect-service.test.ts server/test-setup.ts vitest.config.ts"

echo "=== re-verify zero real diff on merge-path files (safety) ==="
real=$(git diff --stat --ignore-cr-at-eol -- $FILES)
if [ -n "$real" ]; then
  echo "REAL CHANGES PRESENT — ABORTING DISCARD:"
  echo "$real"
  exit 1
fi
echo "confirmed: CRLF-only. discarding…"
git checkout -- $FILES

echo
echo "=== merge origin/main ==="
git merge origin/main --no-edit
rc=$?
echo "merge exit: $rc"

echo
echo "=== status after merge ==="
git status --short | grep -v '^ M' | head -30
echo "---"
git log -3 --format='%h %ad %s' --date=short
