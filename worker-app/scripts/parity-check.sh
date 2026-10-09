#!/usr/bin/env bash
# worker-app/scripts/parity-check.sh
#
# Task 11: Full parity verification checklist (Step 1 — automated route diff)
#
# Usage:
#   WORKERS_URL="https://authichain-edge-router.<subdomain>.workers.dev" \
#   bash worker-app/scripts/parity-check.sh
#
# Optional env vars:
#   PROD_URL       — override production base (default: https://govchain.us)
#   BRAND_HOST     — Host header for brand routing in Workers (default: govchain.us)
#   VERBOSE        — set to "1" to print full response bodies on mismatch
#   SKIP_AUTH      — set to "1" to skip routes that require a session cookie
#
# Prerequisites:
#   brew install jq curl   (or apt-get)
#   npx wrangler login     (only if you want to also run wrangler tail)
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more status-code mismatches detected

set -euo pipefail

WORKERS_URL="${WORKERS_URL:?Set WORKERS_URL=https://authichain-edge-router.<subdomain>.workers.dev}"
PROD_URL="${PROD_URL:-https://govchain.us}"
BRAND_HOST="${BRAND_HOST:-govchain.us}"
VERBOSE="${VERBOSE:-0}"
SKIP_AUTH="${SKIP_AUTH:-0}"

# ── Pre-flight: INTERNAL_SECRET consistency check (Item 7) ─────────────────
# Both worker-app (guardrail server) and authichain-outreach-engine (guardrail
# caller) must share the same INTERNAL_SECRET. A mismatch causes the outreach
# engine to receive 401s from the guardrail, silently suppressing all emails.
# Set these env vars before running, or export them from your secrets manager.
WORKER_APP_SECRET="${WORKER_APP_INTERNAL_SECRET:-}"
OUTREACH_SECRET="${OUTREACH_INTERNAL_SECRET:-}"

if [[ -n "$WORKER_APP_SECRET" && -n "$OUTREACH_SECRET" ]]; then
  if [[ "$WORKER_APP_SECRET" == "$OUTREACH_SECRET" ]]; then
    echo -e "\033[0;32m[OK]\033[0m   INTERNAL_SECRET matches between worker-app and authichain-outreach-engine"
  else
    echo -e "\033[0;31m[WARN]\033[0m INTERNAL_SECRET MISMATCH — outreach engine will be silently blocked"
    echo "       Set WORKER_APP_INTERNAL_SECRET and OUTREACH_INTERNAL_SECRET to the same value"
    echo "       before DNS cutover, then rerun this script."
    exit 1
  fi
else
  echo -e "\033[1;33m[INFO]\033[0m INTERNAL_SECRET check skipped (set WORKER_APP_INTERNAL_SECRET and"
  echo "       OUTREACH_INTERNAL_SECRET env vars to enable this pre-flight check)"
fi
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

check() {
  local label="$1"
  local method="${2:-GET}"
  local path="$3"
  local body="${4:-}"
  local expect_status="${5:-200}"
  local requires_auth="${6:-0}"

  if [[ "$requires_auth" == "1" && "$SKIP_AUTH" == "1" ]]; then
    echo -e "${YELLOW}[SKIP]${NC}  $label"
    ((SKIP++)) || true
    return
  fi

  local curl_flags=(-s -o /dev/null -w "%{http_code}" -X "$method")
  [[ -n "$body" ]] && curl_flags+=(-H "Content-Type: application/json" -d "$body")

  local prod_status workers_status
  prod_status=$(curl "${curl_flags[@]}" "$PROD_URL$path" 2>/dev/null || echo "000")
  workers_status=$(curl "${curl_flags[@]}" -H "Host: $BRAND_HOST" "$WORKERS_URL$path" 2>/dev/null || echo "000")

  if [[ "$workers_status" == "$expect_status" || \
        ( "$prod_status" == "$workers_status" ) ]]; then
    echo -e "${GREEN}[PASS]${NC}  $label  (prod=$prod_status worker=$workers_status)"
    ((PASS++)) || true
  else
    echo -e "${RED}[FAIL]${NC}  $label  (prod=$prod_status worker=$workers_status  expected~$expect_status)"
    ((FAIL++)) || true
    if [[ "$VERBOSE" == "1" ]]; then
      echo "  --- Worker response body ---"
      curl -s -X "$method" \
        -H "Host: $BRAND_HOST" \
        ${body:+-H "Content-Type: application/json" -d "$body"} \
        "$WORKERS_URL$path" | head -40
    fi
  fi
}

echo ""
echo "══════════════════════════════════════════════════════"
echo " Task 11: Parity check"
echo "   prod    → $PROD_URL"
echo "   worker  → $WORKERS_URL  (Host: $BRAND_HOST)"
echo "══════════════════════════════════════════════════════"
echo ""

# ── Public GET routes ───────────────────────────────────────────────────────
echo "── Public routes ──"
check "GET /api/health"          GET  "/api/health"          "" 200
check "GET /robots.txt"          GET  "/robots.txt"          "" 200
check "GET /sitemap.xml"         GET  "/sitemap.xml"         "" 200
check "GET / (SPA shell)"        GET  "/"                    "" 200
check "GET /pricing"             GET  "/pricing"             "" 200
check "GET /login"               GET  "/login"               "" 200
check "GET /dashboard (unauth)"  GET  "/dashboard"           "" 200  # SPA returns 200 shell

echo ""

# ── Webhook routes (expect 400 without a valid payload/signature) ───────────
echo "── Webhook routes (no signature → expect 4xx) ──"
check "POST /api/stripe/webhook (no sig)"    POST "/api/stripe/webhook"    '{}' 400
check "POST /api/paddle/webhook (no body)"   POST "/api/paddle/webhook"    '{}' 400
check "POST /api/webhooks/instantly"         POST "/api/webhooks/instantly" '{}' 401
check "POST /api/webhooks/docusign"          POST "/api/webhooks/docusign"  '{}' 400

echo ""

# ── Public API routes ───────────────────────────────────────────────────────
echo "── Public API routes ──"
check "POST /api/contact (missing fields)"   POST "/api/contact" \
  '{"name":"Test","email":"test@example.com"}' 400

check "GET /api/oauth/callback (no code)"    GET  "/api/oauth/callback"    "" 400

echo ""

# ── Internal routes (no secret → expect 401) ────────────────────────────────
echo "── Internal routes (no secret → expect 401) ──"
check "GET /api/internal/analytics (no auth)"    GET  "/api/internal/analytics"         "" 401
check "POST /api/internal/verify (no auth)"      POST "/api/internal/verify"    '{}'   401
check "POST /api/internal/qr/generate (no auth)" POST "/api/internal/qr/generate" '{}' 401

echo ""

# ── tRPC health (unauthenticated procedure) ─────────────────────────────────
echo "── tRPC ──"
# tRPC GET procedures return 200 with a result envelope even for simple queries
check "GET /api/trpc/health (GET batch)" GET \
  "/api/trpc/health?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D" \
  "" 200

echo ""

# ── GPT / AI routes (no key → expect auth or bad-request) ──────────────────
echo "── GPT/AI routes (no auth) ──"
check "POST /api/gpt/verify (no auth)"         POST "/api/gpt/verify"         '{}' 401
check "POST /api/gpt/qr/generate (no auth)"    POST "/api/gpt/qr/generate"    '{}' 401
check "GET  /api/gpt/certificates/verify"      GET  "/api/gpt/certificates/verify" "" 401
check "POST /api/gpt/cannabis/verify (no auth)" POST "/api/gpt/cannabis/verify" '{}' 401
check "POST /api/gpt/trust-score (no auth)"    POST "/api/gpt/trust-score"    '{}' 401

echo ""

# ── Admin route (no admin cookie → expect 401/403) ─────────────────────────
echo "── Admin routes ──"
check "GET /api/admin/ops (no auth)"  GET "/api/admin/ops" "" 401

echo ""

# ── Summary ─────────────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════════════"
echo -e " Route diff results:"
echo -e "   ${GREEN}${PASS} passed${NC}  ${RED}${FAIL} failed${NC}  ${YELLOW}${SKIP} skipped${NC}"
echo "══════════════════════════════════════════════════════"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "One or more route checks failed. Fix gaps before Task 12 (DNS cutover)."
  echo "Re-run with VERBOSE=1 to see response bodies."
  exit 1
fi

echo -e "${GREEN}Step 1 (route diff): PASSED${NC}"
echo ""

# ── Step 2: Manual auth flow reminder ────────────────────────────────────────
echo "── Step 2: Manual auth flow (cannot be automated) ──"
echo "  1. Open $WORKERS_URL in a browser"
echo "  2. Log in via the normal login flow"
echo "  3. Navigate to /dashboard — confirm data loads"
echo "  4. Refresh the page — confirm session persists (KV/DO session is working)"
echo "  5. Log out — confirm the session cookie is cleared"
echo ""

# ── Step 3: Stripe webhook replay (Item 5) ────────────────────────────────────
echo "── Step 3: Stripe webhook replay ──"
echo "  Run these commands in a separate terminal:"
echo ""
echo "    stripe listen --forward-to $WORKERS_URL/api/stripe/webhook"
echo ""
echo "  Then in another terminal:"
echo ""
echo "    stripe trigger payment_intent.succeeded"
echo "    stripe trigger customer.subscription.created"
echo ""
echo "  Confirm:"
echo "    - Stripe CLI shows a 200 response from the worker"
echo "    - A new row appears in the revenue_records table in your DB"
echo "    - activity_log has an entry for the webhook event"
echo ""
echo "  If the webhook returns 400 (bad signature), the STRIPE_WEBHOOK_SECRET"
echo "  set on the worker does not match the CLI's signing key. Re-run:"
echo "    npx wrangler secret put STRIPE_WEBHOOK_SECRET"
echo "  and paste the 'whsec_...' value that Stripe CLI prints on startup."
echo ""
echo "══════════════════════════════════════════════════════"
echo "All automated checks passed."
echo "Complete Steps 2 and 3 above, then proceed to Task 12 (DNS cutover)."
echo "══════════════════════════════════════════════════════"
exit 0
