#!/bin/bash
# Deploy authichain-dashboard cookie-auth rewrite.
# Removes hardcoded '***REMOVED***' password from query parameters.
# Replaces with env.ACCESS_TOKEN secret + cookie-based session.
#
# Requires wrangler (since the dashboard is a TypeScript module worker
# that needs a TS build step — the HTTP API approach used for the JS
# workers won't compile it).
#
# Usage:
#   export ACCESS_TOKEN="<strong-random-string>"
#   bash deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -z "${ACCESS_TOKEN:-}" ]; then
  echo "ERROR: ACCESS_TOKEN environment variable is required."
  echo "Generate a strong one with:  openssl rand -hex 32"
  exit 1
fi

echo "=== Deploying authichain-dashboard (cookie-auth security fix) ==="
echo ""

# Step 1: set the secret (independent of code — safe to do first)
echo "[1/2] Setting ACCESS_TOKEN secret..."
printf '%s' "$ACCESS_TOKEN" | npx wrangler secret put ACCESS_TOKEN

# Step 2: deploy the TS worker
echo "[2/2] Deploying worker code..."
npx wrangler deploy

echo ""
echo "=== Deployment complete ==="
echo "Dashboard auth is now cookie-based. Password no longer appears in URLs."
echo ""
echo "Log in at: https://authichain-dashboard.<subdomain>.workers.dev/"
echo "Submit the access key via the login form (POST /login)."
echo "Cookie lifetime: 8 hours. Sign-out link in the top-right."
