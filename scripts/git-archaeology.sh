#!/usr/bin/env bash
# Read-only: figure out how the three lines (HEAD branch / local main / origin/main) relate.
cd /home/zac/authichain-unified

echo "=== merge-base main <-> HEAD ==="
mb=$(git merge-base main HEAD 2>/dev/null)
if [ -n "$mb" ]; then git log -1 --format='%h %ad %s' --date=short "$mb"; else echo "NO COMMON ANCESTOR"; fi

echo
echo "=== tree diff size: main vs HEAD (how different is the actual content?) ==="
git diff --stat main HEAD | tail -2

echo
echo "=== tree diff size: origin/main vs HEAD ==="
git diff --stat origin/main HEAD | tail -2

echo
echo "=== HEAD line: newest 10 (the line our deploys came from) ==="
git log --format='%h %ad %an %s' --date=short HEAD | head -10

echo
echo "=== does origin/main share history with HEAD? ==="
mb2=$(git merge-base origin/main HEAD 2>/dev/null)
if [ -n "$mb2" ]; then git log -1 --format='common ancestor: %h %ad %s' --date=short "$mb2"; else echo "NO COMMON ANCESTOR"; fi

echo
echo "=== does origin/main share history with local main? ==="
mb3=$(git merge-base origin/main main 2>/dev/null)
if [ -n "$mb3" ]; then git log -1 --format='common ancestor: %h %ad %s' --date=short "$mb3"; else echo "NO COMMON ANCESTOR"; fi

echo
echo "=== what changed in origin/main's unique commits (HEAD..origin/main) ==="
git diff --stat HEAD...origin/main 2>/dev/null | tail -3
git log --format='%h %s' HEAD..origin/main | head -8
