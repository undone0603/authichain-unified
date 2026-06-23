#!/usr/bin/env bash
#
# rotate-secrets.sh — push rotated secrets to the Cloudflare Workers that use them.
#
# Run this AFTER generating fresh credentials (the repo went public, so every
# value listed in docs/SECURITY-REMEDIATION-CRITICAL.md must be rotated). It only
# pushes a secret when its env var is set, so you can rotate incrementally.
#
# Each `wrangler secret put` reads the value from stdin, so secrets never appear
# in argv / process listings / shell history.
#
# PREREQUISITES
#   export CLOUDFLARE_API_TOKEN=...      # Workers Scripts:Edit
#   export CLOUDFLARE_ACCOUNT_ID=...     # optional; defaults below
#
# USAGE — export only the secrets you're rotating, then run:
#   export RESEND_API_KEY="re_new..."
#   export SUPABASE_ANON_KEY="eyJ..."
#   export STRIPE_SECRET_KEY="sk_live_new..."
#   export STRIPE_WEBHOOK_SECRET="whsec_new..."
#   export TELEGRAM_BOT_TOKEN="..."
#   export TELEGRAM_ADMIN_CHAT_ID="..."
#   bash scripts/rotate-secrets.sh
#
# NOTE: workers qron-stripe-webhook / qron-daily-ops / qrontoken-telegram-bot
# from the audit are NOT in this repo — rotate those via the Cloudflare dashboard
# (Workers → <worker> → Settings → Variables) using the same fresh values.
#
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-4c1869b90f13f86940aa3747839bf420}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WX="npx --yes wrangler@4"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN is required (perm: Workers Scripts:Edit)."
  exit 1
fi

pushed=0
# put_secret <worker-dir> <SECRET_NAME> <value>
put_secret() {
  local dir="$1" name="$2" value="$3"
  [ -z "$value" ] && return 0
  if [ ! -d "$REPO_ROOT/workers/$dir" ]; then
    echo "  ⚠ skip $name → $dir (worker dir not in repo)"; return 0
  fi
  echo "  → $dir : $name"
  ( cd "$REPO_ROOT/workers/$dir" && printf '%s' "$value" | $WX secret put "$name" >/dev/null )
  pushed=$((pushed + 1))
}

echo "Rotating secrets into in-repo workers (only those whose env vars are set)…"

# Resend email key — used by the relay and the autopilot drip engine.
put_secret authichain-autopilot      RESEND_API_KEY      "${RESEND_API_KEY:-}"
put_secret resend-relay              RESEND_API_KEY      "${RESEND_API_KEY:-}"

# Supabase anon key — autopilot reads/writes drip_prospects.
put_secret authichain-autopilot      SUPABASE_ANON_KEY   "${SUPABASE_ANON_KEY:-}"

# Stripe — license issuer turns webhooks into signed licenses.
put_secret authichain-license-issuer STRIPE_SECRET_KEY     "${STRIPE_SECRET_KEY:-}"
put_secret authichain-license-issuer STRIPE_WEBHOOK_SECRET "${STRIPE_WEBHOOK_SECRET:-}"

# Telegram — license issuer admin notifications.
put_secret authichain-license-issuer TELEGRAM_BOT_TOKEN     "${TELEGRAM_BOT_TOKEN:-}"
put_secret authichain-license-issuer TELEGRAM_ADMIN_CHAT_ID "${TELEGRAM_ADMIN_CHAT_ID:-}"

echo ""
if [ "$pushed" -eq 0 ]; then
  echo "No secrets pushed — export the ones you're rotating and re-run."
else
  echo "✅ Pushed $pushed secret(s). Re-deploy affected workers if their code changed:"
  echo "   bash scripts/deploy-ready-workers.sh"
fi
