#!/bin/bash
# Deploy authichain-api v3.0.1 security fix
# Removes hardcoded Supabase anon JWT from worker source.
# Order: set secret FIRST, then upload code, so the running worker never
# returns 500 because the deploy raced ahead of the secret binding.
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
#   export SUPABASE_ANON_KEY="eyJ..."
#   bash deploy.sh

set -euo pipefail

ACCOUNT_ID="4c1869b90f13f86940aa3747839bf420"
WORKER_NAME="authichain-api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_FILE="$SCRIPT_DIR/index.js"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN environment variable is required."
  echo "Get one at: https://dash.cloudflare.com/profile/api-tokens"
  echo "Required permissions: Workers Scripts:Edit"
  exit 1
fi

if [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: SUPABASE_ANON_KEY environment variable is required."
  exit 1
fi

echo "=== Deploying $WORKER_NAME v3.0.1 (security fix) ==="
echo "Account: $ACCOUNT_ID"
echo "Source:  $WORKER_FILE"
echo ""

echo "[1/2] Setting SUPABASE_ANON_KEY secret..."
SECRET_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME/secrets" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SUPABASE_ANON_KEY\",\"text\":\"$SUPABASE_ANON_KEY\",\"type\":\"secret_text\"}")

HTTP_CODE=$(echo "$SECRET_RESPONSE" | tail -1)
BODY=$(echo "$SECRET_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "  Secret SUPABASE_ANON_KEY set (HTTP $HTTP_CODE)"
else
  echo "  FAILED to set secret (HTTP $HTTP_CODE)"
  echo "  Response: $BODY"
  exit 1
fi

echo "[2/2] Uploading worker code..."
DEPLOY_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/javascript" \
  --data-binary @"$WORKER_FILE")

HTTP_CODE=$(echo "$DEPLOY_RESPONSE" | tail -1)
BODY=$(echo "$DEPLOY_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "  Worker code deployed (HTTP $HTTP_CODE)"
else
  echo "  FAILED to deploy worker (HTTP $HTTP_CODE)"
  echo "  Response: $BODY"
  exit 1
fi

echo ""
echo "=== Deployment complete ==="
echo "Worker: $WORKER_NAME v3.0.1"
echo "Security fix: Hardcoded Supabase anon JWT removed from source"
echo ""
echo "Verify: curl https://authichain-api.<subdomain>.workers.dev/health"
echo "        Expect 'status: ok' and 'secrets_configured: true'"
