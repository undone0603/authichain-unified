#!/usr/bin/env bash
# Discard CRLF-only worktree mods on ALL files the merge will touch
# (= files differing between HEAD and origin/main), then merge.
# Any file with a REAL local diff is listed and left alone — merge will tell us if it still blocks.
set -u
cd /home/zac/authichain-unified

touched=$(git diff --name-only HEAD origin/main)
echo "merge will touch $(echo "$touched" | wc -l) paths"

safe=()
unsafe=()
while IFS= read -r f; do
  [ -f "$f" ] || continue
  # locally modified at all?
  git diff --quiet -- "$f" && continue
  # real content change, or CRLF-only?
  if git diff --quiet --ignore-cr-at-eol -- "$f"; then
    safe+=("$f")
  else
    unsafe+=("$f")
  fi
done <<< "$touched"

echo "CRLF-only (discarding): ${#safe[@]}"
printf '  %s\n' "${safe[@]:-none}"
echo "REAL local changes (NOT touching): ${#unsafe[@]}"
printf '  %s\n' "${unsafe[@]:-none}"

[ ${#safe[@]} -gt 0 ] && git checkout -- "${safe[@]}"

echo
echo "=== merge origin/main ==="
git merge origin/main --no-edit
rc=$?
echo "merge exit: $rc"

echo
echo "=== post-merge state ==="
git log -2 --format='%h %ad %s' --date=short
git status --short | grep -v '^ M' | head -20
