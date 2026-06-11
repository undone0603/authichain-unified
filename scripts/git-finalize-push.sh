#!/usr/bin/env bash
# Final approved steps: commit session scripts, rename stale main, create new main at merge, push.
set -eu
cd /home/zac/authichain-unified

# 1. commit the reconciliation scripts (keeps repo tidy; matches 42ffbcc convention)
git add scripts/git-archaeology.sh scripts/git-merge-step.sh scripts/git-merge-step2.sh \
        scripts/git-merge-step3.sh scripts/git-conflicts-view.sh scripts/git-merge-resolve.sh \
        scripts/verify-green.sh scripts/check-pre-merge.sh scripts/git-finalize-push.sh
git commit -m "chore: git reconciliation scripts (merge origin/main, CRLF triage, green gate)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"

# 2. rename stale alternate-history main (diverged 2026-05-19, last commit 2026-06-05)
git branch -m main main-legacy-2026-06-05

# 3. new main at the merged result
git branch main HEAD
git checkout main

# 4. push (normal, no force — origin/main is ancestor)
git push origin main
echo "push exit: $?"

echo
echo "=== final state ==="
git log -3 --format='%h %ad %s' --date=short
git branch -vv | head -8
git status --short | grep -v '^ M' | head -5
