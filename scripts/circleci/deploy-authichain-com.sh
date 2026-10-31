#!/usr/bin/env bash
# First CircleCI deploy: authichain-com only. A failure or rollback must not
# redeploy the rest of the workers matrix. GitHub Actions still deploys that
# matrix. Secret rebinding for this worker stays on GitHub Actions.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

if [ -n "${COMPONENT_NAME:-}" ] && [ "${COMPONENT_NAME}" != "authichain-com" ]; then
  echo "Refusing component ${COMPONENT_NAME}. This pipeline deploys authichain-com only."
  exit 1
fi
if [ -n "${ENVIRONMENT_NAME:-}" ] && [ "${ENVIRONMENT_NAME}" != "production" ]; then
  echo "Refusing environment ${ENVIRONMENT_NAME}. This pipeline deploys production only."
  exit 1
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set on the CircleCI project or context."
  exit 1
fi

export COMPATIBILITY_DATE="${COMPATIBILITY_DATE:-2026-06-29}"

corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install --no-frozen-lockfile --config.minimumReleaseAge=0

worker="authichain-com"
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
