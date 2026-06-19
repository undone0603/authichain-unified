#!/usr/bin/env bash
# Pull ALL production env vars from Vercel into local .env
# Run once: bash scripts/pull-env.sh
set -e

TEAM_ID="team_PKVRDwUXPRFjmGTM7PZxjNys"
PROJECT="undone0603-authichain-unified"

echo "Pulling env vars from Vercel project: $PROJECT"

# vercel env pull merges into .env (production environment).
# Use npx so it works without a global `vercel` install (Codespaces has none).
npx --yes vercel env pull .env \
  --environment=production \
  --token "$VERCEL_TOKEN" \
  --scope "$TEAM_ID" \
  --yes 2>/dev/null || \
npx --yes vercel env pull .env --yes

echo "Done. .env updated with production credentials."
echo ""
echo "Keys still needed manually (not in Vercel):"
echo "  APOLLO_API_KEY       — apollo.io dashboard"
echo "  GMAIL_OAUTH_REFRESH_TOKEN — run: bash scripts/set-gmail-secrets.sh"
echo "  POLYGON_PRIVATE_KEY  — wallet keystore"
