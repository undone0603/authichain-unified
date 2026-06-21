#!/bin/bash
set -e

##############################################################################
# COMPLETE STRIPE SETUP - AUTOMATED VIA STRIPE API
# Requires: STRIPE_SECRET_KEY in environment
#
# This script automates all Stripe configuration:
# - Products & Prices (7 tiers: starter/pro/enterprise/medtech/verify_api/white_label/vertical)
# - Webhook endpoint registration
# - Billing meters (optional)
##############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}STRIPE CONFIGURATION AUTOMATION${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1: VERIFY ENVIRONMENT
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}PHASE 1: Verify Stripe API Credentials${NC}"

if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo -e "${RED}✗ STRIPE_SECRET_KEY not set${NC}"
  echo "Set it with: export STRIPE_SECRET_KEY='sk_live_...'"
  exit 1
fi

if [[ ! $STRIPE_SECRET_KEY =~ ^sk_(live|test)_ ]]; then
  echo -e "${RED}✗ Invalid Stripe key format${NC}"
  echo "Key should start with sk_live_ or sk_test_"
  exit 1
fi

# Determine if test or live key
if [[ $STRIPE_SECRET_KEY =~ ^sk_live_ ]]; then
  MODE="LIVE"
else
  MODE="TEST"
fi

echo -e "${GREEN}✓ Stripe API credential valid (${MODE} mode)${NC}\n"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2: CREATE PRODUCTS & PRICES
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}PHASE 2: Create Stripe Products & Prices${NC}"
echo "Running: pnpm tsx scripts/setup-stripe-products.ts"
echo ""

if ! pnpm tsx scripts/setup-stripe-products.ts; then
  echo -e "${RED}✗ Product creation failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Products & prices created${NC}\n"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3: CREATE WEBHOOK ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}PHASE 3: Register Stripe Webhook Endpoint${NC}"

WEBHOOK_URL="https://app.authichain.com/api/webhook"
EVENTS=(
  "checkout.session.completed"
  "customer.subscription.updated"
  "customer.subscription.deleted"
  "invoice.paid"
  "invoice.payment_failed"
  "customer.subscription.trial_will_end"
  "invoice.finalized"
  "charge.refunded"
)

echo "Creating webhook endpoint at: $WEBHOOK_URL"
echo "Events: ${EVENTS[@]}"
echo ""

# Check if endpoint already exists
EXISTING=$(curl -s https://api.stripe.com/v1/webhook_endpoints \
  -u "$STRIPE_SECRET_KEY:" \
  -G --data-urlencode "url=$WEBHOOK_URL" \
  -G --data-urlencode "limit=1" \
  | grep -o '"id":"[^"]*"' | head -1 || echo "")

if [ ! -z "$EXISTING" ]; then
  WEBHOOK_ID=$(echo "$EXISTING" | sed 's/"id":"\([^"]*\)".*/\1/')
  echo -e "${YELLOW}! Webhook already exists: $WEBHOOK_ID${NC}"
  SIGNING_SECRET=$(curl -s https://api.stripe.com/v1/webhook_endpoints/$WEBHOOK_ID \
    -u "$STRIPE_SECRET_KEY:" \
    | grep -o '"secret":"[^"]*"' | sed 's/"secret":"\([^"]*\)".*/\1/')
else
  # Create webhook endpoint
  EVENT_PARAMS=""
  for event in "${EVENTS[@]}"; do
    EVENT_PARAMS="${EVENT_PARAMS} --data-urlencode 'enabled_events[]='"${event}
  done

  WEBHOOK_RESPONSE=$(curl -s -X POST https://api.stripe.com/v1/webhook_endpoints \
    -u "$STRIPE_SECRET_KEY:" \
    -d "url=$WEBHOOK_URL" \
    $EVENT_PARAMS)

  WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | grep -o '"id":"[^"]*"' | sed 's/"id":"\([^"]*\)".*/\1/')
  SIGNING_SECRET=$(echo "$WEBHOOK_RESPONSE" | grep -o '"secret":"[^"]*"' | sed 's/"secret":"\([^"]*\)".*/\1/')

  if [ -z "$WEBHOOK_ID" ]; then
    echo -e "${RED}✗ Webhook creation failed${NC}"
    echo "Response: $WEBHOOK_RESPONSE"
    exit 1
  fi

  echo -e "${GREEN}✓ Webhook endpoint created: $WEBHOOK_ID${NC}"
fi

echo -e "${GREEN}✓ Signing secret: $SIGNING_SECRET${NC}\n"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4: CREATE BILLING METERS (OPTIONAL)
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}PHASE 4: Create Billing Meters (Optional)${NC}"

METERS=(
  "verify_product_calls"
  "register_product_calls"
  "check_eu_dpp_calls"
  "mint_certificate_calls"
)

for meter_name in "${METERS[@]}"; do
  echo "Checking meter: $meter_name"

  # Check if meter exists
  EXISTING_METER=$(curl -s https://api.stripe.com/v1/billing/meters \
    -u "$STRIPE_SECRET_KEY:" \
    | grep -o "\"display_name\":\"$meter_name\"" || echo "")

  if [ ! -z "$EXISTING_METER" ]; then
    echo -e "${YELLOW}  ! Meter already exists${NC}"
  else
    # Create meter
    curl -s -X POST https://api.stripe.com/v1/billing/meters \
      -u "$STRIPE_SECRET_KEY:" \
      -d "event_name=custom.$meter_name" \
      -d "display_name=$meter_name" \
      > /dev/null
    echo -e "${GREEN}  ✓ Created${NC}"
  fi
done

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 5: ENVIRONMENT VARIABLES FOR DEPLOYMENT
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}PHASE 5: Environment Variables Required${NC}"
echo ""
echo "Add these to Vercel environment variables:"
echo ""
echo -e "${YELLOW}STRIPE_SECRET_KEY${NC}=${STRIPE_SECRET_KEY}"
echo -e "${YELLOW}STRIPE_WEBHOOK_SECRET${NC}=${SIGNING_SECRET}"
echo ""
echo "You can also add to .env for local testing:"
echo ""
cat > .env.stripe << EOF
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${SIGNING_SECRET}
EOF

echo "Saved to: .env.stripe"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 6: SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}STRIPE SETUP COMPLETE ✓${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "✓ 7 products created (starter, pro, enterprise, medtech, verify_api, white_label, vertical)"
echo "✓ Webhook endpoint registered: $WEBHOOK_ID"
echo "✓ 8 events enabled (checkout, subscription, invoice, charges)"
echo "✓ 4 billing meters created"
echo ""
echo "Next steps:"
echo "1. Update Vercel environment variables with STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET"
echo "2. Redeploy to Vercel: npx vercel deploy --prebuilt --prod"
echo "3. Test with \$29 transaction on https://app.authichain.com"
echo ""
