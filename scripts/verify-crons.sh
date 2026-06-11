#!/usr/bin/env bash
# Verify the schedules endpoint works (raw JSON) and check which Stripe key
# qron-stripe-webhook embeds.
set -e
source ~/.nvm/nvm.sh
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4/accounts/$ACCT"

for w in qron-self-heal qron-daily-ops qron-automation authichain-automation; do
  echo "--- schedules: $w ---"
  curl -s "$API/workers/scripts/$w/schedules" -H "Authorization: Bearer $TOKEN"
  echo
done

echo "--- qron-stripe-webhook embedded Stripe key (first 30 chars) ---"
grep -oP 'sk_live_[A-Za-z0-9]{1,22}' ~/cf-skim/qron-stripe-webhook.js | sort -u
echo "--- qron-stripe-webhook: where it sends ---"
grep -oP 'https://[a-z0-9.-]+[a-z0-9/_.-]*' ~/cf-skim/qron-stripe-webhook.js | sort -u | head -20
