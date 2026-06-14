#!/usr/bin/env bash
# Resolve all 6 conflicts as OURS (HEAD = deployed green line), complete the merge.
# Auto-merged origin/main changes (NFT contract rewrite, test infra) stay in;
# pnpm check + build afterwards gates semantic consistency.
set -eu
cd /home/zac/authichain-unified

git checkout --ours package.json pnpm-lock.yaml server/db.ts server/missions.test.ts server/routers.test.ts server/services/order-payment-handler.ts
git add package.json pnpm-lock.yaml server/db.ts server/missions.test.ts server/routers.test.ts server/services/order-payment-handler.ts

# sanity: no conflict markers left anywhere staged
left=$(git diff --cached --check || true)
if echo "$left" | grep -q 'conflict'; then echo "MARKERS REMAIN:"; echo "$left"; exit 1; fi

git commit --no-edit
echo
git log -2 --format='%h %ad %s' --date=short
echo
echo "=== origin/main now ancestor? ==="
git merge-base --is-ancestor origin/main HEAD && echo "YES — origin/main is ancestor of HEAD"
echo
echo "=== what the merge actually brought in (real diff vs pre-merge 42ffbcc) ==="
git diff --stat --ignore-cr-at-eol 42ffbcc HEAD | tail -20
