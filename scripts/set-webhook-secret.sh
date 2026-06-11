#!/usr/bin/env bash
# Update STRIPE_WEBHOOK_SECRET in Vercel production env.
# Secret arrives via $WHSEC env var (WSLENV passthrough) — never written to disk.
set -u
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1

cd /home/zac/authichain-unified
[ -z "${WHSEC:-}" ] && { echo "WHSEC not set"; exit 1; }
echo "secret prefix: ${WHSEC:0:9}… (len ${#WHSEC})"

if ! command -v vercel >/dev/null 2>&1; then
  echo "no vercel CLI in WSL node env"; exit 1
fi
echo "vercel user: $(vercel whoami 2>/dev/null)"
echo "linked project: $(cat .vercel/project.json 2>/dev/null)"

echo "--- removing existing STRIPE_WEBHOOK_SECRET (production) ---"
vercel env rm STRIPE_WEBHOOK_SECRET production --yes 2>&1 | tail -3

echo "--- adding new STRIPE_WEBHOOK_SECRET (production) ---"
printf '%s' "$WHSEC" | vercel env add STRIPE_WEBHOOK_SECRET production 2>&1 | tail -3

echo "--- verify (names only) ---"
vercel env ls production 2>&1 | grep -i STRIPE_WEBHOOK
