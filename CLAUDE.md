# AuthiChain Unified — AI Context & Development Guide

## 🤖 AI Coordination
This project is optimized for Agentic Workflows. When assisting, adhere to the **Truth Layer** principles:
1. **Observe**: Verify physical state via Vision/QR.
2. **Classify**: Map to one of 10 industry verticals via AI AutoFlow.
3. **Act**: Generate assets, mint NFTs, or trigger outreach.
4. **Log**: Record every action to the immutable Supabase ledger.

## 🛠 Essential Commands
- **Install**: `pnpm install`
- **Dev**: `pnpm dev` (Vite + Express)
- **Check**: `pnpm check` (Type-safety verification)
- **Build**: `pnpm build`
- **Deploy Workers**: `wrangler deploy` (run from /workers/ subfolders)
- **Deploy DB**: `supabase db push` (run from /authichain)

## 🏗 Architecture
- **Frontend**: React + tRPC + Tailwind + Shadcn UI.
- **Backend**: Node.js Express (Serverless on Vercel).
- **Edge**: 1 root Cloudflare Worker (`worker/index.ts`, deployed by `.github/workflows/deploy-cloudflare.yml`) + 22 deployed standalone workers under `workers/<name>/` (all deployed, all in CI via `.github/workflows/deploy-workers.yml`). See `docs/superpowers/plans/worker-status-2026-04-27.md` for the per-worker inventory. Multi-tenant brand routing via Host-header dispatch.
- **Database**: Postgres (Supabase) + Drizzle ORM.
- **Blockchain**: Polygon (ERC-20 $QRON, ERC-721 Certificates) + BTC Ordinals.

## 🔑 Environment Variables
- `DATABASE_URL`: Supabase Session Pooler (Port 6543).
- `JWT_SECRET`: Standardized ecosystem token key.
- `STRIPE_SECRET_KEY`: V2 Dahlia version for Connect automation.
- `OPENAI_API_KEY`: GPT-4 Vision for AutoFlow.

## 🧪 Testing Patterns
- Use `vitest` for unit/integration tests.
- Always verify `.returning().id` for database inserts (Postgres style).
- Ensure all Hono workers are self-contained (Inlined Theme).
