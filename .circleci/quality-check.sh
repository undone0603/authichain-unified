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
    # Mirror GitHub Actions Windows path safety in the existing offline gate.
    bash scripts/check-windows-paths.sh
    # Mirrors GitHub's gitleaks PR/push tree scan; SHA-pinned binary.
    bash .circleci/gitleaks-check.sh
    # Run x402's offline receipt and signed-delivery tests on the exact CircleCI SHA.
    # The static runner check alone does not execute these tests.
    node --test scripts/growth/x402-authenticated.test.mjs scripts/growth/x402-base-receipt.test.mjs scripts/growth/x402-reconcile.test.mjs
    # Independent negative-case tests for the human-free production release policy.
    node --test scripts/ci/autonomous-release-gate.test.mjs
    ;;
  typecheck-ratchet) node scripts/typecheck-ratchet.mjs ;;
  test-workers)
    pnpm test --filter='./workers/*' --continue=dependencies-successful
    # Run the real AgentZ edge/scheduler integration tests on the exact CircleCI SHA.
    # GitHub Actions hosted runners may be unavailable; this independent gate
    # remains credential-free and never deploys.
    node --test agentz/cloudflare-mcp/worker-runtime.test.mjs agentz/cloudflare-mcp/automation-integration.test.mjs agentz/cloudflare-mcp/memory-recovery.test.mjs agentz/cloudflare-mcp/binding-preflight.test.mjs
    ;;
  test-other)
    pnpm --filter agent-browser exec playwright install --with-deps chromium
    pnpm test --filter='!./workers/*' --continue=dependencies-successful
    # The root Vitest suites are excluded from turbo test --filter='!.'.
    # GitHub's hosted lint job also runs them; do not silently skip here.
    pnpm exec vitest run
    ;;
  build) pnpm build ;;
  extras)
    node scripts/check-drizzle-migrations.mjs
    sudo apt-get update
    sudo apt-get install --yes --no-install-recommends python3-venv
    python3 -m venv /tmp/agentz-ci-venv
    /tmp/agentz-ci-venv/bin/python -m pip install -r requirements-agentz.txt
    mkdir -p /tmp/pytest-results
    # Mirror the GitHub AgentZ Autonomous CI and MCP focused verification.
    # tests/test_agentz_*.py includes browser guard, TinyFish, MCP, and local
    # voice+vision tests. Explicitly run on the exact CircleCI source SHA.
    export PYTHONPATH="$PWD"
    export TINYFISH_API_KEY=""
    export AGENTZ_TINYFISH_SCOUT_ENABLED=""
    /tmp/agentz-ci-venv/bin/python -m pytest -q agentz/tests tests/test_agentz_*.py --junitxml=/tmp/pytest-results/agentz.xml
    /tmp/agentz-ci-venv/bin/python - <<'PY'
from agentz.mcp_browser_server import mcp
assert mcp is not None, "AgentZ MCP server failed to import"
print("AgentZ MCP registration smoke: PASS")
PY
    # GitHub's tinyfish-offline also proves a dry run cannot turn into a
    # real network call when credentials are absent. Preserve that property.
    /tmp/agentz-ci-venv/bin/python -m agentz.cli run tinyfish_a2a_scout --mode dry-run
    if /tmp/agentz-ci-venv/bin/python -m agentz.cli run tinyfish_a2a_scout --mode confirm; then
      echo "FAIL: TinyFish scout accepted live mode without credentials" >&2
      exit 1
    fi
    /tmp/agentz-ci-venv/bin/python - <<'PY'
import json
from agentz.core.runner import DEFAULT_AUDIT_LOG
rows = DEFAULT_AUDIT_LOG.read_text(encoding="utf-8").splitlines()
assert rows, "AgentZ wrote no run audit"
last = json.loads(rows[-1])
assert last["workflow_id"] == "tinyfish_a2a_scout", last
assert last["status"] == "blocked", last
print("AgentZ TinyFish missing-credential fail-closed: PASS")
PY
    ;;
esac
