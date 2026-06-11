#!/usr/bin/env bash
# Batch 2 evidence gathering: for each remaining no-repo-source worker,
# download code to a staging dir, report size + risk markers + cron schedules.
# Also dump authichain.com zone worker routes (the only zone routed through CF).
set -e
source ~/.nvm/nvm.sh
cd ~/authichain-unified
npx wrangler whoami >/dev/null 2>&1 || true
CFG=~/.config/.wrangler/config/default.toml
[ -f "$CFG" ] || CFG=~/.wrangler/config/default.toml
TOKEN=$(grep -oP '(?<=oauth_token = ")[^"]*' "$CFG")
ACCT=4c1869b90f13f86940aa3747839bf420
API="https://api.cloudflare.com/client/v4"

echo "=== authichain.com zone worker routes ==="
ZONE=$(curl -s "$API/zones?name=authichain.com" -H "Authorization: Bearer $TOKEN" | grep -oP '(?<="id":")[a-f0-9]{32}' | head -1)
echo "zone: $ZONE"
curl -s "$API/zones/$ZONE/workers/routes" -H "Authorization: Bearer $TOKEN"
echo; echo

ORPHANS=(
  auth analytics ai-classification blockchain watchchain-io-vertical
  authichain-infra maison-elite-store authichain-unified stripe-webhook
  qron-ai-api stripe-provisioner qron-edge-fleet authentic-economy-portal
  authichain-qron-agentz authichain-autonomous-nexus authichain-ecosystem-pulse
  authichain-consensus-engine admin-dashboard health-monitor
  authichain-landing-qron authichain-landing-com authichain-stripe-listener
  authichain-marketplace-webhook govchain-resolver stripe-listener
  qron-portfolio qron-stripe-webhook qrontoken-telegram-bot qron-images
  authichain-verify gmail-relay-z qron-self-heal qron-daily-ops authichain-verifier
)

STAGE=~/cf-skim
mkdir -p "$STAGE"
echo "=== per-worker: size | crons | risk markers ==="
for w in "${ORPHANS[@]}"; do
  curl -s "$API/accounts/$ACCT/workers/scripts/$w" -H "Authorization: Bearer $TOKEN" -o "$STAGE/$w.js"
  SIZE=$(stat -c%s "$STAGE/$w.js")
  CRON=$(curl -s "$API/accounts/$ACCT/workers/scripts/$w/schedules" -H "Authorization: Bearer $TOKEN" | grep -oP '(?<="cron":")[^"]*' | tr '\n' ' ')
  MARKERS=""
  grep -q "sk_live" "$STAGE/$w.js" && MARKERS="$MARKERS STRIPE_LIVE_KEY"
  grep -qi "api.resend.com\|resend-relay" "$STAGE/$w.js" && MARKERS="$MARKERS RESEND"
  grep -qi "gmail-relay" "$STAGE/$w.js" && MARKERS="$MARKERS GMAIL_RELAY"
  grep -q "api.stripe.com" "$STAGE/$w.js" && MARKERS="$MARKERS STRIPE_API"
  grep -q "async scheduled\|scheduled(" "$STAGE/$w.js" && MARKERS="$MARKERS HAS_SCHEDULED"
  grep -qi "supabase" "$STAGE/$w.js" && MARKERS="$MARKERS SUPABASE"
  grep -qi "telegram" "$STAGE/$w.js" && MARKERS="$MARKERS TELEGRAM"
  echo "$w | ${SIZE}B | cron:[${CRON:-none}] |${MARKERS:- clean}"
done
