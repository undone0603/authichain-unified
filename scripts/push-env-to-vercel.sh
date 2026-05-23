#!/usr/bin/env bash
# push-env-to-vercel.sh
# Reads .env (gitignored), reads existing vars from every Vercel project via
# REST API, then upserts the correct keys to each project — no secrets hardcoded.
#
# Usage (run from repo root on your LOCAL machine after getting a Vercel token):
#   VERCEL_TOKEN=your_token bash scripts/push-env-to-vercel.sh
#
# Optional flags:
#   DRY_RUN=1   — print what would be changed without writing anything
#   PROJECT=foo — only sync the named project(s), comma-separated
#
# Get your token: https://vercel.com/account/tokens

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

TOKEN="${VERCEL_TOKEN:?Set VERCEL_TOKEN before running this script}"
TEAM_ID="team_PKVRDwUXPRFjmGTM7PZxjNys"
TARGETS='["production","preview","development"]'
DRY_RUN="${DRY_RUN:-0}"
FILTER_PROJECT="${PROJECT:-}"

# ── All 12 Vercel projects in the team ────────────────────────────────────────
declare -A PROJECTS
PROJECTS["authichain-unified"]="prj_3Z9CJRm11nYJBLEKItzD8JsOnYRd"
PROJECTS["authichain-unified-v2"]="prj_mIb6SSMtMy8KsXg9gNta0T3tDJg1"
PROJECTS["authichain-unified-main"]="prj_bYTeYZE6iBivOzYUaxk1tLMOLekF"
PROJECTS["undone0603-authichain-unified"]="prj_iWs8LAXzyafrbelPzMMqBI02EXpx"
PROJECTS["authichain-protocol"]="prj_mQDfwxFpYAcTL3A4XzRr2NDoJ2r4"
PROJECTS["authichain_premium"]="prj_IP1D5v1RVulGDGeCVC09xIB8zbv6"
PROJECTS["qron-app"]="prj_gCvAevUEjivd6mPNmsqJf7AF3T9v"
PROJECTS["qron-platform"]="prj_GD9ypyGrjibx4Ab88M52xufUf1ph"
PROJECTS["govchain-us"]="prj_QCWzOFZD7JFYWUiLqDnYaowBzf99"
PROJECTS["strainchain-io"]="prj_m9IlpGXSUAPbSiDkyi6Btyyj7NQq"
PROJECTS["strainchain-site"]="prj_O1bk0UIcMPHRItFyOgakAi8dksVg"
PROJECTS["deploy"]="prj_MF6640KaRzE0Hv2LBnnlHswFdmzv"

# ── Core vars pushed to every project ─────────────────────────────────────────
CORE_KEYS=(
  NEXT_PUBLIC_SUPABASE_URL SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_ANON_KEY
  SUPABASE_PROJECT_REF
  DATABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_SERVICE_KEY
  JWT_SECRET
  RESEND_API_KEY RESEND_FROM_EMAIL
  GROQ_API_KEY
  HF_TOKEN HF_API_KEY HUGGINGFACE_API_KEY HUGGINGFACE_WRITE_KEY HF_ROUTER_BASE
  PINECONE_API_KEY PINECONE_INDEX PINECONE_HOST
  GOOGLE_GEMINI_API_KEY GEMINI_API_KEY
  OPENAI_API_KEY
  CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_ZONE_ID_AUTHICHAIN CLOUDFLARE_ZONE_ID_QRON
  CLOUDFLARE_D1_DB_ID CLOUDFLARE_KV_NAMESPACE_ID
  INTERNAL_API_SECRET CRON_SECRET ADMIN_SECRET
  AUTONOMOUS_PIPELINE_ENABLED REQUIRE_OUTREACH_APPROVAL REQUIRE_DEV_APPROVAL
  GITHUB_PAT GITHUB_OWNER GITHUB_REPO
  HUBSPOT_OWNER_ID HUBSPOT_PORTAL_ID HUBSPOT_ACCESS_TOKEN HUBSPOT_SERVICE_KEY
  DOCUSIGN_ACCOUNT_ID DOCUSIGN_BASE_URI
  TELEGRAM_BOT_TOKEN TELEGRAM_BOT_TOKEN_AUTHICHAIN TELEGRAM_GROUP_ID
  SLACK_APP_ID SLACK_CLIENT_ID SLACK_CLIENT_SECRET SLACK_SIGNING_SECRET
  SLACK_VERIFICATION_TOKEN SLACK_BOT_TOKEN
  LOOM_API_KEY
  AIRTABLE_TABLE_ID
  POLYGON_RPC_URL
  NFT_DEPLOYER_WALLET DEFAULT_NFT_CONTRACT
  VITE_THIRDWEB_CLIENT_ID VITE_AUTHICHAIN_CONTRACT_ADDRESS
  STRIPE_ACCOUNT_ID STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_STARTER STRIPE_PRICE_PRO
  VERCEL_TEAM_ID VERCEL_ORG_ID
)

# ── Qron-specific extras ───────────────────────────────────────────────────────
QRON_EXTRA_KEYS=(
  STRIPE_WEBHOOK_SECRET_QRON
  STRIPE_WEBHOOK_SECRET_SUPABASE
  TELEGRAM_BOT_TOKEN_QRON
  QRON_ERC20_ADDRESS QRON_AUTHICHAIN_KEY
  ETHERSCAN_API_KEY_QRON
  VERCEL_PROJECT_ID_QRON
  FAL_KEY
)

# ── GovChain-specific extras ───────────────────────────────────────────────────
GOV_EXTRA_KEYS=(
  ETHERSCAN_API_KEY_AUTHICHAIN_NFT
  PINECONE_API_KEY PINECONE_INDEX PINECONE_HOST
)

# ── Strainchain-specific extras ────────────────────────────────────────────────
STRAIN_EXTRA_KEYS=(
  ETHERSCAN_API_KEY_STRAINCHAIN
  TELEGRAM_BOT_TOKEN_QRON
)

# ── Per-project key overrides: KEY=SOURCE_KEY (value remapped from .env) ───────
# Format: "PROJECT_NAME:DEST_KEY:SRC_KEY"
OVERRIDES=(
  "qron-app:STRIPE_WEBHOOK_SECRET:STRIPE_WEBHOOK_SECRET_QRON"
  "qron-platform:STRIPE_WEBHOOK_SECRET:STRIPE_WEBHOOK_SECRET_QRON"
)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi

# ── Parse .env ─────────────────────────────────────────────────────────────────
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
echo "Parsed ${#VARS[@]} variables from $ENV_FILE"

# ── Fetch existing env var IDs from a project ──────────────────────────────────
declare -A EXISTING_IDS   # KEY -> envId, scoped per project call

fetch_existing() {
  local project_id="$1"
  unset EXISTING_IDS ; declare -gA EXISTING_IDS
  local response
  response=$(curl -sf \
    "https://api.vercel.com/v10/projects/${project_id}/env?teamId=${TEAM_ID}&limit=200" \
    -H "Authorization: Bearer ${TOKEN}" 2>/dev/null) || { echo "  WARN  could not fetch existing env"; return; }
  while IFS= read -r entry; do
    local ekey eid
    ekey=$(printf '%s' "$entry" | grep -o '"key":"[^"]*"' | head -1 | cut -d'"' -f4)
    eid=$(printf '%s' "$entry"  | grep -o '"id":"[^"]*"'  | head -1 | cut -d'"' -f4)
    [[ -n "$ekey" && -n "$eid" ]] && EXISTING_IDS["$ekey"]="$eid"
  done < <(printf '%s' "$response" | grep -o '{[^}]*}')
}

added=0; updated=0; skipped=0; failed=0

upsert() {
  local project_id="$1" key="$2" value="$3"
  if [[ -z "$value" ]]; then
    ((skipped++)) || true; return
  fi

  local escaped_value="${value//\\/\\\\}"
  escaped_value="${escaped_value//\"/\\\"}"
  local payload
  payload=$(printf '{"key":"%s","value":"%s","type":"encrypted","target":%s}' \
    "$key" "$escaped_value" "$TARGETS")

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  DRY   $key"
    ((added++)) || true; return
  fi

  local code env_id="${EXISTING_IDS[$key]:-}"

  if [[ -n "$env_id" ]]; then
    # PATCH to update existing entry by ID
    code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PATCH "https://api.vercel.com/v10/projects/${project_id}/env/${env_id}?teamId=${TEAM_ID}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" -d "$payload")
    if [[ "$code" == "2"* ]]; then
      echo "  UPD   $key"
      ((updated++)) || true; return
    fi
  fi

  # POST to create new
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://api.vercel.com/v10/projects/${project_id}/env?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" -d "$payload")

  if [[ "$code" == "2"* ]]; then
    echo "  ADD   $key"
    ((added++)) || true
  else
    echo "  FAIL  $key (HTTP $code)"
    ((failed++)) || true
  fi
}

push_keys() {
  local project_id="$1"
  shift
  local keys=("$@")
  for key in "${keys[@]}"; do
    upsert "$project_id" "$key" "${VARS[$key]:-}"
  done
}

apply_overrides() {
  local project_name="$1" project_id="$2"
  for override in "${OVERRIDES[@]}"; do
    IFS=':' read -r pname dest_key src_key <<< "$override"
    if [[ "$pname" == "$project_name" ]]; then
      upsert "$project_id" "$dest_key" "${VARS[$src_key]:-}"
    fi
  done
}

# ── Main loop ──────────────────────────────────────────────────────────────────
for project_name in "${!PROJECTS[@]}"; do
  # Apply project filter if set
  if [[ -n "$FILTER_PROJECT" ]]; then
    local_match=0
    IFS=',' read -ra filters <<< "$FILTER_PROJECT"
    for f in "${filters[@]}"; do
      [[ "$project_name" == "$f" ]] && local_match=1
    done
    [[ "$local_match" -eq 0 ]] && continue
  fi

  project_id="${PROJECTS[$project_name]}"
  echo ""
  echo "=== $project_name ($project_id) ==="

  fetch_existing "$project_id"
  echo "  Found ${#EXISTING_IDS[@]} existing env var(s)"

  push_keys "$project_id" "${CORE_KEYS[@]}"

  case "$project_name" in
    qron-app|qron-platform)
      push_keys "$project_id" "${QRON_EXTRA_KEYS[@]}"
      ;;
    govchain-us)
      push_keys "$project_id" "${GOV_EXTRA_KEYS[@]}"
      ;;
    strainchain-io|strainchain-site)
      push_keys "$project_id" "${STRAIN_EXTRA_KEYS[@]}"
      ;;
  esac

  apply_overrides "$project_name" "$project_id"
done

echo ""
echo "Done — added: $added | updated: $updated | skipped (empty): $skipped | failed: $failed"
echo ""
echo "Keys still needing manual entry (not in .env):"
echo "  DATABASE_URL               — Supabase > Project Settings > Database > Session Pooler"
echo "  SUPABASE_SERVICE_ROLE_KEY  — Supabase > Project Settings > API"
echo "  OPENAI_API_KEY             — platform.openai.com (needs billing top-up)"
echo "  HUBSPOT_ACCESS_TOKEN       — HubSpot > Settings > Private Apps"
echo "  WALLET_PRIVATE_KEY         — local machine / 1Password only"
echo "  CLOUDFLARE_API_TOKEN       — dash.cloudflare.com/profile/api-tokens"
echo "  SLACK_BOT_TOKEN            — install app A0AQZ8HCCRG to workspace first"
