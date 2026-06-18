#!/usr/bin/env bash
# push-secrets-to-cloudflare.sh
# Reads .env (gitignored) and sets wrangler secrets on core CF Workers.
# Run from repo root on your LOCAL machine after `wrangler login`.
#
# Usage:
#   bash scripts/push-secrets-to-cloudflare.sh
#   # or with explicit token:
#   CLOUDFLARE_API_TOKEN=your_token bash scripts/push-secrets-to-cloudflare.sh

set -euo pipefail

# Force wrangler non-interactive so it never blocks on onboarding prompts
# (e.g. "install Cloudflare skills? [Y/n]") when piping secrets in a loop.
export CI="${CI:-true}"
export WRANGLER_SEND_METRICS="${WRANGLER_SEND_METRICS:-false}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi

export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

# Workers that need the full secret set applied
CORE_WORKERS=(
  "authichain-unified"
  "authichain-api-gateway"
  "authichain-com"
  "authichain-api"
  "authichain-automation"
  "authichain-outreach-engine"
  "qron-automation"
  "qron-outreach"
  "qron-space"
  "govchain-us"
  "strainchain-io"
)

# Secrets relevant to CF Workers (subset of full .env)
WANTED_KEYS=(
  DATABASE_URL
  SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_SERVICE_KEY
  JWT_SECRET
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
  RESEND_API_KEY RESEND_FROM_EMAIL
  GROQ_API_KEY HF_TOKEN HF_API_KEY FAL_KEY OPENAI_API_KEY HEYGEN_API_KEY
  PINECONE_API_KEY PINECONE_INDEX
  TELEGRAM_BOT_TOKEN TELEGRAM_BOT_TOKEN_AUTHICHAIN TELEGRAM_BOT_TOKEN_QRON
  SLACK_SIGNING_SECRET SLACK_BOT_TOKEN
  CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN
  GITHUB_PAT GITHUB_TOKEN
  HUBSPOT_ACCESS_TOKEN HUBSPOT_SERVICE_KEY
  WALLET_PRIVATE_KEY BLOCKCHAIN_PRIVATE_KEY
  INTERNAL_API_SECRET QRON_AUTHICHAIN_KEY CRON_SECRET ADMIN_SECRET
  AUTONOMOUS_PIPELINE_ENABLED
  ETHERSCAN_API_KEY_QRON ETHERSCAN_API_KEY_AUTHICHAIN_NFT ETHERSCAN_API_KEY_STRAINCHAIN
)

# Parse .env into an associative array
declare -A VARS
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    k="${BASH_REMATCH[1]}" ; v="${BASH_REMATCH[2]}"
    v="${v%\"}" ; v="${v#\"}" ; v="${v%\'}" ; v="${v#\'}"
    VARS["$k"]="$v"
  fi
done < "$ENV_FILE"

ok=0; skip=0; fail=0

push_secret() {
  local worker="$1" key="$2" value="$3"
  if [[ -z "$value" ]]; then
    echo "  SKIP  $worker/$key"
    ((skip++)) || true ; return
  fi
  echo "$value" | npx wrangler secret put "$key" --name "$worker" 2>&1 | tail -1
  if [[ "${PIPESTATUS[1]}" -eq 0 ]]; then
    ((ok++)) || true
  else
    ((fail++)) || true
  fi
}

for worker in "${CORE_WORKERS[@]}"; do
  echo ""
  echo "=== $worker ==="
  for key in "${WANTED_KEYS[@]}"; do
    val="${VARS[$key]:-}"
    push_secret "$worker" "$key" "$val"
  done
done

echo ""
echo "Done — ok: $ok | skipped: $skip | failed: $fail"
