#!/usr/bin/env bash
# Did the merge introduce the 19 tsc errors, or did they pre-exist at 42ffbcc?
# Use a throwaway worktree at the pre-merge commit, share node_modules via symlink.
set -u
cd /home/zac/authichain-unified
source ~/.nvm/nvm.sh
nvm use 22 >/dev/null

git worktree add /tmp/pre-merge-check 42ffbcc 2>&1 | tail -1
ln -sfn /home/zac/authichain-unified/node_modules /tmp/pre-merge-check/node_modules

cd /tmp/pre-merge-check
npx tsc --noEmit 2>&1 | tail -30
echo "pre-merge tsc exit: $?"
echo "error count: $(npx tsc --noEmit 2>/dev/null | grep -c 'error TS')"

cd /home/zac/authichain-unified
git worktree remove --force /tmp/pre-merge-check
