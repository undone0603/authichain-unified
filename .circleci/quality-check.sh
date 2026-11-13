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
    # Independent negative-case tests for the human-free production release policy.
    node --test scripts/ci/autonomous-release-gate.test.mjs
    ;;
  typecheck-ratchet) node scripts/typecheck-ratchet.mjs ;;
  test-workers)
    pnpm test --filter='./workers/*' --continue=dependencies-successful
    # Run the real AgentZ edge/scheduler integration tests on the exact CircleCI SHA.
    # GitHub Actions hosted runners may be unavailable; this independent gate
    # remains credential-free and never deploys.
    node --test agentz/cloudflare-mcp/worker-runtime.test.mjs agentz/cloudflare-mcp/automation-integration.test.mjs agentz/cloudflare-mcp/memory.test.mjs
    ;;
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
    # Match the five focused Python suites from the blocked GitHub Actions job.
    # Reuse the already-installed, ephemeral AgentZ venv; never use secrets.
    for suite in \
      test_agentz_capability_policy.py \
      test_agentz_browser_executor.py \
      test_agentz_navigation_dispatch.py \
      test_agentz_code_proposals.py \
      test_agentz_mcp_readiness.py; do
      PYTHONPATH="$PWD" /tmp/agentz-ci-venv/bin/python -m unittest discover -s tests -p "$suite"
    done
    # Keep the MCP registration smoke in the same credential-free check.
    PYTHONPATH="$PWD" /tmp/agentz-ci-venv/bin/python -c 'from agentz.mcp_browser_server import mcp; assert mcp is not None'
    PYTHONPATH="$PWD" /tmp/agentz-ci-venv/bin/python -m pytest agentz/tests --junitxml=/tmp/pytest-results/agentz.xml
    ;;
esac
