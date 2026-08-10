#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AuthiChain License Issuer — full deploy + secrets setup
#
# Run this from your local machine (not in the sandboxed CI environment).
#
# Prerequisites:
#   - Node.js 18+ and npm installed
#   - CLOUDFLARE_API_TOKEN exported in your shell
#     (needs: Workers Scripts:Edit, D1:Edit, KV:Edit permissions)
#   - License key PEM files generated (see step 1 below)
#
# Usage:
#   export CLOUDFLARE_API_TOKEN=cfut_...
#   export STRIPE_SECRET_KEY=sk_live_...
#   export STRIPE_WEBHOOK_SECRET=whsec_...
#   export STRIPE_PRO_PRICE_ID=price_...
#   export STRIPE_ENTERPRISE_PRICE_ID=price_...
#   export TELEGRAM_BOT_TOKEN=...
#   export TELEGRAM_ADMIN_CHAT_ID=...
#   bash scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$(dirname "$SCRIPT_DIR")"

cd "$WORKER_DIR"

# ── 1. Generate ECDSA P-256 key pair (if not already done) ───────────────────
if [ ! -f license-private.pem ]; then
  echo "Generating ECDSA P-256 key pair..."
  openssl ecparam -name prime256v1 -genkey -noout -out license-private.pem
  openssl ec -in license-private.pem -pubout -out license-public.pem
  echo "  ✅ license-private.pem  (keep secret — never commit)"
  echo "  ✅ license-public.pem   (safe to commit)"
else
  echo "Key pair already exists — skipping generation."
fi

# ── 2. Install worker dependencies ───────────────────────────────────────────
echo ""
echo "Installing worker dependencies..."
npm ci --silent

# ── 3. Deploy worker ──────────────────────────────────────────────────────────
echo ""
echo "Deploying worker..."
npx wrangler --config wrangler.toml deploy

WORKER_URL="https://authichain-license-issuer.$(npx wrangler whoami --json 2>/dev/null | jq -r '.subdomain // "workers"').workers.dev"
echo "  ✅ Worker deployed"

# ── 4. Set secrets ───────────────────────────────────────────────────────────
echo ""
echo "Setting worker secrets..."

check_var() {
  if [ -z "${!1:-}" ]; then
    echo "  ⚠ $1 is not set — skipping (set this env var and re-run to add)"
    return 1
  fi
  return 0
}

if check_var STRIPE_SECRET_KEY; then
  echo "$STRIPE_SECRET_KEY" | npx wrangler secret put STRIPE_SECRET_KEY --config wrangler.toml
  echo "  ✅ STRIPE_SECRET_KEY"
fi

if check_var STRIPE_WEBHOOK_SECRET; then
  echo "$STRIPE_WEBHOOK_SECRET" | npx wrangler secret put STRIPE_WEBHOOK_SECRET --config wrangler.toml
  echo "  ✅ STRIPE_WEBHOOK_SECRET"
fi

if check_var STRIPE_PRO_PRICE_ID; then
  echo "$STRIPE_PRO_PRICE_ID" | npx wrangler secret put STRIPE_AGENT_BROWSER_PRO_PRICE_ID --config wrangler.toml
  echo "  ✅ STRIPE_AGENT_BROWSER_PRO_PRICE_ID"
fi

if check_var STRIPE_ENTERPRISE_PRICE_ID; then
  echo "$STRIPE_ENTERPRISE_PRICE_ID" | npx wrangler secret put STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID --config wrangler.toml
  echo "  ✅ STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID"
fi

# License signing keys (from PEM files)
echo "$(cat license-private.pem)" | npx wrangler secret put LICENSE_PRIVATE_KEY_PEM --config wrangler.toml
echo "  ✅ LICENSE_PRIVATE_KEY_PEM"

echo "$(cat license-public.pem)" | npx wrangler secret put LICENSE_PUBLIC_KEY_PEM --config wrangler.toml
echo "  ✅ LICENSE_PUBLIC_KEY_PEM"

if check_var TELEGRAM_BOT_TOKEN; then
  echo "$TELEGRAM_BOT_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN --config wrangler.toml
  echo "  ✅ TELEGRAM_BOT_TOKEN"
fi

if check_var TELEGRAM_ADMIN_CHAT_ID; then
  echo "$TELEGRAM_ADMIN_CHAT_ID" | npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID --config wrangler.toml
  echo "  ✅ TELEGRAM_ADMIN_CHAT_ID"
fi

# ── 5. Print Stripe webhook registration instructions ────────────────────────
echo ""
echo "─────────────────────────────────────────────────────────────────────────"
echo " ✅ Deploy complete!"
echo ""
echo " Register Stripe webhook endpoint:"
echo "   URL    : https://authichain-license-issuer.<account>.workers.dev/api/license/stripe-webhook"
echo "   Events : checkout.session.completed, customer.subscription.deleted"
echo ""
echo " Copy the public key below into agent-browser's QRON_LICENSE_PUBLIC_KEY env var:"
cat license-public.pem
echo "─────────────────────────────────────────────────────────────────────────"
