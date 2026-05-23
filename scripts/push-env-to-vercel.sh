#!/usr/bin/env bash
# push-env-to-vercel.sh
# Reads .env (gitignored) and upserts every non-empty variable to Vercel
# via the REST API — no secrets hardcoded in this file.
#
# Usage (run from repo root on your LOCAL machine):
#   VERCEL_TOKEN=your_token bash scripts/push-env-to-vercel.sh
#
# Get your token: https://vercel.com/account/tokens
# The .env file must exist in the repo root (it is gitignored).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

TOKEN="${VERCEL_TOKEN:?Set VERCEL_TOKEN before running this script}"
TEAM_ID="team_PKVRDwUXPRFjmGTM7PZxjNys"
TARGETS='["production","preview","development"]'

# Projects to update
declare -A PROJECTS
PROJECTS["authi-chain"]="prj_mw2itvdc2kRcPlCooSeUNozaPn5B"
PROJECTS["authichain-unified"]="prj_3Z9CJRm11nYJBLEKItzD8JsOnYRd"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Run from the repo root after compiling .env."
  exit 1
fi

added=0; skipped=0; failed=0

upsert() {
  local project_id="$1" key="$2" value="$3"
  if [[ -z "$value" ]]; then
    ((skipped++)) || true; return
  fi

  local payload
  payload=$(printf '{"key":"%s","value":"%s","type":"encrypted","target":%s}' \
    "$key" "${value//\"/\\\"}" "$TARGETS")

  # PATCH existing, then POST if 404
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH "https://api.vercel.com/v10/projects/${project_id}/env?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" -d "$payload")

  if [[ "$code" == "4"* ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "https://api.vercel.com/v10/projects/${project_id}/env?teamId=${TEAM_ID}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" -d "$payload")
  fi

  if [[ "$code" == "2"* ]]; then
    echo "  OK    $key"
    ((added++)) || true
  else
    echo "  FAIL  $key (HTTP $code)"
    ((failed++)) || true
  fi
}

echo "Parsing $ENV_FILE ..."

declare -A VARS
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and blank lines (including lines with ← TODO)
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue
  # Match KEY=VALUE (value may be quoted or unquoted)
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    # Strip surrounding quotes
    val="${val%\"}" ; val="${val#\"}"
    val="${val%\'}" ; val="${val#\'}"
    VARS["$key"]="$val"
  fi
done < "$ENV_FILE"

echo "Found ${#VARS[@]} variables."

for project_name in "${!PROJECTS[@]}"; do
  project_id="${PROJECTS[$project_name]}"
  echo ""
  echo "=== $project_name ($project_id) ==="
  for key in "${!VARS[@]}"; do
    upsert "$project_id" "$key" "${VARS[$key]}"
  done
done

echo ""
echo "Done — added/updated: $added | skipped (empty): $skipped | failed: $failed"
echo ""
echo "Still need manual entry in Vercel dashboard:"
echo "  SUPABASE_SERVICE_ROLE_KEY  — Supabase > Project Settings > API"
echo "  DATABASE_URL               — Supabase > Project Settings > Database > Session Pooler"
echo "  OPENAI_API_KEY             — platform.openai.com"
echo "  HUBSPOT_ACCESS_TOKEN       — HubSpot > Settings > Private Apps"
echo "  WALLET_PRIVATE_KEY         — local machine only"
echo "  CLOUDFLARE_API_TOKEN       — dash.cloudflare.com/profile/api-tokens"
echo "  SLACK_BOT_TOKEN            — install app at api.slack.com/apps/A0AQZ8HCCRG"
