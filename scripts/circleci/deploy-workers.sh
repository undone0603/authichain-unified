#!/usr/bin/env bash
# Deploy the same workers as .github/workflows/deploy-workers.yml on a push to
# main. authichain-agentz stays out: it uses Cloudflare Containers and is
# opt-in there so a deploy never enables Workers Paid.
# Keep this list aligned with that workflow's default matrix.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set on the CircleCI project or context."
  exit 1
fi

export COMPATIBILITY_DATE="${COMPATIBILITY_DATE:-2026-06-29}"

corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install --no-frozen-lockfile --config.minimumReleaseAge=0

workers=(
  authichain-api
  authichain-api-gateway
  authichain-automation
  authichain-com
  authichain-dashboard
  qron-automation
  qron-image-gen
  qron-outreach
  qron-space
  resend-relay
  strainchain-io
  govchain-us
  bitcoin-auth
  outreach-queue
  ai-classification
  analytics
  auth
  authichain-autopilot
  authichain-chain-data
  authichain-gateway
  authichain-license-issuer
  authichain-qron-provenance
  authichain-scan-validate
  authichain-telegram
  authichain-verify-worker
  stripe-webhook
  authichain-openclaw
  authichain-infra
  authichain-outreach-engine
  blockchain
  chipchain-io
  dpp-fulfillment
  fanchain-io
  glowchain-io
  gs1-resolver
  harvestchain-io
  luxechain-io
  partchain-io
  provenchain-io
  rxchain-io
  threadchain-io
  watchchain-io
  qfs-adapter
  authichain-bridge
)

for worker in "${workers[@]}"; do
  dir="workers/${worker}"
  if [ ! -d "$dir" ]; then
    echo "missing worker directory: $dir"
    exit 1
  fi
  config=""
  for candidate in wrangler.jsonc wrangler.json wrangler.toml; do
    if [ -f "${dir}/${candidate}" ]; then
      config="$candidate"
      break
    fi
  done
  if [ -z "$config" ]; then
    echo "no wrangler config in $dir"
    exit 1
  fi
  echo "deploy ${worker} (${config})"
  (
    cd "$dir"
    npx wrangler deploy --minify --config "$config"
  )
done
