#!/usr/bin/env bash
# Pre-launch infrastructure setup script
# Generated 2026-05-22 — run once after authenticating wrangler + vercel CLI
# Usage: bash scripts/complete-setup.sh
set -euo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BOLD}→${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

echo -e "\n${BOLD}AuthiChain pre-launch setup${NC}\n"

# ── Prerequisites ──────────────────────────────────────────────────────────────
if ! command -v wrangler &>/dev/null; then echo -e "${RED}✗ wrangler not found — run: pnpm install${NC}"; exit 1; fi
if ! command -v vercel  &>/dev/null; then echo -e "${RED}✗ vercel CLI not found — run: npm i -g vercel${NC}"; exit 1; fi
wrangler whoami &>/dev/null || { echo -e "${RED}✗ wrangler not authenticated — run: wrangler login${NC}"; exit 1; }
vercel whoami  &>/dev/null || { echo -e "${RED}✗ vercel not authenticated  — run: vercel login${NC}";  exit 1; }

# ── Values already resolved by AgentZ ──────────────────────────────────────────
SUPABASE_URL="https://nhdnkzhtadfkkluiulhs.supabase.co"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Set NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment}"
RESEND_FROM="noreply@authichain.com"

# ── Values you must supply ──────────────────────────────────────────────────────
if [[ -z "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
  warn "STRIPE_WEBHOOK_SECRET not set — get it from: Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret"
  read -rsp "  Paste STRIPE_WEBHOOK_SECRET: " STRIPE_WEBHOOK_SECRET; echo
fi
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  warn "OPENAI_API_KEY not set"
  read -rsp "  Paste OPENAI_API_KEY: " OPENAI_API_KEY; echo
fi
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  warn "SUPABASE_SERVICE_ROLE_KEY not set — get it from: Supabase Dashboard → Project Settings → API → service_role key"
  read -rsp "  Paste SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY; echo
fi

echo ""

# ── 1. Cloudflare: stripe-webhook worker secrets ────────────────────────────────
info "Setting Cloudflare secrets for stripe-webhook worker..."
(
  cd workers/stripe-webhook
  echo "$STRIPE_WEBHOOK_SECRET"     | pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET
  echo "$SUPABASE_URL"              | pnpm exec wrangler secret put SUPABASE_URL
  echo "$SUPABASE_ANON_KEY"        | pnpm exec wrangler secret put SUPABASE_ANON_KEY
  echo "$SUPABASE_SERVICE_ROLE_KEY" | pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
)
ok "stripe-webhook secrets set"

# ── 2. Cloudflare: authichain-verify-worker secrets ────────────────────────────
info "Setting Cloudflare secrets for authichain-verify-worker..."
(
  cd workers/authichain-verify-worker
  echo "$SUPABASE_URL"       | pnpm exec wrangler secret put SUPABASE_URL
  echo "$SUPABASE_ANON_KEY"  | pnpm exec wrangler secret put SUPABASE_ANON_KEY
)
ok "authichain-verify-worker secrets set"

# ── 3. Vercel environment variables ────────────────────────────────────────────
info "Setting Vercel environment variables (production + preview)..."
for ENV_TARGET in production preview; do
  echo "$RESEND_FROM"            | vercel env add RESEND_FROM_EMAIL         "$ENV_TARGET" --yes 2>/dev/null || true
  echo "true"                    | vercel env add AUTONOMOUS_PIPELINE_ENABLED "$ENV_TARGET" --yes 2>/dev/null || true
  echo "$OPENAI_API_KEY"         | vercel env add OPENAI_API_KEY            "$ENV_TARGET" --yes 2>/dev/null || true
  echo "$STRIPE_WEBHOOK_SECRET"  | vercel env add STRIPE_WEBHOOK_SECRET     "$ENV_TARGET" --yes 2>/dev/null || true
done
ok "Vercel env vars set"

# ── 4. Trigger a fresh Vercel deployment to pick up new env vars ────────────────
info "Triggering redeploy..."
vercel deploy --prod --yes 2>&1 | tail -3
ok "Redeploy triggered"

echo -e "\n${GREEN}${BOLD}All automated steps complete.${NC}"
echo ""
echo "Remaining manual step:"
echo "  GitHub → Settings → Security → Code scanning → CodeQL → Default Setup → Disable"
echo ""
echo "Optional: verify Resend sender domain at https://resend.com/domains"
echo "  Domain to verify: authichain.com (DNS TXT + MX records)"
