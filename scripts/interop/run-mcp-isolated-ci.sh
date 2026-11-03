#!/usr/bin/env bash
# Run ONLY on an independently authorized, isolated, unprivileged host.
# This script never registers a runner, deploys, or accesses production secrets.
set -Eeuo pipefail

: "${EXPECTED_SHA:?Set EXPECTED_SHA to the exact reviewed Git commit}"
: "${EVIDENCE_DIR:?Set EVIDENCE_DIR to an external writable evidence directory}"
[[ "${EXPECTED_SHA}" =~ ^[0-9a-f]{40}$ ]] || { echo "EXPECTED_SHA must be 40 lowercase hex characters" >&2; exit 2; }
[[ "$(git rev-parse HEAD)" == "${EXPECTED_SHA}" ]] || { echo "HEAD does not match EXPECTED_SHA" >&2; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo "Refusing dirty worktree" >&2; exit 2; }
[[ "${EVIDENCE_DIR}" == /* ]] || { echo "EVIDENCE_DIR must be absolute" >&2; exit 2; }
mkdir -p -- "${EVIDENCE_DIR}"
chmod 700 -- "${EVIDENCE_DIR}"
if [[ -n "${CI:-}" && "${CI}" != "true" ]]; then echo "Unexpected CI value" >&2; exit 2; fi
if [[ -n "${STRIPE_SECRET_KEY:-}" || -n "${CLOUDFLARE_API_TOKEN:-}" || -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Refusing to run with production credential variables present" >&2; exit 2
fi
node --version | tee "${EVIDENCE_DIR}/node-version.txt"
corepack pnpm --version | tee "${EVIDENCE_DIR}/pnpm-version.txt"
git rev-parse HEAD > "${EVIDENCE_DIR}/exact-head.txt"
git status --porcelain > "${EVIDENCE_DIR}/worktree-status.txt"
printf 'host=%s\nuser=%s\n' "$(hostname)" "$(id -un)" > "${EVIDENCE_DIR}/runner-identity.txt"

run_step() {
  local label="$1"; shift
  printf '%q ' "$@" > "${EVIDENCE_DIR}/${label}.command"
  printf '\n' >> "${EVIDENCE_DIR}/${label}.command"
  local status=0
  "$@" > "${EVIDENCE_DIR}/${label}.log" 2>&1 || status=$?
  printf '%s\n' "${status}" > "${EVIDENCE_DIR}/${label}.exit"
  if (( status != 0 )); then
    echo "FAILED: ${label} (exit ${status}); inspect redacted evidence" >&2
    return "${status}"
  fi
  echo "PASS: ${label}"
}

# Must use a locked dependency graph; no mutation of lockfile.
run_step install corepack pnpm install --frozen-lockfile --ignore-scripts
run_step format corepack pnpm exec prettier --check workers/authichain-com/src/mcp-routes.ts workers/authichain-com/src/mcp-routes.test.ts
run_step lint corepack pnpm exec eslint workers/authichain-com/src/mcp-routes.ts workers/authichain-com/src/mcp-routes.test.ts
run_step vitest corepack pnpm exec vitest run workers/authichain-com/src/mcp-routes.test.ts
run_step typecheck corepack pnpm exec tsc --noEmit
run_step worker-dry-run corepack pnpm exec wrangler deploy --dry-run --outdir /tmp/authichain-mcp-dry-run

# Never upload raw logs automatically: inspect/redact before sharing.
(cd "${EVIDENCE_DIR}" && sha256sum *.txt *.command *.exit *.log > manifest.sha256)
echo "Exact-head validation complete; evidence at ${EVIDENCE_DIR} (review for secrets before publication)."
