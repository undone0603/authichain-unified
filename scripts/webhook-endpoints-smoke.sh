#!/usr/bin/env bash
# Smoke webhook endpoints (read-only-ish: unsigned POSTs that MUST be rejected).
# A healthy endpoint returns 400/401 "signature verification failed".
# A dead endpoint returns 404/5xx/timeout.
set -u
eps=(
"https://app.authichain.com/webhooks/stripe"
"https://app.authichain.com/api/stripe/webhook"
"https://api.authichain.com/webhook/stripe"
"https://app.qron.space/api/webhook"
"https://qron.space/api/webhook"
)
for u in "${eps[@]}"; do
  resp=$(curl -s -m 20 -o /tmp/whbody -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"ping":true}' "$u")
  body=$(head -c 200 /tmp/whbody | tr '\n' ' ')
  printf "%-50s HTTP %s | %s\n" "$u" "$resp" "$body"
done
