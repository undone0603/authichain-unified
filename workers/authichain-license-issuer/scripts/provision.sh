#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AuthiChain License Issuer — Cloudflare resource provisioning
#
# This script creates the required D1 database and KV namespace, then
# patches wrangler.toml with the real resource IDs in-place.
#
# Prerequisites:
#   - wrangler installed and authenticated (wrangler login)
#   - jq installed (brew install jq / apt-get install jq)
#
# Usage:
#   cd workers/license-issuer
#   bash scripts/provision.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

WRANGLER_TOML="$(dirname "$0")/../wrangler.toml"

# ── Guard against running twice ───────────────────────────────────────────────
if grep -q 'YOUR_D1_DATABASE_ID\|YOUR_KV_NAMESPACE_ID' "$WRANGLER_TOML"; then
  echo "Placeholder IDs detected — proceeding with provisioning..."
else
  echo "wrangler.toml already has real IDs — nothing to provision."
  exit 0
fi

# ── D1 database ───────────────────────────────────────────────────────────────
echo ""
echo "Creating D1 database: authichain-license-db..."
D1_OUTPUT=$(wrangler d1 create authichain-license-db --json 2>/dev/null || true)

if [ -z "$D1_OUTPUT" ]; then
  # Fallback: parse plain-text output
  D1_OUTPUT=$(wrangler d1 create authichain-license-db 2>&1 || true)
  D1_ID=$(echo "$D1_OUTPUT" | grep -o '"database_id": *"[^"]*"' | grep -o '[0-9a-f-]\{36\}' | head -1)
else
  D1_ID=$(echo "$D1_OUTPUT" | jq -r '.uuid // .database_id // .id' 2>/dev/null | head -1)
fi

if [ -z "$D1_ID" ]; then
  # Already exists — look it up
  echo "Database may already exist; looking up ID..."
  D1_ID=$(wrangler d1 list --json 2>/dev/null | jq -r '.[] | select(.name=="authichain-license-db") | .uuid // .database_id' | head -1)
fi

if [ -z "$D1_ID" ]; then
  echo "ERROR: Could not obtain D1 database ID. Check 'wrangler d1 list' manually." >&2
  exit 1
fi

echo "D1 database ID: $D1_ID"

# ── KV namespace ──────────────────────────────────────────────────────────────
echo ""
echo "Creating KV namespace: LICENSE_SESSIONS..."
KV_OUTPUT=$(wrangler kv namespace create LICENSE_SESSIONS --json 2>/dev/null || true)

if [ -z "$KV_OUTPUT" ]; then
  KV_OUTPUT=$(wrangler kv namespace create LICENSE_SESSIONS 2>&1 || true)
  KV_ID=$(echo "$KV_OUTPUT" | grep -o '"id": *"[^"]*"' | grep -o '[0-9a-f]\{32\}' | head -1)
else
  KV_ID=$(echo "$KV_OUTPUT" | jq -r '.id' 2>/dev/null | head -1)
fi

if [ -z "$KV_ID" ]; then
  echo "Namespace may already exist; looking up ID..."
  KV_ID=$(wrangler kv namespace list --json 2>/dev/null | jq -r '.[] | select(.title | test("LICENSE_SESSIONS")) | .id' | head -1)
fi

if [ -z "$KV_ID" ]; then
  echo "ERROR: Could not obtain KV namespace ID. Check 'wrangler kv namespace list' manually." >&2
  exit 1
fi

echo "KV namespace ID: $KV_ID"

# ── Patch wrangler.toml ───────────────────────────────────────────────────────
echo ""
echo "Patching wrangler.toml..."
sed -i.bak \
  -e "s|YOUR_D1_DATABASE_ID|$D1_ID|g" \
  -e "s|YOUR_KV_NAMESPACE_ID|$KV_ID|g" \
  "$WRANGLER_TOML"

echo "wrangler.toml updated:"
grep -E 'database_id|^  id' "$WRANGLER_TOML"

# ── Apply D1 migrations ───────────────────────────────────────────────────────
echo ""
echo "Applying D1 migrations..."
wrangler d1 migrations apply authichain-license-db --remote

echo ""
echo "─────────────────────────────────────────────────────────────────────────"
echo " Provisioning complete!"
echo ""
echo " Next steps:"
echo "   1. Set worker secrets:"
echo "      wrangler secret put STRIPE_SECRET_KEY"
echo "      wrangler secret put STRIPE_WEBHOOK_SECRET"
echo "      wrangler secret put STRIPE_AGENT_BROWSER_PRO_PRICE_ID"
echo "      wrangler secret put STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID"
echo "      wrangler secret put LICENSE_PRIVATE_KEY_PEM  < license-private.pem"
echo "      wrangler secret put LICENSE_PUBLIC_KEY_PEM   < license-public.pem"
echo "      wrangler secret put TELEGRAM_BOT_TOKEN"
echo "      wrangler secret put TELEGRAM_ADMIN_CHAT_ID"
echo ""
echo "   2. Generate ECDSA P-256 key pair (if not already done):"
echo "      openssl ecparam -name prime256v1 -genkey -noout -out license-private.pem"
echo "      openssl ec -in license-private.pem -pubout -out license-public.pem"
echo ""
echo "   3. Deploy the worker:"
echo "      wrangler deploy"
echo ""
echo "   4. Add the worker URL as a Stripe webhook endpoint:"
echo "      https://<worker-name>.<account>.workers.dev/api/license/stripe-webhook"
echo "─────────────────────────────────────────────────────────────────────────"
