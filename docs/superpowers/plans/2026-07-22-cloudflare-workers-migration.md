# Cloudflare Workers Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `qron-platform` Vercel deployment (the single multi-tenant Next.js/Express/tRPC app that serves `authichain.com`, `qron.space`, `govchain.us`, and `strainchain.io`) to Cloudflare Workers on the free tier with full functional parity, then decommission the last Vercel project.

**Architecture:** Replace the Node/Express entrypoint (`server/_core/index.ts` + `server/_core/app.ts`) with a Hono-based Cloudflare Worker `fetch` handler that mounts the existing tRPC `appRouter` (`server/routers.ts`, 44 sub-routers, unchanged) via `@trpc/server/adapters/fetch`. The ~12 raw (non-tRPC) Express routes — Stripe/Paddle/Instantly/DocuSign webhooks, OAuth, contact, GPT, internal, health, admin/ops — become individual Hono routes reusing their existing framework-agnostic handler functions. `pg.Pool` (raw TCP, incompatible with Workers) is replaced with a Hyperdrive-backed `pg.Pool`, which Cloudflare designed as a near-drop-in for exactly this case. In-memory rate limiting moves to a Durable Object (the existing `Map`-based store doesn't survive across Workers isolates). The Node `setInterval` job scheduler moves to Cloudflare Cron Triggers. The frontend is already a Vite build outputting static assets (`dist/public`), served via the Workers `ASSETS` binding — the same pattern the repo's own `worker/index.ts` already uses for the root marketing page today.

**Tech Stack:** Hono, `@trpc/server/adapters/fetch`, Cloudflare Workers (`nodejs_compat`), Hyperdrive, Durable Objects, Cloudflare KV, Cron Triggers, Wrangler.

## Global Constraints

- Brand-by-hostname resolution (`authichain.com` / `qron.space` / `strainchain.io` / `govchain.us` + `www.`/`app.` subdomains) must stay byte-identical — reuse `shared/brands.ts`'s `resolveBrand()` unchanged, do not reimplement.
- Stay within Cloudflare free tier: Workers 100k requests/day, KV 100k reads/day + 1k writes/day, Durable Objects 100k requests/day + 1GB storage. Flag explicitly if real traffic risks exceeding these (see Task 10).
- Do not modify any of the 44 tRPC sub-router business-logic modules except `server/auth/router.ts` (the one file that touches `ctx.req`/`ctx.res` directly — confirmed via `grep -rl "ctx\.req\.\|ctx\.res\." server/**/*.ts`).
- Do not touch the `qron-platform` Vercel project (delete, modify domains, etc.) until the Worker passes the full parity checklist in Task 11 on its `*.workers.dev` URL.
- No DNS/Route cutover without the explicit verification checklist in Task 11 passing first — per user decision, no "cut over and fix forward" for this app.

---

## Phase 0: Foundation — Worker Entrypoint, DB, Sessions

### Task 1: Hyperdrive binding for the existing `pg` connection

**Files:**
- Modify: `wrangler.toml` (repo root)
- Modify: `server/db.ts` (additive only — append `getDb()`, do not remove or change the existing `db` export)
- Test: `server/db.test.ts` (new)

**Interfaces:**
- Produces: `getDb(env: { HYPERDRIVE: Hyperdrive }): ReturnType<typeof drizzle>` — the DB accessor the Workers entrypoint (Task 6) and Workers tRPC context (Task 2) use. The existing `db` singleton export is untouched and keeps serving the 47-77 existing call sites until Task 2b migrates them.

- [ ] **Step 1: Create the Hyperdrive config against the existing Supabase Postgres**

Run (requires `wrangler` ≥ 3.x, already a devDependency per `package.json`):
```bash
npx wrangler hyperdrive create authichain-db --connection-string="$DATABASE_URL"
```
This prints a `hyperdrive_id`. Copy it into `wrangler.toml` in the next step. Hyperdrive itself has no separate free-tier gate — it's a connection-pooling proxy in front of your existing Postgres, priced only by the Workers requests that use it.

- [ ] **Step 2: Add the Hyperdrive binding to `wrangler.toml`**

Append to `wrangler.toml`:
```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "REPLACE_WITH_ID_FROM_STEP_1"
```

- [ ] **Step 3: Write the failing test for a Workers-compatible DB accessor**

```typescript
// server/db.test.ts
import { describe, it, expect, vi } from "vitest";
import { getDb } from "./db";

describe("getDb", () => {
  it("builds a drizzle client from a Hyperdrive connection string", () => {
    const fakeEnv = {
      HYPERDRIVE: { connectionString: "postgres://fake:fake@localhost:5432/fake" },
    } as unknown as { HYPERDRIVE: Hyperdrive };
    const db = getDb(fakeEnv);
    expect(db).toBeDefined();
    // drizzle-orm/node-postgres clients expose $client (the underlying pg.Pool)
    expect((db as any).$client).toBeDefined();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run server/db.test.ts`
Expected: FAIL with `getDb is not exported` (or similar — `getDb` doesn't exist yet).

- [ ] **Step 5: Add `getDb()` alongside the existing singleton — purely additive, do not touch the existing export**

**Correction from the original plan draft:** a direct grep (`grep -rln "from [\"'].*\/db[\"']" server --include="*.ts" | grep -v node_modules`) shows **47–77 files** reference `server/db.ts`, not just `server/_core/context.ts` as originally assumed from sampling `ctx.req`/`ctx.res` usage alone (that sampling only checked Express coupling, not database-access coupling — a different question). Removing the module-level `db` export in this task would break most of those files and very likely the 503-test baseline this plan's worktree setup established before any task ran. **Task 2b (new, inserted after Task 2) enumerates and migrates those call sites — this task does not touch them.**

`server/db.ts` currently opens `new Pool({ connectionString: process.env.DATABASE_URL })` at import time and exports `db` as a singleton. Leave that exactly as-is. Add the new factory alongside it:
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// ... existing schema imports unchanged ...

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema: /* existing schema object, unchanged */ });

// New: per-request factory for the Workers runtime, where `env` bindings
// (including Hyperdrive) are only available inside the request handler,
// never at module load time the way `db` above assumes. Additive only —
// `db` above is untouched and every existing importer keeps working.
export function getDb(env: { HYPERDRIVE: Hyperdrive }) {
  const workersPool = new Pool({ connectionString: env.HYPERDRIVE.connectionString });
  return drizzle(workersPool, { schema: /* same schema object passed to `db` above */ });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run server/db.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full existing suite to confirm zero regressions from this additive change**

Run: `pnpm vitest run`
Expected: PASS, 33 test files / 503 tests — same counts as the worktree's baseline (recorded before Task 1 started). Any drop in count or new failure means this task accidentally touched something beyond the additive `getDb` export — fix before committing, do not proceed with a reduced baseline.

- [ ] **Step 8: Commit**

```bash
git add wrangler.toml server/db.ts server/db.test.ts
git commit -m "feat(workers): add Hyperdrive-backed getDb() factory alongside the existing db singleton"
```

---

### Task 2: Workers-native tRPC context (Fetch adapter instead of Express adapter)

**Files:**
- Create: `server/_core/context.workers.ts`
- Modify: `server/_core/sdk.ts` (only if `authenticateRequest` isn't already Fetch-`Request`-typed — verify first)
- Test: `server/_core/context.workers.test.ts`

**Interfaces:**
- Consumes: `getHyperdriveDb` from Task 1 (`server/db.ts`) — **not** `getDb`. Task 1 originally planned to export this as `getDb(env)`, but its review cycle found a pre-existing, unrelated `getDb()` already in `server/db.ts` (async, zero-arg, used by ~30 files) and renamed the new Hyperdrive factory to `getHyperdriveDb(env)` to avoid colliding with it. Importing `getDb` here would silently pull in the wrong (old, Node-only, zero-arg) function — use `getHyperdriveDb`.
- Produces: `createWorkersContext(opts: FetchCreateContextFnOptions, env: Env): Promise<TrpcContext>` — used by Task 5's Worker entrypoint.

- [ ] **Step 1: Verify `sdk.authenticateRequest`'s `Request` type**

```bash
grep -n "^import.*Request" server/_core/sdk.ts | head -5
```
If it imports `Request` from `"express"` (or has no explicit import, meaning it's using the ambient DOM `Request` type only by accident), it needs a signature check against a real Fetch `Request` object before Task 2 can rely on it unchanged. If it's already the global Fetch `Request` (no import, or `import type {} from "@cloudflare/workers-types"`), skip straight to Step 2 — no source change needed here, note that finding in the commit message.

- [ ] **Step 2: Write the failing test**

```typescript
// server/_core/context.workers.test.ts
import { describe, it, expect, vi } from "vitest";
import { createWorkersContext } from "./context.workers";

vi.mock("./sdk", () => ({
  sdk: { authenticateRequest: vi.fn().mockResolvedValue(null) },
}));

describe("createWorkersContext", () => {
  it("builds a context with db, user, and repos from a Fetch Request", async () => {
    const req = new Request("https://authichain.com/api/trpc/health");
    const env = { HYPERDRIVE: { connectionString: "postgres://fake/fake" } } as any;
    const ctx = await createWorkersContext({ req, resHeaders: new Headers() } as any, env);
    expect(ctx.user).toBeNull();
    expect(ctx.missionsRepo).toBeDefined();
    expect(ctx.adminRepo).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run server/_core/context.workers.test.ts`
Expected: FAIL — `context.workers.ts` doesn't exist yet.

- [ ] **Step 4: Write the implementation**

```typescript
// server/_core/context.workers.ts
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import type { IMissionsRepository } from "../missions/types";
import type { IAdminRepository } from "../admin/types";
import { DbMissionsRepository } from "../missions/db-repository";
import { DbAdminRepository } from "../admin/db-repository";
import { getHyperdriveDb } from "../db";

export type TrpcContext = {
  db: ReturnType<typeof getHyperdriveDb>;
  user: User | null;
  missionsRepo?: IMissionsRepository;
  adminRepo?: IAdminRepository;
};

type WorkersEnv = { HYPERDRIVE: Hyperdrive };

export async function createWorkersContext(
  opts: FetchCreateContextFnOptions,
  env: WorkersEnv
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null; // Authentication is optional for public procedures.
  }

  return {
    db: getHyperdriveDb(env),
    user,
    missionsRepo: new DbMissionsRepository(),
    adminRepo: new DbAdminRepository(),
  };
}
```
Note this drops `req`/`res` from `TrpcContext` entirely (the Express version kept them for the one router that used them directly — `server/auth/router.ts`, handled in Task 4) and adds `db` (previously a bare module import, now threaded through context via `getHyperdriveDb`, Task 1's additive Hyperdrive factory).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run server/_core/context.workers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/_core/context.workers.ts server/_core/context.workers.test.ts
git commit -m "feat(workers): add Fetch-adapter tRPC context alongside the existing Express one"
```

---

### Task 2b: Migrate `db`/`getDb()`/helper-function call sites to `ctx.db` — split into 6 sub-tasks

**Why this task exists, and two corrections along the way:** discovered during pre-flight plan review, then refined twice more during Task 1 and Task 2's review cycles. `server/db.ts` has three access surfaces that all share one underlying connection, not independent things:
```typescript
let _db: DrizzleInstance | null = null;

export async function getDb() {              // lazy-initializes _db on first call,
  if (_db) return _db;                        // using process.env.DATABASE_URL,
  // ...new Pool({ connectionString: process.env.DATABASE_URL }); _db = drizzle(pool);
}

export const db: DrizzleInstance = new Proxy({} as DrizzleInstance, {
  get(_target, prop) {
    if (!_db) throw new Error("Database not available");  // depends on getDb()
    return Reflect.get(_db as object, prop as string);      // having run first
  },
});

// Plus 151 named query helpers exported from this same file, e.g.:
export async function getUserByOpenId(openId: string) { /* uses db/getDb internally */ }
export async function upsertUser(user: InsertUser): Promise<void> { /* ditto */ }
// ...149 more (createProduct, getLeadByEmail, upsertStripeSubscription, etc.)
```
All three are incompatible with Workers for the same reason: `process.env.DATABASE_URL` and the module-scope `_db` cache both assume a long-lived Node process, not a per-request Workers invocation where `env` bindings are only available inside the request handler.

A real usage-based investigation (not an import-statement guess — that undercounted twice in a row during this plan's review cycles) found the true scope:
- 35 files call `getDb(` directly
- 29 files use `db.<method>(` directly
- 115 files call at least one of the 151 named helper functions
- **112 unique production files total** (test files excluded) need migration — far more than this plan's original 40-file estimate

A single task covering 112 files isn't reviewable or safely executable as one unit, so this is split into 6 sub-tasks by subsystem, ~17-19 files each, matching the codebase's own `server/` subdirectory organization:

| Sub-task | Files | Scope |
|---|---|---|
| Task 2b-1 | 19 | `server/agents/**` — AI/automation agents |
| Task 2b-2 | 19 | `server/jobs/**`, `server/scheduled-jobs.ts` — background jobs |
| Task 2b-3 | 17 | `server/scripts/**`, `server/missions/**`, `server/_core/**`, `server/db/**` — infra/tooling/core |
| Task 2b-4 | 19 | `server/webhooks/**`, `server/services/**`, `server/sales/**`, `server/admin/**`, `server/payments/**`, `server/paddle/**`, `server/subscriptions/**`, `server/stripe-connect-service.ts`, `server/tenant-billing.ts`, `server/revenue-orchestrator.ts`, `server/fulfillment-service.ts` — commerce/revenue |
| Task 2b-5 | 19 | `server/staking/**`, `server/referral/**`, `server/white-label/**`, `server/affiliate/**`, `server/bonuses/**`, `server/authenticate/**`, `server/b44-service.ts`, `server/asset-service.ts`, `server/supply-chain/**`, `server/qron/**`, `server/qrcode/**`, `server/products/**`, `server/nft/**`, `server/marketplace/**`, `server/certificates/**`, `server/ordinals-service.ts`, `server/metrc-service.ts` — identity/product |
| Task 2b-6 | 19 | `server/social-service.ts`, `server/marketing/**`, `server/hubspot/**`, `server/gpt/**`, `server/email-drafts/**`, `server/email-campaigns/**`, `server/notifications/**`, `server/feedback/**`, `server/personalization/**`, `server/character-service.ts`, `server/govchain/**`, `server/mcp/**`, `server/internal-api.ts`, `server/dashboard/**`, `server/blockchain/**`, `server/analytics/**`, `server/ab-testing/**`, `server/routers/**` (the tRPC composition file itself), `server/autopilot/**` — content/comms/composition |

Each sub-task below follows the same procedure; only the file scope differs. Run them in order (2b-1 through 2b-6) so the full suite's growing pass count stays a meaningful regression signal between them, but they have no interface dependency on each other — a review finding in 2b-3 does not block starting 2b-4.

**Interfaces (shared across all six sub-tasks):**
- Consumes: `TrpcContext.db` from Task 2 (`server/_core/context.workers.ts`) — already present in the type, populated via `getHyperdriveDb(env)` (Task 1's factory — **not** `getDb()`, which is one of the things being migrated away from).

---

#### Task 2b-1: Migrate `server/agents/**` (19 files)

**Files:**
- Modify: `server/agents/browser-vision.ts`, `server/agents/browser.ts`, `server/agents/closer.ts`, `server/agents/content.ts`, `server/agents/crm-update.ts`, `server/agents/dev-team/code-writer.ts`, `server/agents/dev-team/pr-manager.ts`, `server/agents/dev-team/router.ts`, `server/agents/dev-team/test-runner.ts`, `server/agents/followup.ts`, `server/agents/heygen-video.ts`, `server/agents/infra.ts`, `server/agents/lead-finder.ts`, `server/agents/news-pr.ts`, `server/agents/outbound-email.ts`, `server/agents/pilot-packet.ts`, `server/agents/retail.ts`, `server/agents/security.ts`, `server/agents/seo-content.ts`
- Test: each file's matching `*.test.ts` (run per-file after each migration)

- [ ] **Step 1: Confirm this exact file list is still current**

```bash
grep -rl "getDb(\|(getUserByOpenId\|upsertUser\|getAllUsers\|createProduct" server/agents --include="*.ts" | grep -v "\.test\.ts$"
```
(Substitute the actual helper-function names each file uses — this plan's investigation used a loop over all 151 names; for a 19-file cluster, a manual read of each file's imports from `../db` or `../../db` is faster than re-running the full 151-name loop. Confirm no file has been added to or removed from `server/agents/` since this plan was written that would change the list above.)

- [ ] **Step 2: Classify each file — router-adjacent (has access to a tRPC `ctx`) vs. standalone service module**

Files under `server/agents/dev-team/router.ts` and similar router-registered files receive `ctx` directly. Most files in `server/agents/` are standalone service modules (called by routers or by scheduled jobs, not routers themselves) — these need a `db` parameter added to their exported functions, threaded from whichever router/job calls them.

- [ ] **Step 3: Migrate one file, run its test, repeat**

For each file: remove the `getDb`/`db`/helper-function-from-db import, add a `db: TrpcContext["db"]` parameter (or the plain `ReturnType<typeof getHyperdriveDb>` type if importing `TrpcContext` would create a circular import — check before choosing), update the function body to call the equivalent drizzle query via the passed-in `db` instead of the removed import, and update every call site of this file's exported functions to pass `db` through.

Run the file's own test after each migration. Do not batch multiple files into one uncommitted pile.

- [ ] **Step 4: Run the full suite and type check after this cluster**

Run: `npx tsc --noEmit && pnpm vitest run`
Expected: zero new type errors, test count at or above the running baseline (check the ledger for the count after Task 2's fix cycle before starting).

- [ ] **Step 5: Commit per file or small logical group**

```bash
git add <migrated files>
git commit -m "refactor(workers): migrate server/agents/<name> off direct db access to threaded db param"
```

- [ ] **Step 6: Confirm zero remaining direct db access in this cluster**

```bash
grep -rl "getDb(\|\bdb\.\(select\|insert\|update\|delete\|query\|transaction\|execute\)(" server/agents --include="*.ts" | grep -v "\.test\.ts$"
```
Expected: empty.

---

#### Task 2b-2: Migrate `server/jobs/**` + `server/scheduled-jobs.ts` (19 files)

**Files:**
- Modify: every file under `server/jobs/` (18 files — enumerate via `find server/jobs -name "*.ts" | grep -v test`, do not assume the count is exactly 18 without checking, this plan's own file-count discovery process has been wrong twice already) plus `server/scheduled-jobs.ts`
- Test: each file's matching `*.test.ts`

- [ ] **Step 1: Enumerate current files**

```bash
find server/jobs -name "*.ts" | grep -v "\.test\.ts$" | sort
```

- [ ] **Step 2 through 6: same procedure as Task 2b-1**, scoped to this file list. `server/scheduled-jobs.ts` is the Node `setInterval`-based scheduler that Task 8 (Cron Triggers) also touches — coordinate: this sub-task migrates its *database access* off the module singleton; Task 8 migrates its *scheduling mechanism* off `setInterval`. If both tasks touch the same lines, whichever runs second should read the other's diff first rather than conflict blindly. Flag this coordination note in your commit message if you touch `server/scheduled-jobs.ts`.

---

#### Task 2b-3: Migrate `server/scripts/**`, `server/missions/**`, `server/_core/**`, `server/db/**` (17 files)

**Files:**
- Modify: every file under `server/scripts/` (6 files), `server/missions/` (5 files), `server/_core/` (5 files — **note:** `server/_core/context.ts`, `server/_core/context.workers.ts`, and `server/_core/sdk.ts` are expected to import `getDb`/`getHyperdriveDb` directly, that's their job — exclude those three from this migration, only migrate the other 2 `_core` files that showed up in the original scan), `server/db/` (1 file, `server/db/users.ts`)
- Test: matching `*.test.ts` files

- [ ] **Step 1: Enumerate and exclude the 3 context/sdk files**

```bash
find server/scripts server/missions server/_core server/db -name "*.ts" | grep -v "\.test\.ts$" | grep -vE "_core/(context\.ts|context\.workers\.ts|sdk\.ts)$" | sort
```

- [ ] **Step 2 through 6: same procedure as Task 2b-1**, scoped to this list.

---

#### Task 2b-4: Migrate commerce/revenue cluster (19 files)

**Files:**
- Modify: `server/webhooks/**` (3 files), `server/services/**` (3 files), `server/sales/**` (3 files), `server/admin/**` (3 files), `server/payments/**` (1 file), `server/paddle/**` (1 file), `server/subscriptions/**` (1 file), `server/stripe-connect-service.ts`, `server/tenant-billing.ts`, `server/revenue-orchestrator.ts`, `server/fulfillment-service.ts`
- Test: matching `*.test.ts` files

**Note:** `server/webhooks/stripe.ts` was confirmed during this plan's architecture investigation to already take `(rawBody, sig)` as plain parameters (framework-agnostic, no Express coupling) — but it likely still calls `logActivity`/`recordRevenue`/`upsertStripeSubscription` etc. from `server/db.ts` internally, which is exactly what this sub-task migrates. Do not confuse "already Workers-compatible for HTTP framework reasons" (true, established earlier) with "already Workers-compatible for database access reasons" (not true until this task runs).

- [ ] **Step 1: Enumerate**

```bash
find server/webhooks server/services server/sales server/admin server/payments server/paddle server/subscriptions -name "*.ts" | grep -v "\.test\.ts$"
echo "server/stripe-connect-service.ts server/tenant-billing.ts server/revenue-orchestrator.ts server/fulfillment-service.ts"
```

- [ ] **Step 2 through 6: same procedure as Task 2b-1**, scoped to this list. Given this cluster includes real payment webhook handlers, run each file's test individually and read the diff carefully before committing — a mistake here has real financial-data implications, more so than the other clusters.

---

#### Task 2b-5: Migrate identity/product cluster (19 files)

**Files:**
- Modify: `server/staking/**` (2), `server/referral/**` (2), `server/white-label/**` (1), `server/affiliate/**` (1), `server/bonuses/**` (1), `server/authenticate/**` (1), `server/b44-service.ts`, `server/asset-service.ts`, `server/supply-chain/**` (1), `server/qron/**` (1), `server/qrcode/**` (1), `server/products/**` (1), `server/nft/**` (1), `server/marketplace/**` (1), `server/certificates/**` (1), `server/ordinals-service.ts`, `server/metrc-service.ts`
- Test: matching `*.test.ts` files

- [ ] **Step 1: Enumerate**

```bash
find server/staking server/referral server/white-label server/affiliate server/bonuses server/authenticate server/supply-chain server/qron server/qrcode server/products server/nft server/marketplace server/certificates -name "*.ts" | grep -v "\.test\.ts$"
echo "server/b44-service.ts server/asset-service.ts server/ordinals-service.ts server/metrc-service.ts"
```

- [ ] **Step 2 through 6: same procedure as Task 2b-1**, scoped to this list.

---

#### Task 2b-6: Migrate content/comms/composition cluster (19 files)

**Files:**
- Modify: `server/social-service.ts`, `server/marketing/**` (1), `server/hubspot/**` (1), `server/gpt/**` (1), `server/email-drafts/**` (1), `server/email-campaigns/**` (1), `server/notifications/**` (1), `server/feedback/**` (1), `server/personalization/**` (1), `server/character-service.ts`, `server/govchain/**` (1), `server/mcp/**` (1), `server/internal-api.ts`, `server/dashboard/**` (1), `server/blockchain/**` (1), `server/analytics/**` (1), `server/ab-testing/**` (1), `server/routers/**` (1), `server/autopilot/**` (1)
- Test: matching `*.test.ts` files

**Note on `server/routers/**`:** this is a small directory of standalone routers (`server/routers/metrc.ts`, `server/routers/scheduler.ts`, `server/routers/reputation.ts` — found during this plan's investigation), distinct from `server/routers.ts` (singular, the top-level `appRouter` composition file). Do not confuse the two; `server/routers.ts` itself is not expected to need migration (it just merges sub-routers, per the architecture investigation), but verify with Step 1's enumeration rather than assuming.

- [ ] **Step 1: Enumerate**

```bash
find server/marketing server/hubspot server/gpt server/email-drafts server/email-campaigns server/notifications server/feedback server/personalization server/govchain server/mcp server/dashboard server/blockchain server/analytics server/ab-testing server/routers server/autopilot -name "*.ts" | grep -v "\.test\.ts$"
echo "server/social-service.ts server/character-service.ts server/internal-api.ts"
```

- [ ] **Step 2 through 6: same procedure as Task 2b-1**, scoped to this list.

---

**Overall Task 2b completion gate (run once after all 6 sub-tasks land):**

```bash
grep -rl "getDb(" server --include="*.ts" | grep -v node_modules | grep -v "\.test\.ts$" | grep -v "^server/db\.ts$" | grep -vE "_core/(context\.ts|context\.workers\.ts|sdk\.ts)$"
grep -rlE "\bdb\.(select|insert|update|delete|query|transaction|execute)\(" server --include="*.ts" | grep -v node_modules | grep -v "\.test\.ts$" | grep -v "^server/db\.ts$"
npx tsc --noEmit
pnpm vitest run
```
Expected: both greps empty, zero type errors, full suite passing. This is the true gate for "the app no longer depends on the Node-only db singleton anywhere outside server/db.ts's own definitions" — not any individual sub-task's local check.

---
---

### Task 4: Adapt `server/auth/router.ts` off `ctx.req`/`ctx.res`

**Files:**
- Modify: `server/auth/router.ts` (read fully first — this task can't be completed blind; the exact diff depends on what it currently does with `req`/`res`, which the investigation for this plan did not enumerate beyond confirming it's the only file touching them)
- Test: `server/auth/router.test.ts` (extend existing, or create if absent)

**Interfaces:**
- Consumes: `TrpcContext` from Task 2 (no `req`/`res` fields)
- Produces: same public tRPC procedure surface as today (`auth.*` — do not rename procedures; anything importing `trpc.auth.*` on the frontend must keep working unchanged)

- [ ] **Step 1: Read the file and classify every `ctx.req`/`ctx.res` usage**

```bash
grep -n "ctx\.req\.\|ctx\.res\." server/auth/router.ts
```
Common patterns and their Workers-compatible replacement:
- `ctx.req.headers.cookie` / `ctx.req.cookies.x` → read from a `cookie` header parsed with a small helper (e.g. `hono/cookie`'s `getCookie`), threaded into context as `ctx.cookies: Record<string, string>` in Task 2's `createWorkersContext`.
- `ctx.res.cookie(...)` / `ctx.res.clearCookie(...)` → tRPC's Fetch adapter can't mutate response headers mid-procedure the way Express `res` can; set-cookie must go through `responseMeta` on the router, or the procedure returns the cookie value and a thin Hono route sets it. Prefer: procedures return `{ ...data, setCookie?: string }`, and the Hono mount point (Task 6) checks for that key and calls `c.header("Set-Cookie", ...)`.
- `ctx.res.status(...)` — tRPC errors already carry HTTP status via `TRPCError({ code })`; if this is being used to set a non-error status, that's unusual enough to flag rather than guess — write down what's found here before changing it.

- [ ] **Step 2: Write/extend the test for the adapted procedures**

(Concrete test code depends on what Step 1 finds — write one test per procedure that previously touched `req`/`res`, asserting the same login/logout/session behavior with the new `ctx.cookies` / return-value-based cookie pattern. Follow the existing test file's structure in `server/auth/router.test.ts` if one exists; if not, mirror the style of a sibling router's test, e.g. `server/reputation.test.ts`.)

- [ ] **Step 3: Run the existing auth test suite to establish the pre-change baseline**

Run: `pnpm vitest run server/auth`
Expected: current PASS state recorded — this is the regression baseline for Step 5.

- [ ] **Step 4: Apply the adaptation from Step 1's classification**

- [ ] **Step 5: Run the test suite again**

Run: `pnpm vitest run server/auth`
Expected: PASS, same test count as Step 3's baseline (no procedure silently dropped).

- [ ] **Step 6: Commit**

```bash
git add server/auth/router.ts server/auth/router.test.ts
git commit -m "fix(workers): remove ctx.req/ctx.res coupling from auth router"
```

---

## Phase 1: Worker Entrypoint

### Task 5: Hono Worker entrypoint mounting tRPC + static assets

**Files:**
- Create: `worker-app/index.ts` (kept separate from the existing `worker/index.ts` marketing-page worker until Task 11's cutover — do not overwrite `worker/index.ts` yet, it's still live in production for `authichain.com`'s root path)
- Create: `worker-app/wrangler.toml`
- Test: manual (curl against `wrangler dev`, see Step 4 — this task is an integration point, not a unit-testable pure function)

**Interfaces:**
- Consumes: `createWorkersContext` (Task 2), `appRouter` from `server/routers.ts` (unchanged)
- Produces: the `fetch(request, env, ctx)` handler that Task 6 (raw routes) and Task 11 (cutover) both extend.

- [ ] **Step 1: Scaffold the Hono app and mount tRPC**

```typescript
// worker-app/index.ts
import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "../server/routers";
import { createWorkersContext } from "../server/_core/context.workers";
import { resolveBrand } from "../shared/brands";

type Env = {
  HYPERDRIVE: Hyperdrive;
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
};

const app = new Hono<{ Bindings: Env }>();

// Brand resolution — same logic as src/middleware.ts and the old
// server/_core/brand-middleware.ts, ported to Hono context instead of
// Express res.locals.
app.use("*", async (c, next) => {
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? "";
  const brand = resolveBrand(host);
  c.set("brand", brand);
  c.header("X-Brand", brand);
  await next();
});

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (opts, c) => createWorkersContext(opts, c.env),
  })
);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Static assets fallback (Vite build output, same dist/public the existing
// worker/index.ts already serves for the marketing page).
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```
Requires adding `@hono/trpc-server` to `package.json` dependencies:
```bash
pnpm add hono @hono/trpc-server
```

- [ ] **Step 2: Add the standalone wrangler config for local testing**

```toml
# worker-app/wrangler.toml
name = "authichain-app"
main = "index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "../dist/public"
binding = "ASSETS"

[[kv_namespaces]]
binding = "SESSIONS"
id = "7c8e9466e57843199f6f768615e42a5c"  # reuse the existing SESSIONS KV from the root wrangler.toml

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "REPLACE_WITH_ID_FROM_TASK_1"
```
This is intentionally a **separate** wrangler config/worker name (`authichain-app`, not `authichain`) from the root `worker/index.ts` — they stay independent deployments until Task 11 merges them, so a bad build here can't touch the currently-live marketing worker.

- [ ] **Step 3: Build the frontend so `dist/public` exists**

Run: `pnpm run build`
Expected: `dist/public/` populated (same output the existing Vercel deploy and `worker/index.ts` both already consume — no build config changes needed here).

- [ ] **Step 4: Manually verify the health and tRPC routes locally**

Run: `cd worker-app && npx wrangler dev`
Then in a second terminal:
```bash
curl http://localhost:8787/api/health
# Expected: {"status":"ok"}
curl "http://localhost:8787/api/trpc/system.ping" # or whichever no-auth query exists in the system router
# Expected: a valid tRPC JSON response, not a 500
```
If the tRPC call 500s, read the error — it's almost certainly one of: a router file that does import something Node-only (the 3 files flagged by the `fs`/`child_process` grep in the architecture investigation — check if any are reachable from a no-auth query), or a missing env binding. Fix and re-run before moving on; do not proceed to Task 6 with a failing tRPC mount.

- [ ] **Step 5: Commit**

```bash
git add worker-app/ package.json pnpm-lock.yaml
git commit -m "feat(workers): scaffold Hono entrypoint mounting tRPC + static assets"
```

---

### Task 6: Port the raw (non-tRPC) Express routes

**Files:**
- Modify: `worker-app/index.ts`
- Reference (read, do not modify — reuse the exported handler functions as-is): `server/webhooks/stripe.ts`, `server/webhooks/paddle.ts` (or wherever Paddle's handler lives per `app.ts:95` — confirm exact path), `server/_core/oauth.ts`, `.github-staging/gmail-oauth.ts`, `server/contact/router.ts` (or equivalent — confirm exact export used by `contactRouter` in `app.ts:189`), `server/gpt/router.ts`, `server/internal-api.ts`
- Test: `worker-app/routes.test.ts`

**Interfaces:**
- Consumes: whatever each existing raw handler already exports (confirmed pattern for Stripe: `handleStripeWebhook(rawBody: string, sig: string)` — framework-agnostic, no change needed, just a new call site)
- Produces: nothing new — this task's job is wiring, not new business logic.

- [ ] **Step 1: Enumerate every raw route with its exact existing handler signature**

For each of the 8 non-tRPC concerns found in `server/_core/app.ts` (excluding `/api/trpc` and the static/tRPC middleware lines already covered by Task 5), read the referenced file and record: does it export a plain function (like `handleStripeWebhook`), or does it export an Express `Router` instance (like `contactRouter`, `gptRouter`)? A plain function ports directly into a Hono route. An Express `Router` needs its individual route handlers extracted the same way — Express `Router`s are themselves just `(req, res) => {}` handlers per route internally, so check whether `contactRouter`/`gptRouter`/`createInternalRouter()`'s individual handlers reach into `req`/`res` in ways beyond `req.body`/`req.query`/`req.params` (which Hono's `c.req.json()`/`c.req.query()`/`c.req.param()` replace directly) or something Express-specific (`req.ip`, `req.session`, etc., which need the Task 2-style adaptation).

- [ ] **Step 2: Port the Stripe and Paddle webhooks (confirmed framework-agnostic already)**

```typescript
// worker-app/index.ts — add above the ASSETS fallback route
import { handleStripeWebhook } from "../server/webhooks/stripe";
// import { handlePaddleWebhook } from "../server/webhooks/paddle"; // confirm exact path from Step 1

app.post("/api/stripe/webhook", async (c) => {
  const rawBody = await c.req.text();
  const sig = c.req.header("stripe-signature") ?? "";
  const result = await handleStripeWebhook(rawBody, sig);
  return c.json(result);
});
```
Repeat the same pattern for `/api/paddle/webhook` once Step 1 confirms its handler's exact signature.

- [ ] **Step 3: Write the test for the webhook routes**

```typescript
// worker-app/routes.test.ts
import { describe, it, expect, vi } from "vitest";
import app from "./index";

vi.mock("../server/webhooks/stripe", () => ({
  handleStripeWebhook: vi.fn().mockResolvedValue({ received: true }),
}));

describe("POST /api/stripe/webhook", () => {
  it("passes the raw body and signature header through unchanged", async () => {
    const res = await app.request("/api/stripe/webhook", {
      method: "POST",
      body: "raw-stripe-payload",
      headers: { "stripe-signature": "t=123,v1=fake" },
    });
    expect(res.status).toBe(200);
    const { handleStripeWebhook } = await import("../server/webhooks/stripe");
    expect(handleStripeWebhook).toHaveBeenCalledWith("raw-stripe-payload", "t=123,v1=fake");
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run worker-app/routes.test.ts`
Expected: PASS

- [ ] **Step 5: Port the remaining routes one at a time using Step 1's classification**

For each of: `/api/webhooks/instantly`, `/api/webhooks/docusign`, `/api/admin/ops`, `/api/oauth/*`, `/api/contact/*`, `/api/gpt/*`, `/api/internal/*` — repeat the Step 2-4 cycle (port, write a test asserting the existing handler is called with Hono-derived equivalents of the same inputs it received from Express, verify). Do not batch these into one commit — each is its own task-Step-4-sized unit so a single broken route doesn't block the others from landing.

- [ ] **Step 6: Commit (one per route, per Step 5)**

```bash
git add worker-app/index.ts worker-app/routes.test.ts
git commit -m "feat(workers): port <route-name> off Express"
```

---

## Phase 2: Stateful Concerns

### Task 7: Rate limiting via Durable Object

**Files:**
- Create: `worker-app/rate-limiter.ts`
- Modify: `worker-app/wrangler.toml` (add the Durable Object binding)
- Modify: `worker-app/index.ts` (replace the Express `oauthRateLimit`/`contactRateLimit`/`gptRateLimit`/`globalApiRateLimit`/`adminRateLimit` middleware calls)
- Test: `worker-app/rate-limiter.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(stub: DurableObjectStub, key: string, limit: number, windowMs: number): Promise<boolean>` (`true` = allowed)

- [ ] **Step 1: Write the failing test**

```typescript
// worker-app/rate-limiter.test.ts
import { describe, it, expect } from "vitest";
import { env, runInDurableObject } from "cloudflare:test"; // vitest-pool-workers helper
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  it("allows requests under the limit and blocks over it", async () => {
    const id = env.RATE_LIMITER.idFromName("test-key");
    const stub = env.RATE_LIMITER.get(id);
    await runInDurableObject(stub, async (instance: RateLimiter) => {
      for (let i = 0; i < 5; i++) {
        expect(await instance.check(5, 60_000)).toBe(true);
      }
      expect(await instance.check(5, 60_000)).toBe(false);
    });
  });
});
```
This requires `@cloudflare/vitest-pool-workers` (add as a devDependency if not already present — check `package.json` first, several Cloudflare-adjacent packages are already installed per the earlier dependency audit).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run worker-app/rate-limiter.test.ts`
Expected: FAIL — `rate-limiter.ts` doesn't exist.

- [ ] **Step 3: Implement the Durable Object**

```typescript
// worker-app/rate-limiter.ts
import { DurableObject } from "cloudflare:workers";

export class RateLimiter extends DurableObject {
  async check(limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const stored = await this.ctx.storage.get<{ count: number; resetAt: number }>("entry");
    if (!stored || now >= stored.resetAt) {
      await this.ctx.storage.put("entry", { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (stored.count >= limit) return false;
    await this.ctx.storage.put("entry", { count: stored.count + 1, resetAt: stored.resetAt });
    return true;
  }
}

export async function checkRateLimit(
  namespace: DurableObjectNamespace,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const id = namespace.idFromName(key);
  const stub = namespace.get(id) as unknown as RateLimiter;
  return stub.check(limit, windowMs);
}
```
This mirrors the eviction/window logic already in `server/_core/rate-limit.ts`'s in-memory `Map` implementation (confirmed via `store.size > 10_000` eviction check during the architecture investigation) — same algorithm, durable/distributed storage instead of a process-local `Map`.

- [ ] **Step 4: Wire the Durable Object binding**

```toml
# worker-app/wrangler.toml — append
[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiter"

[[migrations]]
tag = "v1"
new_classes = ["RateLimiter"]
```

- [ ] **Step 5: Replace the rate-limit middleware calls in `worker-app/index.ts`**

```typescript
// worker-app/index.ts — example for the global API limit; repeat per limiter
app.use("/api/*", async (c, next) => {
  const key = c.req.header("cf-connecting-ip") ?? "unknown";
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `global:${key}`, 100, 60_000);
  if (!allowed) return c.json({ error: "rate limited" }, 429);
  await next();
});
```
Use the same per-route limit values already defined in `server/_core/rate-limit.ts` for `oauthRateLimit`/`contactRateLimit`/`gptRateLimit`/`adminRateLimit` — read that file's exact numbers before hardcoding new ones here, do not guess different limits.

- [ ] **Step 6: Run test to verify it passes, then commit**

Run: `pnpm vitest run worker-app/rate-limiter.test.ts`
```bash
git add worker-app/rate-limiter.ts worker-app/wrangler.toml worker-app/index.ts worker-app/rate-limiter.test.ts
git commit -m "feat(workers): move rate limiting from in-memory Map to a Durable Object"
```

---

### Task 8: Scheduled jobs via Cron Triggers

**Files:**
- Read first: `server/scheduled-jobs.ts` (the `initializeScheduler` function called by `server/_core/index.ts` — enumerate every job it registers and each one's interval before writing this task's real steps)
- Create: `worker-app/scheduled.ts`
- Modify: `worker-app/wrangler.toml`

**Interfaces:**
- Consumes: whatever individual job functions `server/scheduled-jobs.ts` currently calls on a `setInterval` — reuse them unchanged, same framework-agnostic-function pattern as Task 6's webhook handlers.

- [ ] **Step 1: Enumerate the existing jobs**

```bash
grep -n "setInterval\|cron\|schedule" server/scheduled-jobs.ts
```
List every job name and its interval here before proceeding — Cloudflare Cron Triggers are declared in `wrangler.toml` with cron expressions, not arbitrary millisecond intervals, so a job running every 90 seconds needs to become "every minute" (closest supported granularity) with an internal check, not a literal 90s trigger.

- [ ] **Step 2: Write `worker-app/scheduled.ts`'s `scheduled()` handler**

(Concrete implementation depends entirely on Step 1's enumeration — for each job, add a cron trigger in `wrangler.toml`:
```toml
[triggers]
crons = ["*/5 * * * *"]  # one line per distinct schedule found in Step 1, replace with real cadences
```
and a dispatcher:
```typescript
// worker-app/scheduled.ts
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  switch (event.cron) {
    case "*/5 * * * *":
      // ctx.waitUntil(existingJobFunction(getHyperdriveDb(env))); // NOT getDb — see Task 1/2's naming note
      break;
    // one case per cron string from wrangler.toml, calling the Step 1 jobs
  }
}
```
Fill in the real job function calls once Step 1's enumeration exists — do not invent job names.)

- [ ] **Step 3: Export the scheduled handler alongside the fetch handler**

```typescript
// worker-app/index.ts — at the bottom, replace `export default app;` with:
import { scheduled } from "./scheduled";
export default { fetch: app.fetch, scheduled };
```

- [ ] **Step 4: Verify locally**

Run: `npx wrangler dev --test-scheduled`
Then: `curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"`
Expected: the corresponding job runs (check for its existing log output / side effect, e.g. a row written to whatever table the job updates) without throwing.

- [ ] **Step 5: Commit**

```bash
git add worker-app/scheduled.ts worker-app/wrangler.toml worker-app/index.ts
git commit -m "feat(workers): move scheduled jobs from setInterval to Cron Triggers"
```

---

## Phase 3: Verification & Cutover

### Task 9: Deploy to a `*.workers.dev` test URL

**Files:** none (deployment step)

- [ ] **Step 1: Deploy**

```bash
cd worker-app && npx wrangler deploy
```
This publishes to `authichain-app.<your-subdomain>.workers.dev` — no DNS/domain risk, purely additive.

- [ ] **Step 2: Set production secrets**

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# ... repeat for every secret server/_core/sdk.ts, the webhook handlers, and
# the tRPC routers read from process.env — cross-reference against .env's
# key list (already inventoried earlier this session: STRIPE_SECRET_KEY,
# HUBSPOT_SERVICE_KEY, GEMINI_API_KEY, OPENAI_API_KEY, SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, PINECONE_API_KEY confirmed set;
# add whichever others the routers being tested actually touch)
```

---

### Task 10: Free-tier limit sanity check

**Files:** none (research/verification step)

- [ ] **Step 1: Pull real traffic numbers**

Check Vercel Analytics (or the existing `activity_log`/`analytics` tables the app already writes to per `server/analytics`) for daily request counts to `authichain.com` + `qron.space` + `strainchain.io` + `govchain.us` combined, including API calls (not just page loads).

- [ ] **Step 2: Compare against free-tier ceilings**

| Resource | Free tier | Check against |
|---|---|---|
| Workers requests | 100,000/day | Total combined requests/day across all 4 domains |
| KV reads | 100,000/day | Session reads (~1 per authenticated request) |
| KV writes | 1,000/day | Session writes (login events) |
| Durable Object requests | 100,000/day | Rate-limiter checks (~1 per `/api/*` request) |

If any real number is within 2x of its ceiling, note it here as a blocker for the "free tier" framing specifically — the migration can still proceed, but "delete Vercel" doesn't have to mean "stay on Workers Free" if traffic doesn't fit; Workers Paid is $5/mo flat with 10M included requests, a much higher ceiling, and still far cheaper than Vercel Pro. Flag this explicitly to the user rather than silently assuming free tier is sufficient.

---

### Task 11: Full parity verification checklist

**Files:** none (manual + scripted verification)

- [ ] **Step 1: Automated route diff**

For every route Task 6 enumerated plus every tRPC procedure in the 44 routers, hit both the live production domain and the `workers.dev` URL (with a `Host` header override to select the right brand) and diff response status + shape:
```bash
for path in /api/health /dashboard /login /pricing; do
  echo "=== $path ==="
  diff <(curl -s "https://govchain.us$path") \
       <(curl -s -H "Host: govchain.us" "https://authichain-app.<subdomain>.workers.dev$path")
done
```
Expect meaningful diffs on anything involving session cookies (domain-scoped) or timestamps — filter those, but any diff in status code or structural JSON shape is a real gap to fix before Task 12.

- [ ] **Step 2: Manual auth flow check**

Log in via the `workers.dev` URL for each brand, confirm session persists across requests (this exercises Task 7's KV/DO-backed session handling end to end, not just individual unit tests).

- [ ] **Step 3: Webhook replay check**

Use Stripe CLI (`stripe listen --forward-to https://authichain-app.<subdomain>.workers.dev/api/stripe/webhook`) to replay a real recent webhook event and confirm identical DB side effects to what the same event produced on the current Vercel deployment (compare the `activity_log`/`revenue_records` rows it wrote).

---

### Task 12: DNS/Route cutover, per domain

**Files:**
- Modify: `worker-app/wrangler.toml` (add `routes` once Task 11 passes — same pattern already used by the existing `workers/govchain-us/wrangler.toml`: `pattern = "govchain.us/*"`, `zone_name = "govchain.us"`)

- [ ] **Step 1: Cut over one domain first** (govchain.us — smallest brand by the stats shown on its own marketing page, lowest blast radius)

```toml
[[routes]]
pattern = "govchain.us/*"
zone_name = "govchain.us"
[[routes]]
pattern = "www.govchain.us/*"
zone_name = "govchain.us"
```
Deploy: `npx wrangler deploy`. Cloudflare Routes activate near-instantly (not DNS-TTL-bound) — if something's wrong, delete the route block and redeploy to fall back to whatever the domain's Vercel/DNS config was serving before, without waiting on DNS propagation.

- [ ] **Step 2: Monitor for 24–48h**, checking error rates via `npx wrangler tail` and the existing `activity_log` table for anomalies, before repeating Step 1 for `qron.space`, `strainchain.io`, and finally `authichain.com`/`app.authichain.com` (root domain last — it's the brand default and highest-traffic).

---

### Task 13: Delete the final Vercel project

**Files:** none

- [ ] **Step 1:** Confirm all 4 domains + subdomains have been repointed and stable for the monitoring window in Task 12.
- [ ] **Step 2:** Delete via the same pattern used earlier this session:
```bash
curl -X DELETE -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/prj_GD9ypyGrjibx4Ab88M52xufUf1ph?teamId=team_PKVRDwUXPRFjmGTM7PZxjNys"
```
Expected: HTTP 204. This is the last Vercel project — after this, "delete Vercel" is complete.
