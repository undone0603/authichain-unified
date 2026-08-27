# Cloudflare Hybrid Frontend — Phase 2-3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve authichain-unified entirely from Cloudflare's free tier by unifying (a) the Next.js marketing site as a *static snapshot*, (b) the Vite SPA as the authenticated app, and (c) a handful of dynamic public routes as lean Hono handlers — all behind the single `worker-app` Worker, so Vercel can be deleted.

**Architecture:** `next build` prerenders ~61 marketing pages to standalone HTML (+ `_next/static` chunks). A build pipeline merges that snapshot with the Vite SPA build (`dist/public`) into one Cloudflare assets directory. `worker-app/index.ts` routes each request: marketing paths → prerendered HTML; `/_next/static/*` → Next chunks; app paths → SPA `index.html` (wouter client routing); the few dynamic public paths → Hono handlers reading tRPC/db; `/` → per-brand static HTML by `Host`. Existing `/api/*`, tRPC, webhooks, and cron dispatch (Tasks 1-8) are unchanged.

**Tech Stack:** Next.js 15.5.18 (build-time SSG only), Vite (SPA, wouter routing), Hono on workerd, Cloudflare Workers Static Assets binding, Hyperdrive, Drizzle.

## Global Constraints

- **Free tier only.** No OpenNext, no Workers Paid. The merged assets directory + worker bundle must stay within free-tier limits (worker script < 3 MiB gzipped; static assets are separate and effectively unbounded for this size).
- **Do not run the Next.js server runtime anywhere.** Next.js is used ONLY as a build-time static generator. Dynamic Next.js RSC pages are NOT executed at runtime — they are either reclassified to the SPA or re-implemented as lean Hono handlers.
- **Do not regress Tasks 1-8.** The existing `worker-app/index.ts` API/tRPC/webhook/cron routes, `worker-app/rate-limiter.ts`, and the 521-test Node vitest suite + `worker-app/**/*.test.ts` must stay green. Additive changes only to the request-routing layer.
- **Single assets directory.** Cloudflare's `[assets]` binding supports exactly ONE `directory`. Everything servable (SPA + marketing HTML + `_next/static`) must be merged into it by the build pipeline; the worker does not read from two asset roots.
- **Deterministic route ownership.** Every incoming path resolves to exactly one owner (marketing-static | spa | dynamic-handler | api) via an explicit, reviewable manifest — never an ambiguous fallthrough.
- **Reversibility.** Nothing in Phase 2-3 touches DNS, deletes Vercel, or enables cron triggers. Those are Phase 4-5, gated on explicit user go.

---

## File Structure

- `scripts/build-marketing-snapshot.mjs` (new) — runs `next build`, extracts prerendered marketing HTML + `_next/static` into `dist/marketing/`.
- `scripts/merge-assets.mjs` (new) — merges `dist/public` (Vite SPA) + `dist/marketing/` into `dist/site/` (the unified assets root), and emits `dist/site/_routes.json`-style ownership metadata consumed by the worker.
- `worker-app/route-manifest.ts` (new) — the explicit route-ownership manifest (marketing paths, SPA-owned collision overrides, dynamic-handler paths) as typed data the worker imports.
- `worker-app/dynamic-pages.ts` (new) — the lean Hono handlers for the SEO-relevant dynamic public routes (re-implementing what the retired Next RSC pages rendered, using tRPC/db + a minimal HTML template).
- `worker-app/index.ts` (modify) — replace the single `app.get("*", ASSETS.fetch)` fallback with the manifest-driven router (marketing HTML → static; app → SPA index.html; dynamic → handlers).
- `worker-app/wrangler.toml` (modify) — point `[assets].directory` at `../dist/site`, add `html_handling`/`not_found_handling` config.
- `package.json` (modify) — add `build:site` script chaining the snapshot + merge + vite build.

---

## Phase 2 — Static snapshot build pipeline

### Task 2.1: Marketing snapshot extractor

**Files:**
- Create: `scripts/build-marketing-snapshot.mjs`
- Create: `scripts/__tests__/build-marketing-snapshot.test.ts` (or the repo's script-test location — match existing convention)

**Interfaces:**
- Produces: a `dist/marketing/` directory containing, for each prerendered marketing route `/x/y`, a file `dist/marketing/x/y.html`, plus `dist/marketing/_next/static/**` copied verbatim from `.next/static/`. Emits `dist/marketing/marketing-manifest.json` = `{ routes: string[] }` listing every marketing route path (e.g. `["/about","/pricing","/authichain/about", ...]`, without the `.html` suffix, `/` excluded — `/` is handled per-brand in Task 3.4).

- [ ] **Step 1: Write the failing test**

Assert the extractor, given a fixture `.next/` tree (a couple of `server/app/*.html` files + a `static/` dir), copies them into `dist/marketing/` at the right paths and writes `marketing-manifest.json` with the expected route list. Use a temp dir fixture; do not depend on a real `next build`.

```ts
// drives buildMarketingSnapshot({ nextDir, outDir }) — pure fs transform, no next invocation
import { buildMarketingSnapshot } from '../build-marketing-snapshot.mjs';
// fixture: nextDir/server/app/about.html, nextDir/server/app/authichain/about.html, nextDir/static/chunks/x.js
const manifest = await buildMarketingSnapshot({ nextDir, outDir });
expect(fs.existsSync(`${outDir}/about.html`)).toBe(true);
expect(fs.existsSync(`${outDir}/authichain/about.html`)).toBe(true);
expect(fs.existsSync(`${outDir}/_next/static/chunks/x.js`)).toBe(true);
expect(manifest.routes).toContain('/about');
expect(manifest.routes).toContain('/authichain/about');
expect(manifest.routes).not.toContain('/'); // per-brand, handled separately
```

- [ ] **Step 2: Run the test, verify it fails** (module not found).

- [ ] **Step 3: Implement `buildMarketingSnapshot({ nextDir, outDir })`**

Export a pure function (so it's testable without invoking Next) plus a CLI wrapper (`if (import.meta.url === ...) runs next build then the transform`). The transform:
1. Walk `nextDir/server/app/**/*.html`. EXCLUDE anything under `.../api/`. EXCLUDE the dynamic routes (Task 3.1 owns those) by consulting an exclusion set passed in — for 2.1, exclude exactly the 16 dynamic routes identified by the build (`/`, `/admin/products`, `/auth/callback`, `/billing/upgrade-required`, `/brand/qron/artwork/[id]`, `/dashboard`, `/dashboard/qron/[id]`, `/gallery`, `/grants`, `/og`, `/reveal/[id]`, `/robots.txt`, `/s/[shortcode]`, `/sitemap.xml`, `/status`, `/verify`) and the SPA-owned collision overrides from Task 3.1. For 2.1, accept the exclusion set as a parameter defaulting to the 16 dynamic routes; the merge/manifest in Task 3.1 refines it.
2. Copy each surviving `<route>.html` to `outDir/<route>.html` (preserving nested dirs).
3. Copy `nextDir/static/**` → `outDir/_next/static/**` verbatim.
4. Write `outDir/marketing-manifest.json` = `{ routes: [...] }` (route = path with leading `/`, `.html` stripped, `index` normalized).
The CLI wrapper: `execSync('next build', { stdio: 'inherit' })` then call the transform with `nextDir='.next'`, `outDir='dist/marketing'`.

- [ ] **Step 4: Run the test, verify it passes.**

- [ ] **Step 5: Smoke-test the CLI against a real build** (the spike build already populated `.next/`): `node scripts/build-marketing-snapshot.mjs` and confirm `dist/marketing/` has ~61 `.html` files, a populated `_next/static/`, and a manifest with ~55 routes (61 minus any SPA-override collisions). Report the counts.

- [ ] **Step 6: Commit.** `git add scripts/build-marketing-snapshot.mjs scripts/__tests__/... && git commit --no-verify -m "feat(cf): marketing static-snapshot extractor"`

### Task 2.2: Unified assets merge

**Files:**
- Create: `scripts/merge-assets.mjs`
- Create: `scripts/__tests__/merge-assets.test.ts`
- Modify: `package.json` (add scripts)

**Interfaces:**
- Consumes: `dist/public/` (Vite SPA build — has `index.html`, `assets/`, favicons, `robots.txt`, `sitemap.xml`, `domains/`, `gallery/`), and `dist/marketing/` (from Task 2.1, with `marketing-manifest.json`).
- Produces: `dist/site/` = the single Cloudflare assets root. Contains the SPA `index.html` at `/index.html`, SPA `assets/**`, the marketing `*.html` at their route paths, and `_next/static/**`. On any file-path collision between SPA and marketing (e.g. both ship `robots.txt`/`sitemap.xml`), MARKETING wins for `robots.txt`/`sitemap.xml` is WRONG — see Step 3: these specific SEO files must come from the source of truth decided in Task 3.1; default: keep the SPA's existing `robots.txt`/`sitemap.xml` (they are brand-aware) and DROP the Next `/robots.txt`,`/sitemap.xml` dynamic routes. Also copies `dist/marketing/marketing-manifest.json` → `dist/site/marketing-manifest.json`.

- [ ] **Step 1: Write the failing test**

```ts
import { mergeAssets } from '../merge-assets.mjs';
// fixtures: spaDir/{index.html, assets/app.js, robots.txt}, mktDir/{about.html, _next/static/x.js, marketing-manifest.json}
await mergeAssets({ spaDir, mktDir, outDir });
expect(read(`${outDir}/index.html`)).toBe(read(`${spaDir}/index.html`)); // SPA shell preserved
expect(fs.existsSync(`${outDir}/about.html`)).toBe(true);                // marketing page present
expect(fs.existsSync(`${outDir}/_next/static/x.js`)).toBe(true);        // chunks present
expect(read(`${outDir}/robots.txt`)).toBe(read(`${spaDir}/robots.txt`)); // SPA robots wins
```

- [ ] **Step 2: Run the test, verify it fails.**

- [ ] **Step 3: Implement `mergeAssets({ spaDir, mktDir, outDir })`**

1. `rm -rf outDir`; recursively copy `spaDir` → `outDir` (SPA is the base layer, keeps `index.html`, `assets/`, `robots.txt`, `sitemap.xml`).
2. Recursively copy `mktDir` → `outDir` but SKIP `robots.txt` and `sitemap.xml` at the mkt root (SPA versions win) and SKIP `marketing-manifest.json` (copied explicitly in step 3). All `*.html` and `_next/**` overlay in.
3. Copy `mktDir/marketing-manifest.json` → `outDir/marketing-manifest.json`.
4. There is no `index.html` collision to worry about: Task 2.1 excludes `/` from marketing (per-brand), so the SPA `index.html` is the only root `index.html`.

- [ ] **Step 4: Run the test, verify it passes.**

- [ ] **Step 5: Add `package.json` scripts** and smoke-test end to end:
```json
"build:marketing": "node scripts/build-marketing-snapshot.mjs",
"build:site": "vite build && node scripts/build-marketing-snapshot.mjs && node scripts/merge-assets.mjs"
```
`merge-assets.mjs` CLI defaults: `spaDir=dist/public`, `mktDir=dist/marketing`, `outDir=dist/site`. Run `pnpm build:site` (uses the existing `.next/` if `build-marketing-snapshot` is fast-pathed, else full) and confirm `dist/site/` has SPA `index.html` + `assets/`, ~55 marketing `.html`, `_next/static/`, and `marketing-manifest.json`. Report `du -sh dist/site` and the file counts.

- [ ] **Step 6: Commit.** `git add scripts/merge-assets.mjs scripts/__tests__/... package.json && git commit --no-verify -m "feat(cf): unified assets merge (SPA + marketing snapshot)"`

---

## Phase 3 — worker-app manifest-driven routing

> **PRE-FLIGHT DECISION (surface to human before Task 3.1):** the 7 colliding top-level segments claimed by BOTH the Vite SPA (wouter) and the Next marketing static build are: `/admin`, `/dashboard`, `/demo`, `/pricing`, `/qr-codes`, `/supply-chain`, `/white-label`. Default proposed ownership: `/admin` and `/dashboard` → **SPA** (authenticated app); `/demo`, `/pricing`, `/qr-codes`, `/supply-chain`, `/white-label` → **marketing static** (public/SEO), with the SPA reaching its own view of those only via in-app client-side nav. Confirm this split (or amend) before building the manifest.

### Task 3.1: Route-ownership manifest

**Files:**
- Create: `worker-app/route-manifest.ts`
- Create: `worker-app/route-manifest.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SPA_OWNED_PREFIXES: string[];        // e.g. ["/admin","/dashboard","/authenticate","/certificates","/nft", ...] — app routes served by the SPA shell
  export const DYNAMIC_HANDLER_PATHS: Set<string>;  // exact paths handled by worker-app/dynamic-pages.ts (Task 3.3): "/verify","/status","/grants","/gallery","/reveal","/s","/p","/brand/qron/artwork"
  export function resolveOwner(pathname: string, marketingRoutes: Set<string>):
    "api" | "dynamic" | "spa" | "marketing" | "spa-fallback";
  ```
  Resolution order (first match wins): `/api/` or `/_next/` prefix → handled elsewhere (return `"api"` sentinel for `/api`, marketing-static passthrough for `/_next`); exact/prefix match in `DYNAMIC_HANDLER_PATHS` → `"dynamic"`; prefix match in `SPA_OWNED_PREFIXES` → `"spa"`; exact match in `marketingRoutes` → `"marketing"`; else `"spa-fallback"` (unknown paths go to the SPA shell for wouter to resolve/404).

- [ ] **Step 1: Write failing tests** covering each branch: `resolveOwner("/about", mkt)==="marketing"`, `resolveOwner("/dashboard", mkt)==="spa"`, `resolveOwner("/verify", mkt)==="dynamic"`, `resolveOwner("/pricing", mkt)==="marketing"`, `resolveOwner("/some-unknown", mkt)==="spa-fallback"`, `resolveOwner("/api/trpc/x", mkt)==="api"`. Build `mkt` from the confirmed marketing route list.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the constants (from the confirmed pre-flight decision + the SPA's wouter route list in `client/src/App.tsx`) and `resolveOwner`.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.** `git commit --no-verify -m "feat(cf): route-ownership manifest"`

### Task 3.2: Wire static + SPA routing into worker-app

**Files:**
- Modify: `worker-app/index.ts` (replace the final `app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw))` at line ~790)
- Modify: `worker-app/wrangler.toml` (`[assets].directory = "../dist/site"`; add `[assets] html_handling = "auto-trailing-slash"`, `not_found_handling = "single-page-application"` — verify exact keys against current wrangler schema)
- Test: extend `worker-app/routes.test.ts`

**Interfaces:**
- Consumes: `route-manifest.ts` (`resolveOwner`) + `dist/site/marketing-manifest.json` (load the marketing route set — import as a build artifact or fetch `ASSETS.fetch('/marketing-manifest.json')` once and cache).

- [ ] **Step 1: Write failing tests** in `routes.test.ts`: a request to `/about` serves the marketing HTML (ASSETS fetch for `/about.html`); a request to `/dashboard` serves the SPA `index.html`; `/_next/static/x.js` passes through to ASSETS; existing `/api/health` and tRPC routes still work (regression).
- [ ] **Step 2: Run, verify the new ones fail, existing pass.**
- [ ] **Step 3: Implement** the fallback replacement:
```ts
app.get("*", async (c) => {
  const { pathname } = new URL(c.req.url);
  if (pathname.startsWith("/_next/")) return c.env.ASSETS.fetch(c.req.raw);
  const owner = resolveOwner(pathname, await getMarketingRoutes(c.env));
  if (owner === "dynamic") return renderDynamicPage(c);            // Task 3.3
  if (owner === "marketing") {                                      // serve prerendered HTML
    const res = await c.env.ASSETS.fetch(new Request(new URL(pathname.replace(/\/$/, "") + ".html", c.req.url), c.req.raw));
    if (res.status === 200) return res;
  }
  // "spa" | "spa-fallback" | marketing-miss → SPA shell (index.html) for wouter
  return c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url), c.req.raw));
});
```
Keep the brand middleware and all `/api/*` routes above this untouched. `getMarketingRoutes` loads+caches the manifest.
- [ ] **Step 4: Run tests, verify all pass** (new + regression). Also run the full `pnpm vitest run` — 521 + worker-app tests still green.
- [ ] **Step 5: `wrangler dev` smoke test** against `dist/site`: curl `/about` (expect marketing HTML with `<title>` from Next), `/dashboard` (expect SPA shell), `/_next/static/<a real chunk>` (expect 200 JS), `/api/health` (expect `{status:"ok"}`). Report each.
- [ ] **Step 6: Commit.** `git commit --no-verify -m "feat(cf): manifest-driven static+SPA routing in worker-app"`

### Task 3.3: Dynamic public page handlers

**Files:**
- Create: `worker-app/dynamic-pages.ts`
- Test: `worker-app/dynamic-pages.test.ts`

**Interfaces:**
- Produces: `export async function renderDynamicPage(c): Promise<Response>` — dispatches by pathname to a per-route renderer.

**Classification of the 16 dynamic routes (confirm at pre-flight):**
- **Trivial / already handled elsewhere:** `/robots.txt`, `/sitemap.xml` → served from SPA static (Task 2.2 keeps SPA versions); `/og` → OG-image, defer (low priority; can 404 or proxy). `/s/[shortcode]` → shortlink **redirect** (look up code in db, 302). `/auth/callback` → already covered by the OAuth flow / SPA.
- **App → SPA (no handler needed):** `/dashboard`, `/dashboard/qron/[id]`, `/admin/products`, `/billing/upgrade-required` → `SPA_OWNED_PREFIXES` in Task 3.1.
- **SEO-relevant dynamic → real Hono render (this task):** `/verify`, `/status`, `/grants`, `/gallery`, `/reveal/[id]`, `/brand/qron/artwork/[id]`, and the product passport `/p/[serial]`. Each: fetch the needed data via existing `server/` helpers or tRPC callers + `getHyperdriveDb(c.env)`, render a minimal semantic HTML document (title, meta description, the core content) — NOT a port of the full React page; enough for SEO + a functional public view, with a `<link rel="canonical">` and a script tag that boots the SPA for interactivity if desired.

- [ ] **Step 1: Write failing tests** for 2 representative renderers: `/s/<code>` returns a 302 to the stored URL (mock db helper); `/verify?serial=X` (or `/p/[serial]`) returns 200 HTML containing the product name / verification status (mock db). Keep tests Node-safe (mock `getHyperdriveDb`), matching how `routes.test.ts` avoids workerd.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement `renderDynamicPage`** with a switch on pathname prefix. Reuse existing helpers (`getCertificateByNumber`, product lookups, `getScheduledJobs` is unrelated) — grep `server/content-db-helpers.ts` and the tRPC routers for the exact data functions each page needs. Start with `/s/[shortcode]` (redirect) and `/p/[serial]` + `/verify` (the highest-value SEO/utility pages); stub the remainder (`/status`, `/grants`, `/gallery`, `/reveal`, `/brand/qron/artwork`) to serve the SPA shell for now and list them as follow-ups, UNLESS the pre-flight marks one as launch-critical.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: `wrangler dev` smoke** each implemented route against real Hyperdrive-local (reuse the Task 8 `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` pattern). Report.
- [ ] **Step 6: Commit.** `git commit --no-verify -m "feat(cf): dynamic public page handlers (verify/passport/shortlink)"`

### Task 3.4: Per-brand homepage by Host

**Files:**
- Modify: `worker-app/index.ts` (add an explicit `app.get("/", ...)` BEFORE the `*` fallback)
- Test: `worker-app/routes.test.ts`

**Background:** The Next `/` is `force-dynamic` only because it reads the `Host` header to pick a brand homepage (`resolveBrand(host)`). Brand is a pure function of hostname, so we prerender one static homepage per brand at build and route by `Host` — no runtime render.

- [ ] **Step 1:** Decide the source of the 4 brand homepages. Option A (preferred): the Vite SPA already renders per-brand homes client-side (`client/src/pages/Home.tsx` + brand context) → `/` just serves the SPA `index.html`, and the SPA picks the brand from `window.location.host`. Option B: prerender 4 static brand homepages via Next and select by Host. **Confirm which at pre-flight.** If Option A, this task reduces to: `resolveOwner("/")` → `"spa-fallback"` (SPA shell), and the SPA's existing brand logic handles it — verify the SPA reads host and renders the right brand home. Write a test asserting `/` with `Host: qron.space` serves the SPA shell (Option A) or the qron brand HTML (Option B).
- [ ] **Step 2-4:** Implement + test the chosen option.
- [ ] **Step 5: `wrangler dev` smoke:** curl `/` with `-H "Host: qron.space"`, `-H "Host: govchain.us"`, `-H "Host: strainchain.io"`, `-H "Host: authichain.com"`; confirm the correct brand renders. Report.
- [ ] **Step 6: Commit.** `git commit --no-verify -m "feat(cf): per-brand homepage routing by Host"`

### Task 3.5: Full-build integration verification

**Files:** none new — a verification task.

- [ ] **Step 1:** `pnpm build:site` (full: vite + next snapshot + merge). Confirm `dist/site` well-formed.
- [ ] **Step 2:** `wrangler dev` (pointing at `dist/site`, real Hyperdrive-local). Systematically curl one representative of EACH owner class and record status + a content assertion: marketing (`/about`, `/pricing`, `/vs/vechain`), SPA (`/dashboard`, `/certificates`), dynamic (`/verify`, `/p/<serial>`, `/s/<code>`), api (`/api/health`, a tRPC query), brand `/` (×4 hosts), `_next/static` chunk. 
- [ ] **Step 3:** Confirm no path 500s and no path is served by the WRONG owner (e.g. `/about` must NOT return the SPA shell). Produce a routing matrix (path → owner → status → assertion) as the task report.
- [ ] **Step 4:** Confirm worker bundle size via `wrangler deploy --dry-run --outdir /tmp/cfout` (or `wrangler dev` build output) is < 3 MiB gzipped. Report the size.
- [ ] **Step 5: Commit** any fixes. No commit if clean.

---

## Out of scope (Phase 4-5, gated on explicit user go)

- DNS / custom-domain route binding per domain (qron.space, govchain.us, strainchain.io, authichain.com) to `authichain-app`.
- Enabling GROUP A cron triggers in `wrangler.toml` (only at Vercel cutover, to avoid double-firing).
- Deleting the Vercel project.
- The deferred `/og` OG-image route, and full SSR ports of the stubbed dynamic pages (`/status`, `/grants`, `/gallery`, `/reveal`, `/brand/qron/artwork`) if pre-flight didn't mark them launch-critical.
- tRPC per-procedure rate limiting (pre-existing Task 7 follow-up).

## Self-Review notes (author)

- **Spec coverage:** Phase 2 (snapshot + merge) and Phase 3 (manifest, static/SPA routing, dynamic handlers, brand home, integration verify) cover the architecture. ✅
- **Two genuine decisions surfaced for pre-flight, not silently decided:** (1) ownership of the 7 colliding segments; (2) brand-home Option A vs B. Both are called out in-line and must be batched to the human before Task 3.1/3.4.
- **Honest risk:** the dynamic RSC pages cannot be "SSR'd" as-is — Task 3.3 re-implements the SEO-critical few and stubs the rest to the SPA shell. If any stubbed page turns out launch-critical for SEO, that's added scope.
- **Type consistency:** `resolveOwner` return union is used identically in Task 3.1 (definition) and Task 3.2 (consumption). `marketing-manifest.json` shape (`{routes:string[]}`) is written in 2.1, copied in 2.2, consumed in 3.2.
