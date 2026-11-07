#!/usr/bin/env bash
# Invoked under GNU timeout by config.yml. One deadline covers setup and checks.
set -euo pipefail

task="${1:?missing quality check name}"
case "$task" in
  quality|typecheck-ratchet|test-workers|test-other|build|extras) ;;
  *) echo "Unknown quality check: $task" >&2; exit 2 ;;
esac

test "$(git rev-parse HEAD)" = "${CIRCLE_SHA1:?missing pipeline revision}"
# Keep Corepack shims in the unprivileged user's PATH.
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
corepack enable --install-directory "$HOME/.local/bin"
corepack prepare pnpm@10.28.2 --activate
pnpm config set store-dir ~/.pnpm-store
pnpm install --frozen-lockfile --prefer-offline

case "$task" in
  quality)
    pnpm check
    pnpm lint:ci
    node scripts/check-workflow-cannot-fail.mjs
    node scripts/ci/check-deploy-invariants.mjs
    node scripts/ci/check-node-test-runners.mjs
    ;;
  typecheck-ratchet) node scripts/typecheck-ratchet.mjs ;;
  test-workers) pnpm test --filter='./workers/*' --continue=dependencies-successful ;;
  test-other)
    pnpm --filter agent-browser exec playwright install --with-deps chromium
    pnpm test --filter='!./workers/*' --continue=dependencies-successful
    ;;
  build) pnpm build ;;
  extras)
    node scripts/check-drizzle-migrations.mjs
    sudo apt-get update
    sudo apt-get install --yes --no-install-recommends python3-venv
    python3 -m venv /tmp/agentz-ci-venv
    /tmp/agentz-ci-venv/bin/python -m pip install -r requirements-agentz.txt
    mkdir -p /tmp/pytest-results
    PYTHONPATH="$PWD" /tmp/agentz-ci-venv/bin/python -m pytest agentz/tests --junitxml=/tmp/pytest-results/agentz.xml
    ;;
esac
