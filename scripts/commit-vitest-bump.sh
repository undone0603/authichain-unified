#!/usr/bin/env bash
set -u
cd /home/zac/authichain-unified
git add package.json pnpm-lock.yaml scripts/bump-vitest.sh scripts/check-deploy.sh scripts/wait-deploy.sh scripts/commit-vitest-bump.sh
git commit -m "fix(security): bump vitest to ^3.2.6 (GHSA critical: UI server arbitrary file read/execute)

Dev-only dependency; closes the sole critical Dependabot alert on main.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main 2>&1 | tail -3
echo "push exit: $?"
