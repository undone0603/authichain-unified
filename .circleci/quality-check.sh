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
    # Fail early if the offline exact-head or disposable PostgreSQL
    # acceptance runners are syntactically invalid; does not run Docker here.
    bash -n scripts/ci/x402-native-release-acceptance.sh
    bash -n scripts/ci/x402-disposable-postgres.sh
    node --test scripts/ci/autonomous-release-gate.test.mjs
    ;;
  typecheck-ratchet) node scripts/typecheck-ratchet.mjs ;;
  test-workers)
    # Explicitly exercise new root-level x402 Stripe prepaid paths. Turbo's
    # worker package filter alone does not prove these root modules executed.
    # Keep this first to fail fast on incorrect grants or cross-rail behavior.
    node --test scripts/ci/x402-ledger-contract.test.mjs
    pnpm exec vitest run \
      src/lib/x402-agent-pack.test.ts \
      src/lib/x402-agent-pack-fulfill.test.ts \
      src/lib/x402-agent-pack-verify.test.ts \
      src/lib/checkout-gate.test.ts
    pnpm test --filter='./workers/*' --continue=dependencies-successful
    # Preserve main's separate AgentZ edge/scheduler integration gate.
    node --test agentz/cloudflare-mcp/worker-runtime.test.mjs agentz/cloudflare-mcp/automation-integration.test.mjs
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
    PYTHONPATH="$PWD" /tmp/agentz-ci-venv/bin/python -m pytest agentz/tests --junitxml=/tmp/pytest-results/agentz.xml
    ;;
esac
