#!/usr/bin/env bash
# push-secrets-to-cloudflare.sh
# Reads .env (gitignored) or environment variables and sets Wrangler secrets
# on core CF Workers. Environment variables take precedence.
# Run from repo root on your LOCAL machine after `wrangler login`.
#
# Usage:
#   bash scripts/push-secrets-to-cloudflare.sh
#   AGENTZ_WEBHOOK_SECRET=... STRIPE_WEBHOOK_AUTHICHAIN_SECRET=... \
#     bash scripts/push-secrets-to-cloudflare.sh
#   # or use CLOUDFLARE_API_TOKEN for Wrangler authentication:
#   CLOUDFLARE_API_TOKEN=... bash scripts/push-secrets-to-cloudflare.sh
#   ENV_FILE=/secure/edge-secrets.env \
#     bash scripts/push-secrets-to-cloudflare.sh --edge-webhooks-only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_WEBHOOKS_ONLY=0
if [[ "${1:-}" == "--edge-webhooks-only" && "$#" -eq 1 ]]; then
  EDGE_WEBHOOKS_ONLY=1
elif [[ "$#" -ne 0 ]]; then
  echo "ERROR: unsupported arguments."
  exit 2
fi

if (( EDGE_WEBHOOKS_ONLY )); then
  if [[ -z "${ENV_FILE:-}" ]]; then
    echo "ERROR: set ENV_FILE to a dedicated edge-secret file."
    exit 1
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: dedicated edge-secret file not found."
    exit 1
  fi
  file_mode="$(stat -c '%a' -- "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")"
  if (( (8#$file_mode & 077) != 0 )); then
    echo "ERROR: dedicated edge-secret file must not be accessible by group or others; run chmod 600 on it."
    exit 1
  fi
else
  ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
fi

# Workers that need the full secret set applied.
# Live Stripe Dashboard → https://authichain.com/api/stripe/webhook is
# authichain-edge-router (not authichain-unified).
CORE_WORKERS=(
  "authichain-edge-router"
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
  GITHUB_PAT GITHUB_TOKEN
  HUBSPOT_ACCESS_TOKEN HUBSPOT_SERVICE_KEY
  WALLET_PRIVATE_KEY BLOCKCHAIN_PRIVATE_KEY
  INTERNAL_API_SECRET QRON_AUTHICHAIN_KEY CRON_SECRET ADMIN_SECRET
  AUTONOMOUS_PIPELINE_ENABLED
  ETHERSCAN_API_KEY_QRON ETHERSCAN_API_KEY_AUTHICHAIN_NFT ETHERSCAN_API_KEY_STRAINCHAIN
)

EDGE_ONLY_KEYS=(
  AGENTZ_WEBHOOK_SECRET
  STRIPE_WEBHOOK_AUTHICHAIN_SECRET
)

# Parse .env without sourcing it; never print secret values.
declare -A VARS
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      k="${BASH_REMATCH[1]}" ; v="${BASH_REMATCH[2]}"
      if (( EDGE_WEBHOOKS_ONLY )) &&
        [[ "$k" != "AGENTZ_WEBHOOK_SECRET" &&
          "$k" != "STRIPE_WEBHOOK_AUTHICHAIN_SECRET" &&
          "$k" != "CLOUDFLARE_API_TOKEN" ]]; then
        echo "ERROR: dedicated edge-secret file contains an unapproved variable name."
        exit 1
      fi
      if [[ -n "${VARS[$k]+present}" ]]; then
        echo "ERROR: secret file contains a duplicate variable name."
        exit 1
      fi
      v="${v%\"}" ; v="${v#\"}" ; v="${v%\'}" ; v="${v#\'}"
      VARS["$k"]="$v"
    elif (( EDGE_WEBHOOKS_ONLY )); then
      echo "ERROR: dedicated edge-secret file contains an unrecognized line."
      exit 1
    fi
  done < "$ENV_FILE"
fi

get_value() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    printf '%s' "${!key}"
  else
    printf '%s' "${VARS[$key]:-}"
  fi
}

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -n "${VARS[CLOUDFLARE_API_TOKEN]:-}" ]]; then
  export CLOUDFLARE_API_TOKEN="${VARS[CLOUDFLARE_API_TOKEN]}"
fi

configured=0
CHECK_KEYS=("${WANTED_KEYS[@]}" "${EDGE_ONLY_KEYS[@]}")
if (( EDGE_WEBHOOKS_ONLY )); then
  CHECK_KEYS=("${EDGE_ONLY_KEYS[@]}")
fi
for key in "${CHECK_KEYS[@]}"; do
  if [[ -n "$(get_value "$key")" ]]; then
    configured=1
    break
  fi
done
if (( configured == 0 )); then
  echo "ERROR: no Worker secrets found in the environment or $ENV_FILE."
  exit 1
fi

if (( EDGE_WEBHOOKS_ONLY )); then
  for key in "${EDGE_ONLY_KEYS[@]}"; do
    if [[ -z "${VARS[$key]:-}" ]]; then
      echo "ERROR: dedicated edge-secret file must set both edge webhook secrets."
      exit 1
    fi
  done
fi

ok=0; skip=0; fail=0

push_secret() {
  local worker="$1" key="$2" value="$3"
  if [[ -z "$value" ]]; then
    echo "  SKIP  $worker/$key"
    ((skip++)) || true ; return
  fi
  # printf, not echo: echo appends a newline that breaks Stripe HMAC verify.
  printf '%s' "$value" | npx wrangler secret put "$key" --name "$worker" 2>&1 | tail -1
  if [[ "${PIPESTATUS[1]}" -eq 0 ]]; then
    ((ok++)) || true
  else
    ((fail++)) || true
  fi
}

if (( EDGE_WEBHOOKS_ONLY )); then
  echo "=== authichain-edge-router (edge webhook secrets only) ==="
  for key in "${EDGE_ONLY_KEYS[@]}"; do
    push_secret "authichain-edge-router" "$key" "${VARS[$key]}"
  done
else
  for worker in "${CORE_WORKERS[@]}"; do
    echo ""
    echo "=== $worker ==="
    for key in "${WANTED_KEYS[@]}"; do
      val="$(get_value "$key")"
      push_secret "$worker" "$key" "$val"
    done
  done

  echo ""
  echo "=== authichain-edge-router (edge-only) ==="
  for key in "${EDGE_ONLY_KEYS[@]}"; do
    val="$(get_value "$key")"
    push_secret "authichain-edge-router" "$key" "$val"
  done
fi

echo ""
echo "Done — ok: $ok | skipped: $skip | failed: $fail"
if (( fail > 0 )); then
  exit 1
fi
