#!/bin/bash
# Deploy resend-relay v1.1 security fix
# Removes hardcoded API key from worker source code
# Requires: CLOUDFLARE_API_TOKEN environment variable
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
#   export RESEND_API_KEY="re_your_resend_key_here"
#   bash deploy.sh

set -euo pipefail

ACCOUNT_ID="4c1869b90f13f86940aa3747839bf420"
WORKER_NAME="resend-relay"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_FILE="$SCRIPT_DIR/index.js"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN environment variable is required."
  echo "Get one at: https://dash.cloudflare.com/profile/api-tokens"
  echo "Required permissions: Workers Scripts:Edit"
  exit 1
fi

echo "=== Deploying $WORKER_NAME v1.1 (security fix) ==="
echo "Account: $ACCOUNT_ID"
echo "Source:  $WORKER_FILE"
echo ""

# Step 1: Deploy the worker code
echo "[1/2] Uploading worker code..."
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

# Step 2: Set the RESEND_API_KEY secret
echo "[2/2] Setting RESEND_API_KEY secret..."
if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "  ERROR: RESEND_API_KEY environment variable is required."
  echo "  export RESEND_API_KEY='re_...' and rerun this script."
  exit 1
fi
SECRET_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME/secrets" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"RESEND_API_KEY\",\"text\":\"$RESEND_API_KEY\",\"type\":\"secret_text\"}")

HTTP_CODE=$(echo "$SECRET_RESPONSE" | tail -1)
BODY=$(echo "$SECRET_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "  Secret RESEND_API_KEY set successfully (HTTP $HTTP_CODE)"
else
  echo "  FAILED to set secret (HTTP $HTTP_CODE)"
  echo "  Response: $BODY"
  echo ""
  echo "  You may need to set the secret manually:"
  echo "  npx wrangler secret put RESEND_API_KEY --name resend-relay"
  exit 1
fi

echo ""
echo "=== Deployment complete ==="
echo "Worker: $WORKER_NAME v1.1"
echo "Security fix: Hardcoded API key removed from source code"
echo "API key is now stored as an encrypted secret binding"
echo ""
echo "Verify: curl https://resend-relay.<your-subdomain>.workers.dev/health"
