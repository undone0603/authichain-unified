# AuthiChain API Pricing

## Overview

AuthiChain uses usage-based pricing with a monthly base fee. Each API call is metered and billed per-unit based on your tier.

## Tiers

### Free Tier
- **Cost**: $0/month
- **Limits**: 10 verifications/day
- **Features**: Basic product verification only
- **Rate Limit**: 5 requests/minute
- **Use Case**: Testing, evaluation, hobby projects

### Starter — $49/month
- **Verify**: $0.02/call
- **QR Generate**: $0.05/call
- **AI Analysis**: $0.10/call
- **Rate Limit**: 30 requests/minute, 5,000/day
- **Features**: Full verification, QR generation, basic analytics
- **Use Case**: Small businesses, startups, single-brand operations

### Professional — $199/month
- **Verify**: $0.008/call
- **QR Generate**: $0.03/call
- **AI Analysis**: $0.05/call
- **Rate Limit**: 60 requests/minute, 20,000/day
- **Features**: All Starter + batch operations, webhooks, priority support
- **Use Case**: Growing brands, multi-product lines, agencies

### Enterprise — $799/month
- **Verify**: $0.003/call
- **QR Generate**: $0.01/call
- **AI Analysis**: $0.02/call
- **Rate Limit**: 200 requests/minute, 100,000/day
- **Features**: All Professional + NFT minting, white-label, SLA, dedicated support
- **Use Case**: Large manufacturers, enterprise supply chains, platform integrators

## What Counts as a Call?

| Endpoint | Description | Metered As |
|----------|-------------|-----------|
| `/verify` | Product authenticity check | verify |
| `/qr/generate` | QRON art generation | qr_generate |
| `/trust-score` | Trust score computation | verify |
| `/cannabis/verify` | Strain verification | verify |
| `/certificates/verify` | Certificate lookup | verify |
| `/products/register` | New product registration | verify |
| `/analytics` | Usage analytics | Not metered |

## Volume Discounts

For usage exceeding 100,000 calls/month, contact sales@authichain.com for custom pricing. Typical discounts:
- 100K-500K calls: 20% off per-call rates
- 500K-1M calls: 35% off per-call rates
- 1M+ calls: Custom contract

## Billing

- Monthly billing via Stripe
- Usage calculated at end of billing period
- Overage automatically billed at tier rate (no service interruption)
- 14-day free trial on Starter and Professional tiers
- Annual plans: 2 months free (pay for 10, get 12)

## White-Label Pricing

Enterprise customers can resell AuthiChain verification under their own brand:
- Custom domain (e.g., verify.yourbrand.com)
- Branded QRON codes with your logo
- Custom API key prefix
- Separate analytics dashboard per sub-tenant
- Revenue share model available (contact sales)

## Getting Started

1. Sign up at authichain.com/developers
2. Get your API key (starts with `ac_live_`)
3. Make your first verification call
4. View usage in the developer dashboard
5. Upgrade when ready for production volume
