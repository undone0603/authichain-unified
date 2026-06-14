#!/usr/bin/env bash
set -u
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1
cd /home/zac/authichain-unified

echo "=== tsc (count errors; baseline 17) ==="
pnpm check 2>&1 | grep -cE 'error TS'

echo "=== build ==="
pnpm build >/dev/null 2>&1 && echo "build OK" || { echo "BUILD FAILED"; exit 1; }

echo "=== tests ==="
pnpm vitest run server/webhooks/stripe-plan-detection.test.ts server/auth.logout.test.ts 2>&1 | tail -4

echo "=== commit + push ==="
git add server/email-service.ts scripts/check-mail-env.sh scripts/deploy-status.sh scripts/gate-and-ship-resend.sh
git commit -m "feat: send transactional email via Resend (Method 0)

RESEND_API_KEY is the only mail credential in Vercel production; the
Gmail SMTP/OAuth paths silently no-op there, so purchase access emails,
dunning notices and abandoned-checkout recovery never sent. Resend uses
the verified authichain.com domain (SPF+DKIM+DMARC) and falls back to
the existing Gmail methods on failure.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main 2>&1 | tail -3
echo "push exit: $?"
