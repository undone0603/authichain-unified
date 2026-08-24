# ADR-001: Canonical Deploy Target & Auth Strategy

**Status**: Accepted  
**Date**: 2026-08-17  
**Author**: AuthiChain Engineering

---

## Context

The repository simultaneously contains configuration for multiple runtimes:

| File / Dir | Runtime |
|------------|---------|
| `next.config.js` + `src/app/` | Next.js 15 App Router |
| `vite.config.ts` + `client/` | Vite SPA |
| `server/_core/index.ts` | Express (tsx) |
| `open-next.config.ts` | OpenNext → Cloudflare |
| `wrangler.toml` + `workers/` | Cloudflare Workers |

This ambiguity caused production incidents where Vercel was set to "Next.js" framework instead of "Vite", resulting in JS/CSS assets returning `text/html` (white screen).

Similarly, three auth libraries coexist: `@clerk/nextjs`, `lucia`, and `@auth/core`.

---

## Decision

### Deploy Target

**Primary production deploy = Next.js 15 via Vercel (framework: Next.js).**

- `next build` is the canonical build step.
- Vercel project setting: **Framework = Next.js** (not Vite, not Other).
- The `dist/` output from `vite build` is for the **standalone SPA** (Living Product Pages microsite) only, deployed separately to Cloudflare Workers via `pnpm deploy:cf`.
- The Express server (`server/_core/`) is for **local dev / Railway** only. It is NOT the production path.

### Auth Strategy

**Primary auth = Clerk (`@clerk/nextjs`)** for all user-facing flows.

- Clerk handles: sign-up, sign-in, session management, JWT issuance.
- `lucia` and `@auth/core` remain as dead code until they are removed in a future cleanup sprint.
- Do NOT add new auth logic using Lucia or Auth.js. All new auth code must go through `@clerk/nextjs`.

---

## Consequences

- CI runs `pnpm next:build` to validate Next.js build.
- Vite build is kept for the SPA/microsite path only.
- `lucia` and `@auth/core` will be removed in a dedicated cleanup PR (see todo).
- `pg` driver will be removed in favour of `postgres` (postgres.js) which is already used by Drizzle.

---

## Alternatives Considered

- **Migrate fully to Vite SPA** — rejected because App Router server components and API routes are required for HubSpot webhooks, Stripe webhooks, and server-side auth.
- **Migrate fully to self-hosted auth (Lucia)** — rejected because Clerk provides better DX, fraud protection, and multi-domain support out of the box.
