#!/bin/bash

echo "=== TASK 1: PR AND CI STATUS ==="
for pr in 1856 1857 1858 1859 1860 1861; do
    echo "--- PR #$pr ---"
    gh pr view $pr --json number,title,state,mergeable,autoMergeRequest,statusCheckRollup,url
done

echo "Approving/merging 1860..."
gh pr review 1860 --approve || true
gh pr merge 1860 --auto --squash || gh pr merge 1860 --squash || true

echo "Auto-merging 1858, 1859, 1861..."
for pr in 1858 1859 1861; do
    gh pr merge $pr --auto --squash || gh pr merge $pr --squash || true
done

echo "=== TASK 2: GOVCHAIN SBIR SEARCH ==="
find . -iname "*govchain*" -o -iname "*sbir*" -o -iname "*svip*"

echo "=== TASK 3: PR 1856 MIGRATION ==="
gh pr view 1856 --json files,body,title,commits
find . -name "*.sql"

