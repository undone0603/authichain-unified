#!/bin/bash

# Validate local stripe keys
if [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "Error: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set."
  exit 1
fi

echo "Stripe keys validated."

# Pull from Vercel
echo "Pulling environment variables from Vercel..."
vercel env pull .env.local --yes
