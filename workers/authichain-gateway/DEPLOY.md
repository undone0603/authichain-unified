# AuthiChain Gateway — Deployment Guide

## Prerequisites

1. **Wrangler Auth**: Run `wrangler login` (opens browser for OAuth)
2. **Platform**: Wrangler deploy works from any platform (uploads to Cloudflare edge)

## Step 1: Create KV Namespaces

```bash
cd workers/authichain-gateway

wrangler kv namespace create RATE_LIMITS
wrangler kv namespace create TENANT_CACHE
wrangler kv namespace create USAGE_BUFFER
```

Each command outputs an ID. Update `wrangler.toml` with the real IDs.

## Step 2: Set Secrets

```bash
wrangler secret put INTERNAL_SECRET
# Enter a strong random secret (shared with the Express backend)
```

Also set `INTERNAL_API_SECRET` in the Express backend's `.env` to match.

## Step 3: Deploy

```bash
wrangler deploy
```

## Step 4: Custom Domain

In Cloudflare Dashboard:
1. Go to Workers & Pages → authichain-gateway → Settings → Domains & Routes
2. Add custom domain: `api.authichain.com`
3. Cloudflare auto-provisions SSL

## Step 5: Verify

```bash
curl https://api.authichain.com/health
# Should return: {"status":"ok","version":"2.0.0","timestamp":"..."}

curl https://api.authichain.com/api/v2/pricing
# Should return pricing tiers
```

## Environment Variables (wrangler.toml)

- `BACKEND_URL`: Express backend URL (default: https://authichain-unified.vercel.app)
- `WORKER_VERSION`: Semantic version string

## Architecture

```
Client → api.authichain.com (CF Worker)
                ↓
         Auth (KV cache) → Rate Limit (KV) → Proxy → Express backend
                                                         ↓
                                                    Metering (KV buffer)
                                                         ↓ (cron 5min)
                                                    Stripe billing
```
