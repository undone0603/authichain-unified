#!/usr/bin/env bash
# Invoked under GNU timeout by config.yml. One deadline covers setup and checks.
set -euo pipefail

task="${1:?missing quality check name}"
case "$task" in
  quality|typecheck-ratchet|test-workers|test-other|build|extras|agentz) ;;
  *) echo "Unknown quality check: $task" >&2; exit 2 ;;
esac

test "$(git rev-parse HEAD)" = "${CIRCLE_SHA1:?missing pipeline revision}"
# Skip only when scripts/ci/ci-scope.mjs proves the non-main diff cannot
# affect this task (archive-only, or the other product only); errors run full.
if [ "$task" != "quality" ]; then
  scope="$(node scripts/ci/ci-scope.mjs "$task")" || scope="full"
  if [ "$scope" = "skip" ]; then
    echo "Scoped CI fast path: $task not affected by the diff at exact HEAD"
    exit 0
  fi
fi
# Keep Corepack shims in the unprivileged user's PATH.
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
corepack enable --install-directory "$HOME/.local/bin"
corepack prepare pnpm@10.28.2 --activate
pnpm config set store-dir ~/.pnpm-store
# The AgentZ task is Python plus dependency-free node:test suites.
if [ "$task" != "agentz" ]; then
  pnpm install --frozen-lockfile --prefer-offline
fi

case "$task" in
  quality)
    node --test scripts/ci/ci-scope.test.mjs scripts/ci/check-secrets-format.test.mjs
    pnpm check
    pnpm lint:ci
    node scripts/check-workflow-cannot-fail.mjs
    node scripts/ci/check-deploy-invariants.mjs
    node scripts/ci/check-node-test-runners.mjs
    node --test scripts/ci/check-node-test-runners.test.mjs
    # Mirror GitHub Actions Windows path safety in the existing offline gate.
    bash scripts/check-windows-paths.sh
    # Mirrors GitHub's gitleaks PR/push tree scan; SHA-pinned binary.
    bash .circleci/gitleaks-check.sh
    # Run x402's offline receipt and signed-delivery tests on the exact CircleCI SHA.
    # The static runner check alone does not execute these tests.
    node --test scripts/growth/x402-authenticated.test.mjs scripts/growth/x402-base-receipt.test.mjs scripts/growth/x402-reconcile.test.mjs
    # Independent negative-case tests for the human-free production release policy.
    node --test scripts/ci/autonomous-release-gate.test.mjs
    # Bounded synthetic peer negative fixture: no network, keys, or payments.
    node --test scripts/alliances/peer-subject-binding-fixture.test.mjs
    # Descriptor-only A2A audit: no remote tasks, credentials, or paid calls.
    node --test scripts/alliances/a2a-card-evidence-audit.test.mjs
    ;;
  typecheck-ratchet) node scripts/typecheck-ratchet.mjs ;;
  test-workers)
    pnpm test --filter='./workers/*' --continue=dependencies-successful
    ;;
  test-other)
    # Atomic checkout grants MUST pass against two separate PostgreSQL clients.
    # Avoid Vitest's conditional describe.skip when local server binaries are absent.
    # This container uses an unprivileged user and an ephemeral 127.0.0.1 cluster.
    sudo apt-get update -qq
    sudo env DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends postgresql
    if [ "$(id -u)" -eq 0 ]; then
      echo "FAIL: initdb cannot run as root; use the unprivileged CircleCI Docker user" >&2
      exit 1
    fi
    PG_BINDIR=""
    for dir in /usr/lib/postgresql/*/bin; do
      if [ -x "$dir/initdb" ] && [ -x "$dir/postgres" ]; then
        PG_BINDIR="$dir"
      fi
    done
    if [ -z "$PG_BINDIR" ]; then
      echo "FAIL: PostgreSQL initdb/postgres server binaries missing" >&2
      exit 1
    fi
    export PG_BINDIR CATALOG_GRANT_PG_REQUIRED=1
    echo "CATALOG_PG_PROOF_HEAD $(git rev-parse HEAD)"
    echo "CATALOG_PG_PROOF_SERVER $("$PG_BINDIR/postgres" --version)"
    sha256sum supabase/migrations/20261115180000_atomic_catalog_session_grants.sql
    # This MUST run five tests; absent binaries, skips, or failing assertions fail CI.
    pnpm exec vitest run src/lib/catalog-session-grant.concurrency.pg.test.ts --reporter=verbose
    # The Node executor has an ephemeral, synthetic PostgreSQL sidecar.
    # Exercise actual committed PL/pgSQL and concurrency before wider tests.
    node scripts/ci/dpp-isolated-postgres-replay.mjs
    pnpm --filter agent-browser exec playwright install --with-deps chromium
    pnpm test --filter='!./workers/*' --continue=dependencies-successful
    # The root Vitest suites are excluded from turbo test --filter='!.'.
    # GitHub's hosted lint job also runs them; do not silently skip here.
    pnpm exec vitest run
    ;;
  build) pnpm build ;;
  extras)
    node scripts/check-drizzle-migrations.mjs
    ;;
  agentz)
    sudo apt-get update
    sudo apt-get install --yes --no-install-recommends python3-venv
    python3 -m venv /tmp/agentz-ci-venv
    /tmp/agentz-ci-venv/bin/python -m pip install -r requirements-agentz.txt
    mkdir -p /tmp/pytest-results
    # Mirror the GitHub AgentZ Autonomous CI and MCP focused verification.
    # agentz/tests includes browser guard, TinyFish, MCP, and local
    # voice+vision tests. Explicitly run on the exact CircleCI source SHA.
    export PYTHONPATH="$PWD"
    export TINYFISH_API_KEY=""
    export AGENTZ_TINYFISH_SCOUT_ENABLED=""
    /tmp/agentz-ci-venv/bin/python -m pytest -q agentz/tests --junitxml=/tmp/pytest-results/agentz.xml
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
    # The wheel is the AgentZ release unit. Prove it builds, carries its data
    # files, and runs outside the repo with no PYTHONPATH, against the pins.
    rm -rf /tmp/agentz-wheel /tmp/agentz-site
    /tmp/agentz-ci-venv/bin/python -m pip wheel --no-deps --wheel-dir /tmp/agentz-wheel .
    /tmp/agentz-ci-venv/bin/python -m pip install --no-deps --target /tmp/agentz-site /tmp/agentz-wheel/agentz-*.whl
    (cd /tmp && env -u PYTHONPATH PYTHONPATH=/tmp/agentz-site /tmp/agentz-ci-venv/bin/python - <<'PY'
import importlib.resources as r, agentz
assert agentz.__file__.startswith("/tmp/agentz-site/"), agentz.__file__
for f in ("workflows/registry.yaml", "capabilities/registry.yaml", "core/schema.sql",
          "api/voice_vision_console.html", "goals/backlog.yaml"):
    assert r.files("agentz").joinpath(f).is_file(), f"wheel is missing agentz/{f}"
assert not r.files("agentz").joinpath("tests").is_dir(), "tests must not ship in the wheel"
print("AgentZ wheel", agentz.__version__, "data files: PASS")
PY
    cd /tmp && env -u PYTHONPATH PYTHONPATH=/tmp/agentz-site /tmp/agentz-ci-venv/bin/python -m agentz.cli list >/dev/null)
    echo "AgentZ wheel CLI outside the repo: PASS"
    # Real AgentZ edge/scheduler integration tests on the exact CircleCI SHA.
    # Credential-free and never deploys.
    node --test agentz/cloudflare-mcp/worker-runtime.test.mjs agentz/cloudflare-mcp/automation-integration.test.mjs agentz/cloudflare-mcp/memory-recovery.test.mjs agentz/cloudflare-mcp/scheduler-recovery.test.mjs agentz/cloudflare-mcp/binding-preflight.test.mjs
    ;;
esac
