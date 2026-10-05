#!/usr/bin/env bash
set -euo pipefail
base=${1:-https://authichain.com}
echo "== DPP funnel smoke against $base =="
code=$(curl -sS -m 20 -o /tmp/dpp_land.html -w '%{http_code}' "$base/dpp")
echo "landing: $code"
code=$(curl -sS -m 20 -o /dev/null -w '%{http_code}|%{redirect_url}' "$base/api/checkout/dpp?visit_id=dpp_smoke_$(date +%s)&utm_source=smoke")
echo "checkout: $code"
code=$(curl -sS -m 15 -o /tmp/dpp_thanks.html -w '%{http_code}' "$base/dpp/thanks?session_id=cs_test&visit_id=dpp_smoke")
echo "thanks: $code ($(grep -c 'Payment received' /tmp/dpp_thanks.html || true) hits)"
code=$(curl -sS -m 15 -o /tmp/dpp_act.html -w '%{http_code}' "$base/dpp/activate?session_id=cs_test")
echo "activate: $code ($(grep -c 'Activate merchant' /tmp/dpp_act.html || true) hits)"
echo "OK — complete paid smoke in browser with promo DPP-SMOKE-E2E on the Stripe Payment Link."
