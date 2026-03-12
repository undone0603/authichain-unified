#!/usr/bin/env bash
# Usage: bash scripts/set-gmail-secrets.sh <CLIENT_ID> <CLIENT_SECRET> [REFRESH_TOKEN]
set -e
CLIENT_ID="${1:?Usage: $0 <CLIENT_ID> <CLIENT_SECRET> [REFRESH_TOKEN]}"
CLIENT_SECRET="${2:?Usage: $0 <CLIENT_ID> <CLIENT_SECRET> [REFRESH_TOKEN]}"
REFRESH_TOKEN="${3:-}"

echo "Triggering GitHub Actions workflow to set Cloudflare Worker secrets..."
gh workflow run set-worker-secrets.yml \
  --repo undone0603/authichain-unified \
  --field "GMAIL_CLIENT_ID=${CLIENT_ID}" \
  --field "GMAIL_CLIENT_SECRET=${CLIENT_SECRET}" \
  --field "GMAIL_REFRESH_TOKEN=${REFRESH_TOKEN}"

echo ""
echo "Workflow dispatched. Check progress at:"
echo "  https://github.com/undone0603/authichain-unified/actions/workflows/set-worker-secrets.yml"
echo ""
if [ -z "$REFRESH_TOKEN" ]; then
  echo "Next: visit https://authichain.com/api/gmail/connect to get the refresh token."
  echo "Then re-run: bash scripts/set-gmail-secrets.sh CLIENT_ID CLIENT_SECRET <REFRESH_TOKEN>"
fi
