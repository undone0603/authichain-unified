#!/usr/bin/env bash
#
# launch.sh — one-command production activation for the AuthiChain Economy.
#
# Walks you through setting the Cloudflare Worker secrets the platform reads
# (see server/_core/env.ts), then optionally flips the autonomous-pipeline and
# (last, behind a hard confirm) the payouts switch.
#
# Secrets are read silently (never echoed) and pushed via `wrangler secret put`.
# Press Enter to SKIP any secret — skipping leaves the existing value untouched.
#
# Prereqs:
#   - Run from the repo root.
#   - `gh` authenticated (default in GitHub Codespaces) for the pipeline step.
#   - CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) exported, OR you'll be prompted.
#
# Usage:  bash launch.sh
#
set -euo pipefail

# ── pretty output ─────────────────────────────────────────────────────────────
bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
skip() { printf '  \033[90m· skipped %s\033[0m\n' "$1"; }
warn() { printf '\033[33m! %s\033[0m\n' "$1"; }
hr()   { printf '\033[90m%s\033[0m\n' "────────────────────────────────────────────────────────"; }

# ── prereqs ───────────────────────────────────────────────────────────────────
if [ ! -f wrangler.toml ] && [ ! -f wrangler.jsonc ]; then
  warn "No wrangler config found. Run this from the repo root."; exit 1
fi

WRANGLER="npx --yes wrangler"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  read -rsp "Cloudflare API token (CLOUDFLARE_API_TOKEN): " CLOUDFLARE_API_TOKEN; echo
  export CLOUDFLARE_API_TOKEN
fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  read -rp  "Cloudflare account id (CLOUDFLARE_ACCOUNT_ID) [blank to use wrangler default]: " CLOUDFLARE_ACCOUNT_ID || true
  export CLOUDFLARE_ACCOUNT_ID
fi

# put_secret NAME "description"  — silent prompt; skips on empty input.
put_secret() {
  local name="$1" desc="$2" val
  read -rsp "  ${name} — ${desc}: " val; echo
  if [ -z "$val" ]; then skip "$name"; return; fi
  printf '%s' "$val" | $WRANGLER secret put "$name" >/dev/null 2>&1 \
    && ok "$name set" \
    || warn "failed to set $name (check Cloudflare auth)"
}

# put_group "Title"  NAME:desc  NAME:desc ...   — asks before doing the group.
put_group() {
  local title="$1"; shift
  hr; bold "$title"
  local entry name desc
  for entry in "$@"; do
    name="${entry%%:*}"; desc="${entry#*:}"
    put_secret "$name" "$desc"
  done
}

bold "AuthiChain Economy — production activation"
echo "Enter a value to set a secret, or press Enter to skip it."

# ── REQUIRED — revenue/auth will not work without these ───────────────────────
put_group "1) Required (core platform + revenue)" \
  "DATABASE_URL:Supabase session pooler connection string" \
  "JWT_SECRET:ecosystem token signing key" \
  "SUPABASE_URL:Supabase project URL" \
  "SUPABASE_SERVICE_ROLE_KEY:Supabase service-role key" \
  "STRIPE_SECRET_KEY:Stripe live secret key (sk_live_...)" \
  "STRIPE_WEBHOOK_SECRET:Stripe webhook signing secret (whsec_...)" \
  "OPENAI_API_KEY:OpenAI key for GPT-4 Vision AutoFlow"

# ── RECOMMENDED — needed for the autonomous + blockchain features ─────────────
put_group "2) Recommended (autonomy, CRM, chain, ownership)" \
  "HUBSPOT_SERVICE_KEY:HubSpot private-app token (CRM + closed-won revenue)" \
  "CRON_SECRET:bearer secret the Vercel/CF cron uses to call /api/cron" \
  "INTERNAL_API_SECRET:secret guarding internal API routes" \
  "QRON_AUTHICHAIN_KEY:cross-service QRON<->AuthiChain key" \
  "VITE_THIRDWEB_CLIENT_ID:thirdweb client id (wallet/NFT)" \
  "WALLET_PRIVATE_KEY:Polygon signer key for anchoring/minting" \
  "OWNER_EMAILS:comma-separated owner emails (founder dashboard access)" \
  "OWNER_OPEN_ID:owner openId for admin auth"

# ── OUTREACH/EMAIL — set whichever provider you use ───────────────────────────
put_group "3) Email / outreach (set the provider you use)" \
  "RESEND_API_KEY:Resend API key" \
  "SENDGRID_API_KEY:SendGrid API key" \
  "GMAIL_CLIENT_ID:Gmail OAuth client id" \
  "GMAIL_CLIENT_SECRET:Gmail OAuth client secret" \
  "GMAIL_REFRESH_TOKEN:Gmail OAuth refresh token" \
  "GMAIL_FROM_EMAIL:from-address for Gmail sends"

# ── OPTIONAL — verticals, lead-gen, media, billing alt ────────────────────────
echo; read -rp "Configure OPTIONAL integrations (Paddle, Apollo, HeyGen, news, Pinecone, etc.)? [y/N] " opt
if [[ "${opt:-N}" =~ ^[Yy]$ ]]; then
  put_group "4) Optional integrations" \
    "PADDLE_API_KEY:Paddle API key (alt billing)" \
    "PADDLE_WEBHOOK_SECRET:Paddle webhook secret" \
    "APOLLO_API_KEY:Apollo.io key (lead enrichment)" \
    "SAM_GOV_API_KEY:SAM.gov key (GovChain pipeline)" \
    "HEYGEN_API_KEY:HeyGen key (AI avatar video)" \
    "SERPAPI_KEY:SerpAPI key (newsjacking/search)" \
    "NEWS_API_KEY:NewsAPI key (newsjacking monitor)" \
    "PINECONE_API_KEY:Pinecone key (gov lead vectors)" \
    "GEMINI_API_KEY:Google Gemini key (LLM fallback)" \
    "GROQ_API_KEY:Groq key (LLM fallback)" \
    "OPENROUTER_API_KEY:OpenRouter key (LLM fallback)" \
    "MAKE_WEBHOOK_URL:Make.com webhook URL" \
    "SMS_RECIPIENT:SMS/email-to-text recipient for alerts" \
    "BLOCKCHAIN_PRIVATE_KEY:secondary chain signer (if used)" \
    "DEFAULT_NFT_CONTRACT:default ERC-721 contract address" \
    "QRON_TOKEN_ADDRESS:QRON ERC-20 address" \
    "QRON_BURN_ADDRESS:QRON burn address"
fi

# ── Autonomous pipeline toggle ────────────────────────────────────────────────
hr; bold "5) Autonomous revenue pipeline"
echo "Turns on the 2-minute pipeline tick: lead-find -> research -> outreach drafts"
echo "(held for your approval) -> conversions -> revenueRecords -> founder.snapshot."
read -rp "Enable AUTONOMOUS_PIPELINE_ENABLED now? [y/N] " ap
if [[ "${ap:-N}" =~ ^[Yy]$ ]]; then
  if command -v gh >/dev/null 2>&1; then
    gh workflow run set-pipeline-enabled.yml && ok "triggered 'Enable Autonomous Pipeline' workflow"
  else
    printf 'true' | $WRANGLER secret put AUTONOMOUS_PIPELINE_ENABLED >/dev/null 2>&1 \
      && ok "AUTONOMOUS_PIPELINE_ENABLED=true" || warn "failed to set flag"
  fi
else
  skip "AUTONOMOUS_PIPELINE_ENABLED"
fi

# ── Payouts — MONEY MOVEMENT. Double-confirm. ─────────────────────────────────
hr; bold "6) Payouts (MOVES REAL MONEY)"
warn "PAYOUTS_ENABLED lets approved payout batches disburse funds."
warn "Even when true, each batch still requires human approval in the app."
read -rp "Type EXACTLY 'ENABLE PAYOUTS' to turn it on (anything else skips): " confirm
if [ "${confirm:-}" = "ENABLE PAYOUTS" ]; then
  printf 'true' | $WRANGLER secret put PAYOUTS_ENABLED >/dev/null 2>&1 \
    && ok "PAYOUTS_ENABLED=true" || warn "failed to set PAYOUTS_ENABLED"
else
  skip "PAYOUTS_ENABLED (left off)"
fi

hr; bold "Done."
echo "Next: confirm a deploy picked up the new secrets, then approve outreach"
echo "drafts in-app. Founder income is the 'founder.snapshot' tRPC query."
