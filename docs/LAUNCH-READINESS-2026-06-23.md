# Launch Readiness — 2026-06-23

Snapshot of what is code-complete vs. what still needs founder action (credentials
/ deploy access that can't live in the repo).

## ✅ Green — verified on `main`

| Gate | Status | Evidence |
|------|--------|----------|
| Type safety | ✅ | `pnpm check` (tsc --noEmit) clean |
| Production build | ✅ | `pnpm build` → `dist/public` (Vite SPA) + `dist/index.js` (server) |
| Unit/integration tests | ✅ | `pnpm test` — 435/435 passing |
| Standalone server runtime | ✅ | `node dist/index.js` serves SPA (`/`, client routes), static assets, `/api/*`, and proper 404s |

### What was repaired this session
- **Production build was fully broken** and is now fixed:
  - Tailwind v4 stylesheets reconciled to the installed v3 toolchain (gold "Protocol" theme preserved); `tailwind.config.ts` token mapping + `content` globs corrected.
  - 37 missing dependencies added (33 client shadcn/Radix + `pg`, `nodemailer`, `cookie`, `crisp-api` on the server). `pg`/`nodemailer` were genuine runtime gaps.
- **Standalone server didn't serve the web app** — `serveStatic()` was a no-op; added `express.static` + SPA fallback. Fixed an Express 5 `app.use("*")` boot crash in both prod and dev paths.
- Repo hygiene: removed 2 duplicate workers, archived `telegram`, redacted exposed credentials from the audit doc, closed security disclosure #352.
- Live data: 9 public CORS APIs + all 4 domain landing pages wired to the real DB (shipped earlier in the session).

## 🔑 Founder-only — required to go fully live

These need secrets / dashboard access that are intentionally not in the repo:

1. **Rotate exposed credentials** (repo is public; see `docs/SECURITY-REMEDIATION-CRITICAL.md`): Stripe webhook secret, Resend API key, 2× Telegram bot tokens, Groq key, plus the OpenAI + Supabase `service_role` keys that remain in git history.
2. **Stripe production keys** — set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` in the deploy env.
3. **Email** — provide `RESEND_API_KEY` / SMTP creds for outreach + transactional mail.
4. **Deploy the 5 ready workers** (`wrangler deploy` with `CLOUDFLARE_API_TOKEN`): autopilot, chain-data, license-issuer, qron-provenance, scan-validate.
5. **SBIR.gov account** — needed for the NSF SBIR pitch submission (per `LAUNCH_CHECKLIST.md`).

## 🟡 Known non-blockers
- ~22 open Dependabot PRs (minor/dev/python + a few major bumps like Stripe/Clerk/Drizzle). None gate launch; the build runs on current pins. The major bumps (`stripe` 17→22, `@clerk/nextjs` 5→7, `drizzle-orm` 0.33→0.45) need a deliberate review pass and should not be auto-merged.
