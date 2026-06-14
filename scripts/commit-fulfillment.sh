#!/usr/bin/env bash
set -u
cd /home/zac/authichain-unified

git add server/db.ts server/webhooks/stripe.ts server/_core/oauth.ts
git commit -m "feat: fulfil payment-link purchases via email-based provisioning

Payment links created in the Stripe dashboard carry no user_id metadata,
so resolveUserId() returned undefined and upsertStripeSubscription was
skipped: buyers paid and nothing was provisioned.

- webhook: resolveOrProvisionUser falls back to the customer email and
  find-or-creates a placeholder user (loginMethod=stripe)
- checkout.session.completed: provisions the buyer, records one-time
  (mode=payment) revenue which previously was never recorded, and sends
  a transactional access email
- oauth callback: claims placeholder users (re-points subscriptions,
  copies stripeCustomerId) on first Google sign-in with the same email

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"

git add scripts/flagship-buy-path-audit.sh scripts/flagship-chunks-audit.sh \
        scripts/webhook-endpoints-smoke.sh scripts/set-webhook-secret.sh \
        scripts/find-vercel-token.sh scripts/vercel-login-email.sh \
        scripts/test-fulfillment.sh scripts/commit-fulfillment.sh
git commit -m "chore: revenue-path audit and ops scripts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"

git log --oneline -3
git push origin main 2>&1 | tail -5
echo "push exit: $?"
