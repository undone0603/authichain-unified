#!/bin/bash
# Revenue Configuration Pre-Flight Check
# Run this locally before executing the 3-step activation

set -e

echo "📋 Revenue Activation Pre-Flight Check"
echo "======================================"
echo ""

PASS=0
FAIL=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
  local name=$1
  local cmd=$2
  echo -n "Checking $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((PASS++))
  else
    echo -e "${RED}✗${NC}"
    ((FAIL++))
  fi
}

# 1. Environment Variables (Vercel)
echo "1️⃣  Environment Variables (Vercel)"
echo "-----------------------------------"
check "STRIPE_SECRET_KEY is set" "[ -n \"\$STRIPE_SECRET_KEY\" ]"
check "STRIPE_WEBHOOK_SECRET is set" "[ -n \"\$STRIPE_WEBHOOK_SECRET\" ]"
check "NEXT_PUBLIC_APP_URL is set" "[ -n \"\$NEXT_PUBLIC_APP_URL\" ]"
check "NEXT_PUBLIC_APP_URL is not empty string" "[ \"\$NEXT_PUBLIC_APP_URL\" != \"\" ]"
echo ""

# 2. Database (Supabase)
echo "2️⃣  Database Migrations (Supabase)"
echo "----------------------------------"
check "supabase CLI installed" "which supabase"
if [ $? -eq 0 ]; then
  check "Migration 00004 exists" "[ -f ./supabase/migrations/00004_create_add_generation_credits_rpc.sql ]"
  check "Migration 00005 exists" "[ -f ./supabase/migrations/00005_create_stripe_events_table.sql ]"
  echo ""
  echo "To push migrations:"
  echo "  cd authichain && supabase db push"
fi
echo ""

# 3. Application Config
echo "3️⃣  Application Configuration"
echo "----------------------------"
check "Fulfillment library exists" "[ -f ./src/lib/fulfillment.ts ]"
check "/api/webhook exists" "[ -f ./src/app/api/webhook/route.ts ]"
check "/api/checkout/verify exists" "[ -f ./src/app/api/checkout/verify/route.ts ]"
check "/api/admin/revenue exists" "[ -f ./src/app/api/admin/revenue/route.ts ]"
echo ""

# 4. Type Safety & Tests
echo "4️⃣  Code Quality"
echo "----------------"
check "TypeScript compiles" "pnpm check 2>/dev/null"
check "Tests pass" "pnpm test 2>/dev/null | grep -q 'Test Files.*passed'"
echo ""

# Summary
echo "======================================"
echo "Results: ${GREEN}${PASS} pass${NC}, ${RED}${FAIL} fail${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}⚠️  Some checks failed. Please review above.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All checks passed. Ready for activation!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. cd authichain && supabase db push"
  echo "2. Register webhooks in Stripe Dashboard"
  echo "3. Set environment variables in Vercel"
  echo "4. Redeploy and test real transaction"
  echo ""
  echo "See: ACTIVATION_QUICKSTART.md for details"
  exit 0
fi
