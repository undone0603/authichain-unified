#!/usr/bin/env bash
# Sync .env.local → GitHub Actions secrets for undone0603/authichain-unified
# Run: pnpm sync-secrets
# Only syncs keys that exist in .env.local (skips TODO_PASTE values).

set -euo pipefail
REPO="undone0603/authichain-unified"
ENV_FILE="$(dirname "$0")/../.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌  .env.local not found at $ENV_FILE"
  exit 1
fi

sync_key() {
  local env_key="$1"   # key name in .env.local
  local secret_name="$2"  # GitHub secret name (defaults to env_key)
  secret_name="${secret_name:-$env_key}"

  # Last value wins (handles duplicate lines in .env.local)
  local value
  value=$(grep -E "^${env_key}=" "$ENV_FILE" | tail -1 | cut -d= -f2-)

  if [ -z "$value" ] || [[ "$value" == TODO_PASTE* ]]; then
    echo "  ⚠️  skipped $secret_name (empty or TODO_PASTE)"
    return
  fi

  gh secret set "$secret_name" --repo "$REPO" --body "$value"
  echo "  ✅ $secret_name"
}

echo "🔄 Syncing secrets to $REPO..."

# LLM providers
sync_key OPENAI_API_KEY
sync_key GROQ_API_KEY
sync_key GEMINI_API_KEY
sync_key ANTHROPIC_API_KEY

# Infrastructure
sync_key SUPABASE_URL
sync_key SUPABASE_SERVICE_ROLE_KEY  SUPABASE_SERVICE_KEY
sync_key DATABASE_URL

# APIs
sync_key SAM_GOV_API_KEY             SAM_API_KEY
sync_key HUBSPOT_TOKEN               HUBSPOT_ACCESS_TOKEN
sync_key RESEND_API_KEY
sync_key STRIPE_SECRET_KEY
sync_key AIRTABLE_API_KEY
sync_key AIRTABLE_BASE_ID

# Cloudflare
sync_key CLOUDFLARE_API_TOKEN
sync_key CLOUDFLARE_ACCOUNT_ID

# Vercel
sync_key VERCEL_TOKEN
sync_key VERCEL_TEAM_ID              VERCEL_ORG_ID

# Misc
sync_key SLACK_SIGNING_SECRET        SLACK_BOT_TOKEN
sync_key PINECONE_API_KEY
sync_key HF_TOKEN_PRIMARY            HUGGINGFACE_API_KEY
sync_key INTERNAL_API_SECRET
sync_key AGENTZ_WEBHOOK_SECRET

echo ""
echo "Done. Run 'gh secret list --repo $REPO' to verify."
