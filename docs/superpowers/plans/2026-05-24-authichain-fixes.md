# AuthiChain.com Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 outstanding issues — security vulns, broken root worker, Stripe checkout wiring, verify page, config gaps, and MICROSITES_KV — then verify authichain.com visually.

**Architecture:** Most fixes are isolated file edits. Security updates go via pnpm. Stripe payment links are created via API and embedded as literals in the worker. MICROSITES_KV is provisioned via Cloudflare MCP.

**Tech Stack:** pnpm, Next.js 15, Cloudflare Workers (Hono), Stripe, Cloudflare KV MCP

---

## Task 1 (Most Complex): Security Vulnerabilities

**Files:**
- Modify: `package.json`

Key vulns:
- `undici` HIGH — unbounded decompression (transitive via wrangler/miniflare)
- `nodemailer` LOW — SMTP injection, fix: upgrade to >=8.0.4
- `postcss` MODERATE — XSS via `</style>`, fix: upgrade
- `vite` MODERATE — path traversal in optimized deps
- `ws` MODERATE — uninitialized memory disclosure
- `esbuild` MODERATE — transitive (drizzle-kit, wrangler)

- [ ] Run `pnpm update nodemailer vite postcss ws --latest`
- [ ] Run `pnpm audit` — verify high/critical count drops
- [ ] Commit

---

## Task 2: Fix `worker/index.ts` Bugs

**Files:**
- Modify: `worker/index.ts`

Three bugs:
1. `cssVars` uses escaped `\${b.bg}` — CSS vars never interpolate
2. `MARKETING_HTML` referenced but never defined — runtime crash on apex `/`
3. `createHmac` used but never imported — webhook handler crashes

Fix 1: Change all `\${b.x}` → `${b.x}` in cssVars (use backtick template properly)
Fix 2: Add `const MARKETING_HTML = ...` before `app.all("*")`
Fix 3: Replace `createHmac(...)` with Web Crypto HMAC: `await crypto.subtle.sign(...)`

- [ ] Fix cssVars template literals, add MARKETING_HTML const, replace createHmac with Web Crypto
- [ ] `pnpm check` — confirm TypeScript passes
- [ ] Commit

---

## Task 3: Stripe Checkout on authichain.com

**Files:**
- Modify: `workers/authichain-com/src/index.ts`

Real Stripe prices (from Stripe):
- Starter: `price_1TWcdFGqTruSqV8TAowGYKIo` — $199/mo
- Professional: `price_1TWcdHGqTruSqV8T3OvHngUZ` — $499/mo
- Enterprise: `price_1TWcdIGqTruSqV8TfQGUAH2q` — $999/mo

Steps:
- [ ] Create 3 Stripe payment links (one per price) via MCP
- [ ] Update pricing section in worker: fix prices ($199/$499/$999), swap CTA hrefs to payment link URLs
- [ ] Commit

---

## Task 4: Wire `/verify/[productId]` Page

**Files:**
- Modify: `src/app/verify/[productId]/page.tsx`

Current state: static spinner, never fetches. Needs to call the edge worker `/verify/:id` endpoint.
Worker endpoint: `https://authichain.com/verify/:id` returns `{ status, name, sku, tenant_id, verified_at }` or 404.

- [ ] Convert to async Server Component, fetch from worker, render authentic/not-found states
- [ ] `pnpm check` — confirm types pass
- [ ] Commit

---

## Task 5: Fix `next.config.ts` serverActions Origins

**Files:**
- Modify: `next.config.ts`

`serverActions.allowedOrigins` only has `qron.space` / `www.qron.space`. Missing `authichain.com`, `strainchain.io`, `govchain.us`.

- [ ] Add the 6 missing origins
- [ ] Commit

---

## Task 6: Create MICROSITES_KV + Fix `wrangler.toml`

**Files:**
- Modify: `wrangler.toml`

MICROSITES_KV namespace doesn't exist yet. Create via Cloudflare MCP, then replace placeholder ID.

- [ ] Create KV namespace `MICROSITES_KV` via Cloudflare MCP
- [ ] Replace `REPLACE_WITH_YOUR_MICROSITES_KV_ID` in `wrangler.toml` with real ID
- [ ] Commit

---

## Task 7: Push + Test authichain.com

- [ ] Push all commits
- [ ] Wait for CI/CD deploy (~2 min)
- [ ] Open authichain.com in browser via claude-in-chrome
- [ ] Verify: nav links, hero CTAs, pricing section prices match Stripe, no JS errors
