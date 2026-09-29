#!/usr/bin/env bash
# Bind claw AGENTZ_* secrets on authichain-openclaw.
#
# AGENTZ_API_URL is always bound (secret-only; a plaintext [vars] value makes
# wrangler secret put fail 10053). AGENTZ_API_KEY is bound from AGENT_SECRET
# when that GitHub secret is set (workflow_dispatch or a populated repo secret).
#
# Empty AGENT_SECRET is a warn + skip, not a job failure: Deploy Workers run
# 35485103050 went red after #1083 because this bind used ::error:: / exit 1
# on the default $0 path. Do not deploy authichain-agentz or enable Containers.
#
# Optional: WRANGLER_BIN (tests), AGENTZ_API_URL, WORKER_NAME.
# Never prints secret values.
set -euo pipefail

WORKER_NAME="${WORKER_NAME:-authichain-openclaw}"
AGENTZ_API_URL="${AGENTZ_API_URL:-https://agentz.authichain.com}"

put_secret() {
  local binding="$1"
  local value="$2"
  if [ -n "${WRANGLER_BIN:-}" ]; then
    printf '%s' "$value" | "$WRANGLER_BIN" secret put "$binding" --name "$WORKER_NAME"
  else
    printf '%s' "$value" | npx wrangler secret put "$binding" --name "$WORKER_NAME"
  fi
}

put_secret AGENTZ_API_URL "$AGENTZ_API_URL"

if [ -z "${AGENT_SECRET:-}" ]; then
  echo "::warning::GitHub secret AGENT_SECRET is empty — skipping AGENTZ_API_KEY bind on ${WORKER_NAME} (\$0 path). Worker still deploys. Set AGENT_SECRET to bind."
  exit 0
fi

put_secret AGENTZ_API_KEY "$AGENT_SECRET"
echo "bound AGENTZ_API_URL + AGENTZ_API_KEY on ${WORKER_NAME}"
