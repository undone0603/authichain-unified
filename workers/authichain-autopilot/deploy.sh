#!/bin/bash
# Deploy authichain-autopilot v1.1 security fix
# Removes hardcoded Resend API key + Supabase anon key from worker source.
# Order: set secrets FIRST, then upload code. This prevents a window where
# the running worker has the new code but no secrets.
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
#   export RESEND_API_KEY="re_..."
#   export SUPABASE_ANON_KEY="eyJ..."
#   bash deploy.sh

set -euo pipefail

ACCOUNT_ID="4c1869b90f13f86940aa3747839bf420"
WORKER_NAME="authichain-autopilot"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_FILE="$SCRIPT_DIR/index.js"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN environment variable is required."
  echo "Get one at: https://dash.cloudflare.com/profile/api-tokens"
  echo "Required permissions: Workers Scripts:Edit"
  exit 1
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "ERROR: RESEND_API_KEY environment variable is required."
  exit 1
fi

if [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: SUPABASE_ANON_KEY environment variable is required."
  exit 1
fi

put_secret() {
  local name="$1"
  local value="$2"
  local response
  local http_code
  local body
  response=$(curl -s -w "\n%{http_code}" \
    -X PUT \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME/secrets" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"text\":\"$value\",\"type\":\"secret_text\"}")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo "  Secret $name set (HTTP $http_code)"
  else
    echo "  FAILED to set $name (HTTP $http_code)"
    echo "  Response: $body"
    exit 1
  fi
}

echo "=== Deploying $WORKER_NAME v1.1 (security fix) ==="
echo "Account: $ACCOUNT_ID"
echo "Source:  $WORKER_FILE"
echo ""

echo "[1/3] Setting SUPABASE_ANON_KEY secret..."
put_secret SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"

echo "[2/3] Setting RESEND_API_KEY secret..."
put_secret RESEND_API_KEY "$RESEND_API_KEY"

echo "[3/3] Uploading worker code..."
DEPLOY_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/javascript" \
  --data-binary @"$WORKER_FILE")

HTTP_CODE=$(echo "$DEPLOY_RESPONSE" | tail -1)
BODY=$(echo "$DEPLOY_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "  Worker code deployed successfully (HTTP $HTTP_CODE)"
else
  echo "  FAILED to deploy worker (HTTP $HTTP_CODE)"
  echo "  Response: $BODY"
  exit 1
fi

echo ""
echo "=== Deployment complete ==="
echo "Worker: $WORKER_NAME v1.1"
echo "Security fix: Hardcoded Resend + Supabase keys removed from source"
echo ""
echo "Verify: curl https://authichain-autopilot.<subdomain>.workers.dev/health"
echo "        Expect 'status: ok' and 'secrets_configured: true'"
echo ""
echo "REMINDER: The removed Resend key is the SAME key used by resend-relay."
echo "If you rotate it, update BOTH workers:"
echo "  wrangler secret put RESEND_API_KEY --name resend-relay"
echo "  wrangler secret put RESEND_API_KEY --name authichain-autopilot"
