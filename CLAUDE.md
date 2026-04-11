# AuthiChain Unified — Development Guide

## What This Is

Blockchain-powered product authentication protocol — the "truth layer for the physical world." Manufacturers mint ERC-721 NFTs tied to physical products on Polygon. Consumers scan QRON QR codes to verify authenticity. Each scan is ES256-signed, recorded on-chain, and triggers $QRON Scan-to-Earn rewards.

**Three brands, one codebase:**
- **authichain.com** — B2B enterprise product authentication (trust layer, compliance)
- **qron.space** — Consumer-facing AI art QR generator (self-serve, product-led growth)
- **strainchain.io** — Cannabis vertical (seed-to-sale, dispensary SaaS)

## Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + Radix UI + Framer Motion
- **Backend:** Express + tRPC (30+ namespaces) + Drizzle ORM
- **Database:** PostgreSQL (42 tables), Cloudflare D1 (edge), KV (sessions), R2 (images)
- **Blockchain:** Polygon (ERC-721 via Thirdweb), Hardhat for contract dev
- **AI:** fal.ai (illusion-diffusion for QR art), OpenAI (classification), Anthropic
- **Payments:** Stripe (live keys), Paddle
- **Email:** Resend, SendGrid
- **CRM:** HubSpot
- **Deployment:** Vercel (primary), Cloudflare Workers (edge functions)

## Key Commands

```bash
pnpm dev          # Start dev server (tsx watch)
pnpm build        # Vite build + esbuild server bundle
pnpm start        # Production server
pnpm check        # TypeScript typecheck
pnpm test         # Vitest
pnpm db:push      # Generate + run Drizzle migrations
```

## Project Structure

```
client/src/pages/   — 28 page components (Dashboard, Pricing, NftMarketplace, etc.)
client/src/components/ — UI component library (Radix-based)
server/             — Express + tRPC backend (50+ modules)
server/routers.ts   — tRPC router aggregation
server/db.ts        — Drizzle DB connection
server/scheduled-jobs.ts — 8 cron jobs
shared/             — Shared types/schemas between client & server
drizzle/            — Migration files
contracts/          — Solidity smart contracts (AuthiChainNFT.sol)
```

## Critical Files

- `server/_core/index.ts` — Express entry point
- `server/routers.ts` — All tRPC routers merged
- `server/db.ts` — Database connection
- `server/stripe-service.ts` — Stripe billing
- `server/qron-service.ts` — QRON generation service
- `server/character-service.ts` — AuthiCharacter AI generation
- `client/src/pages/Home.tsx` — Landing page
- `client/src/pages/Pricing.tsx` — Pricing + Stripe checkout
- `client/src/pages/QrCodes.tsx` — QR code generation UI
- `client/src/pages/NftMarketplace.tsx` — NFT marketplace
- `shared/` — Shared schemas, types, validation

## Five-Agent Protocol

AuthiChain uses 5 AI agents for product verification consensus:

| Agent | Weight | Role |
|-------|--------|------|
| Guardian | 35% | Cryptographic hash validation, anti-counterfeit |
| Archivist | 20% | Provenance history, SKU truth graph |
| Sentinel | 25% | Anomaly detection, geographic clustering |
| Scout | 8% | Product classification, AI AutoFlow |
| Arbiter | 12% | Final consensus adjudication |

## QRON Art Generation

11 style modes using fal.ai illusion-diffusion ($0.006/run):
1. Cosmic Nebula, 2. Cyberpunk, 3. Watercolor, 4. Holographic Mosaic, 5. Teal Pulse,
6. Medieval/Fantasy, 7. Anime/Manga, 8. Architectural, 9. Echo QR, 10. Video QR, 11. Phantom QR

Key param: `controlnet_conditioning_scale: 1.0-1.5` for scannability.
Custom LoRA trigger word: **qronart**

## Pricing Tiers

**QRON (Consumer):** Free (5/day) | Pro $29/mo | Business $99/mo
**AuthiChain (B2B):** Starter $49/mo (100 seals) | Professional $149/mo (500) | Enterprise $499/mo (unlimited)
**StrainChain:** Starter $29/mo | Professional $99/mo | Enterprise $299/mo

## Stripe (LIVE)

- Price IDs: standard=`price_standard_9_month`, premium=`price_premium_49_month`, ultra=`price_ultra_199_month`
- Webhook secret configured in env

## Cloudflare Resources

- D1 Database ID: `ebd8081b-ac13-485a-8b0e-a6cd9c0f7be5`
- R2 Bucket: `qron-images`
- Account: `4c1869b90f13f86940aa3747839bf420`

## Critical Constraints

- Never expose private keys, service role keys, or Stripe secrets in client code
- Use `getUser()` instead of deprecated `getSession()` for Supabase auth
- Don't modify contract addresses without redeploying
- Edge Runtime conflicts with fal.ai client — use server-side Node.js runtime for generation routes
- All scan events must be ES256-signed JWS

## $QRON Token

- 1B fixed supply, Polygon mainnet
- Revenue-backed emissions via Rewards Budget Contract
- XP: +50 first scan, +10 per verification, +100 counterfeit report, +70 7-day streak
- Staking: 2% subscription discount at 1K staked

## StrainChain Specifics

- CannabisStrainNFT.sol — strain metadata (THC/CBD basis points, terpene profile, lab cert hash)
- PackageArtNFT.sol — Bagiez vintage packaging art with territory licensing
- Royalties: 70% artist / 20% platform / 10% community treasury (primary sale)
- POS integration targets: BioTrack, METRC

## Governance

- AI CAN: write/test code, run scans, calculate rewards, monitor, generate content drafts
- Requires Human: deploy contracts, sign transactions, change parameters, access treasury
- Safe multisig: 3/5 standard, 2/5 emergency, 4/5 critical
