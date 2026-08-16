# Guardrail/Caps Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared check/record/kill-switch API (`server/guardrail` logic under `src/lib/`, exposed via `/api/guardrail/*`) that every current and future automation channel must call before any external-effect action, per `docs/superpowers/specs/2026-07-29-guardrail-caps-layer-design.md`.

**Architecture:** New Postgres tables (Drizzle schema in `src/db/schema.ts`) plus a `src/lib/guardrail.ts` core module, exposed as Next.js App Router API routes under `src/app/api/guardrail/*`. Machine callers (CF workers, cron, agentz — none wired in this phase) authenticate with the existing `INTERNAL_API_SECRET` convention; the owner's dashboard/kill-switch calls reuse the existing `requireAdmin` session-auth pattern from `/api/admin/ops`.

**Tech Stack:** Next.js App Router route handlers, Drizzle ORM (`drizzle-orm/postgres-js`) against Supabase Postgres, Vitest, existing `@/lib/email.ts` multi-provider send helper, GitHub Actions (scheduled workflow) as the digest trigger.

## Global Constraints

- Every guardrail decision fails **closed**: unreachable dependency, unknown channel, missing secret, or any error path resolves to "not allowed" / 401/503 — never an implicit allow.
- Ad/tool spend ceiling is **$0** in this phase — `spendCeilingCents` exists as a column but no route in this plan lets it be raised above 0; that is out of scope.
- No per-action human approval anywhere, including for `licensing.docusign` — safety comes from caps + suppression + auto-tripping kill switches + the daily digest, not a confirmation step.
- Out of scope (do not touch in this plan): `services/workers/qron-outreach`, `ops/scripts/b2b-cold-outreach.ts`, `agentz/`, or the Supabase-only `qron-drip-sequence` edge function. This plan only builds the guardrail layer itself; wiring existing senders into it is separate, later work.
- Canonical repo is the WSL filesystem: `//wsl.localhost/Ubuntu/home/zac/authichain-unified`. Build/typecheck via WSL Ubuntu + node 22 (nvm) — see `docs/superpowers/specs/../..` build notes; do not use the stale `C:\Users\rac\authichain-unified` copy.
- Any step that runs `pnpm db:migrate` (or otherwise writes schema to the live Supabase project) must be confirmed with the owner immediately before running it — it's additive-only (new tables, no `ALTER`s to existing ones) but still touches a live, populated production database.
- Test convention in this repo: import test subjects with **relative paths** (`./guardrail`), never the `@/` alias — `vitest.config.ts`'s alias for `@` points at `client/src`, not `src/`, so `@/`-aliased imports silently resolve to the wrong tree inside tests.

---

### Task 1: Guardrail schema

**Files:**
- Modify: `src/db/schema.ts:1-19` (add `date` to the `drizzle-orm/pg-core` import), `src/db/schema.ts` (append after line 1334, the end of the `webhookEvents` block)
- Create (generated): a new file under `drizzle/migrations/` (name assigned by `drizzle-kit generate`, e.g. `016_guardrail_layer.sql`)

**Interfaces:**
- Produces: `guardrailChannels`, `guardrailCounters`, `suppressionList`, `killSwitches`, `guardrailEvents` (Drizzle `pgTable` exports) and their `$inferSelect`/`$inferInsert` types (`GuardrailChannel`, `InsertGuardrailChannel`, `GuardrailCounter`, `InsertGuardrailCounter`, `Suppression`, `InsertSuppression`, `KillSwitch`, `InsertKillSwitch`, `GuardrailEvent`, `InsertGuardrailEvent`) — every later task imports these from `@/db/schema`.

- [ ] **Step 1: Add the `date` column type to the existing import**

In `src/db/schema.ts`, change the import block (currently lines 1-19) by adding `date` to the list:

```ts
import {
  serial,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  numeric,
  bigint,
  uuid,
  pgEnum,
  index,
  jsonb,
  primaryKey,
  real,
  uniqueIndex,
  date,
} from 'drizzle-orm/pg-core';
```

- [ ] **Step 2: Append the five guardrail tables to the end of `src/db/schema.ts`**

```ts
// ─── Guardrail / Caps Layer ─────────────────────────────────────────────────
// Shared enforcement point every automation channel must check before any
// external-effect action (send email, publish content, send a contract).
// See docs/superpowers/specs/2026-07-29-guardrail-caps-layer-design.md.
export const guardrailChannels = pgTable("guardrail_channels", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(), // email|content|contract|spend
  dailyCap: integer("daily_cap").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  spendCeilingCents: integer("spend_ceiling_cents").default(0).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  guardrailChannelsNameUniq: uniqueIndex("guardrail_channels_name_uniq").on(table.name),
}));

export type GuardrailChannel = typeof guardrailChannels.$inferSelect;
export type InsertGuardrailChannel = typeof guardrailChannels.$inferInsert;

export const guardrailCounters = pgTable("guardrail_counters", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  day: date("day").notNull(),
  count: integer("count").default(0).notNull(),
}, (table) => ({
  guardrailCountersChannelDayUniq: uniqueIndex("guardrail_counters_channel_day_uniq").on(table.channelId, table.day),
}));

export type GuardrailCounter = typeof guardrailCounters.$inferSelect;
export type InsertGuardrailCounter = typeof guardrailCounters.$inferInsert;

export const suppressionList = pgTable("suppression_list", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  reason: varchar("reason", { length: 32 }).notNull(), // bounced|complained|manual|unsubscribed
  source: varchar("source", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  suppressionListEmailUniq: uniqueIndex("suppression_list_email_uniq").on(table.email),
}));

export type Suppression = typeof suppressionList.$inferSelect;
export type InsertSuppression = typeof suppressionList.$inferInsert;

export const killSwitches = pgTable("kill_switches", {
  id: serial("id").primaryKey(),
  scope: varchar("scope", { length: 128 }).notNull(), // "global" or a channel name
  enabled: boolean("enabled").default(false).notNull(), // true = tripped/blocked
  reason: text("reason"),
  updatedBy: varchar("updated_by", { length: 64 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  killSwitchesScopeUniq: uniqueIndex("kill_switches_scope_uniq").on(table.scope),
}));

export type KillSwitch = typeof killSwitches.$inferSelect;
export type InsertKillSwitch = typeof killSwitches.$inferInsert;

export const guardrailEvents = pgTable("guardrail_events", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id"),
  action: varchar("action", { length: 32 }).notNull(), // check|record|suppress|kill_toggle
  allowed: boolean("allowed"),
  reason: text("reason"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  guardrailEventsChannelIdx: index("idx_guardrail_events_channel").on(table.channelId),
  guardrailEventsCreatedIdx: index("idx_guardrail_events_created").on(table.createdAt),
}));

export type GuardrailEvent = typeof guardrailEvents.$inferSelect;
export type InsertGuardrailEvent = typeof guardrailEvents.$inferInsert;
```

- [ ] **Step 3: Generate the migration**

Run (from WSL Ubuntu, node 22 via nvm, per this repo's build notes):

```bash
wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified; export NVM_DIR=$HOME/.nvm; . $NVM_DIR/nvm.sh; nvm use 22 >/dev/null; export PATH="$(echo "$PATH"|tr ":" "\n"|grep -v /mnt/c/|paste -sd : -):$HOME/.nvm/versions/node/v22.22.3/bin"; pnpm db:generate'
```

Expected: a new file appears under `drizzle/migrations/` (e.g. `016_guardrail_layer.sql`) containing `CREATE TABLE "guardrail_channels" ...` etc. for all five tables. Read the generated SQL and confirm it only contains `CREATE TABLE` / `CREATE UNIQUE INDEX` / `CREATE INDEX` statements — no `ALTER` or `DROP` on any existing table. If drizzle-kit prompts an interactive question (e.g. about column renames), answer "create table" for each — these are brand new tables, never renames of existing ones.

- [ ] **Step 4: Confirm with the owner, then apply the migration**

Stop and get explicit confirmation before this step — it writes schema to the live, populated Supabase project. Once confirmed:

```bash
wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified; export NVM_DIR=$HOME/.nvm; . $NVM_DIR/nvm.sh; nvm use 22 >/dev/null; export PATH="$(echo "$PATH"|tr ":" "\n"|grep -v /mnt/c/|paste -sd : -):$HOME/.nvm/versions/node/v22.22.3/bin"; pnpm db:migrate'
```

Expected: drizzle-kit reports the new migration applied with no errors.

- [ ] **Step 5: Typecheck**

```bash
wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified; export NVM_DIR=$HOME/.nvm; . $NVM_DIR/nvm.sh; nvm use 22 >/dev/null; export PATH="$(echo "$PATH"|tr ":" "\n"|grep -v /mnt/c/|paste -sd : -):$HOME/.nvm/versions/node/v22.22.3/bin"; pnpm check'
```

Expected: 0 new errors (any pre-existing errors are documented debt, not introduced by this change — compare the count/messages to the count before this task if unsure).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/migrations
git commit -m "feat(guardrail): add channels/counters/suppression/kill-switches/events schema"
```

---

### Task 2: Fail-closed internal-secret auth helper

**Files:**
- Create: `src/lib/require-internal-secret.ts`
- Test: `src/lib/require-internal-secret.test.ts`

**Interfaces:**
- Produces: `requireInternalSecret(req: NextRequest): NextResponse | null` — returns `null` when authorized, or a `NextResponse` (401/503) to return immediately otherwise. Consumed by Task 4 and Task 7's route handlers.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/require-internal-secret.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { requireInternalSecret } from './require-internal-secret';

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://example.com/api/guardrail/check', { headers });
}

describe('requireInternalSecret', () => {
  const ORIGINAL = process.env.INTERNAL_API_SECRET;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = ORIGINAL;
  });

  it('denies with 503 when no secret is configured', async () => {
    delete process.env.INTERNAL_API_SECRET;
    const res = requireInternalSecret(makeRequest({}));
    expect(res?.status).toBe(503);
  });

  it('denies with 401 when the header secret is wrong', async () => {
    process.env.INTERNAL_API_SECRET = 'correct-secret';
    const res = requireInternalSecret(makeRequest({ 'x-internal-secret': 'wrong' }));
    expect(res?.status).toBe(401);
  });

  it('allows when x-internal-secret matches', () => {
    process.env.INTERNAL_API_SECRET = 'correct-secret';
    const res = requireInternalSecret(makeRequest({ 'x-internal-secret': 'correct-secret' }));
    expect(res).toBeNull();
  });

  it('allows when Authorization Bearer matches', () => {
    process.env.INTERNAL_API_SECRET = 'correct-secret';
    const res = requireInternalSecret(makeRequest({ authorization: 'Bearer correct-secret' }));
    expect(res).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/require-internal-secret.test.ts`
Expected: FAIL — `./require-internal-secret` has no exported member `requireInternalSecret` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/require-internal-secret.ts
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Gate a guardrail route to service-to-service callers only. Unlike the
 * existing per-cron `authorized()` helpers (e.g. src/app/api/cron/retention/route.ts),
 * which allow requests through when no secret is configured (for local dev),
 * this fails CLOSED: a missing INTERNAL_API_SECRET denies every request,
 * because an unauthenticated guardrail endpoint would defeat the whole point
 * of the caps layer.
 */
export function requireInternalSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'INTERNAL_API_SECRET not configured' }, { status: 503 });
  }
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const internal = req.headers.get('x-internal-secret') ?? '';
  const provided = internal || bearer;
  if (!provided || !timingSafeStringEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/require-internal-secret.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/require-internal-secret.ts src/lib/require-internal-secret.test.ts
git commit -m "feat(guardrail): add fail-closed internal-secret auth helper"
```

---

### Task 3: Core guardrail lib — check/record/suppress/kill-switch

**Files:**
- Create: `src/lib/guardrail.ts`
- Test: `src/lib/guardrail.test.ts`

**Interfaces:**
- Consumes: `guardrailChannels`, `guardrailCounters`, `suppressionList`, `killSwitches`, `guardrailEvents` from `@/db/schema` (Task 1); `db` from `@/db`.
- Produces: `todayUtc(): string`; `checkAndReserve(channelName: string, count?: number, recipient?: string): Promise<{allowed: boolean; remaining: number; reason?: string}>`; `recordEvent(input: {channel: string; action: 'check'|'record'|'suppress'|'kill_toggle'; allowed?: boolean; reason?: string; metadata?: Record<string, unknown>}): Promise<void>`; `addSuppression(email: string, reason: string, source: string): Promise<void>`; `toggleKillSwitch(scope: string, enabled: boolean, reason: string, updatedBy: string): Promise<void>` — all consumed by Tasks 4, 5, 6, 7.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/guardrail.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same seam as server/ops-summary.test.ts: intercept the drizzle() factory so
// @/db's internals are observable without a real Postgres connection.
const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));

const onConflictDoNothing = vi.fn(async () => undefined);
const onConflictDoUpdate = vi.fn(async () => undefined);
const insertValues = vi.fn(() => ({ onConflictDoNothing, onConflictDoUpdate }));
const insert = vi.fn(() => ({ values: insertValues }));

const execute = vi.fn();

vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: () => ({ select, insert, execute }) }));
vi.mock('postgres', () => ({ default: () => ({}) }));

process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

import { checkAndReserve, recordEvent, addSuppression, toggleKillSwitch } from './guardrail';

const CHANNEL_ROW = { id: 1, name: 'content.publish', category: 'content', dailyCap: 10, enabled: true, spendCeilingCents: 0, description: null };

beforeEach(() => {
  vi.clearAllMocks();
  insertValues.mockImplementation(() => ({ onConflictDoNothing, onConflictDoUpdate }));
});

describe('checkAndReserve', () => {
  it('allows a send within the daily cap and reserves it atomically', async () => {
    limit
      .mockResolvedValueOnce([]) // global kill switch: none
      .mockResolvedValueOnce([CHANNEL_ROW]) // channel lookup
      .mockResolvedValueOnce([]); // channel kill switch: none
    execute
      .mockResolvedValueOnce(undefined) // ensure-row insert
      .mockResolvedValueOnce([{ count: 3 }]); // guarded update+returning

    const result = await checkAndReserve('content.publish', 1);

    expect(result).toEqual({ allowed: true, remaining: 7 });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('denies when the global kill switch is engaged', async () => {
    limit.mockResolvedValueOnce([{ scope: 'global', enabled: true }]);

    const result = await checkAndReserve('content.publish', 1);

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/global kill switch/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('denies an unknown channel', async () => {
    limit
      .mockResolvedValueOnce([]) // no global kill
      .mockResolvedValueOnce([]); // channel lookup: not found

    const result = await checkAndReserve('nonexistent.channel', 1);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'unknown channel: nonexistent.channel' });
  });

  it('denies a disabled channel', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...CHANNEL_ROW, enabled: false }]);

    const result = await checkAndReserve('content.publish', 1);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'channel disabled' });
  });

  it('denies when the channel kill switch is engaged', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([CHANNEL_ROW])
      .mockResolvedValueOnce([{ scope: 'content.publish', enabled: true, reason: 'bounce spike' }]);

    const result = await checkAndReserve('content.publish', 1);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'channel kill switch engaged: bounce spike' });
  });

  it('denies a suppressed recipient', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([CHANNEL_ROW])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'bad@example.com', reason: 'bounced' }]);

    const result = await checkAndReserve('content.publish', 1, 'bad@example.com');

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'recipient suppressed: bounced' });
  });

  it('denies when the daily cap is already reached', async () => {
    limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([CHANNEL_ROW])
      .mockResolvedValueOnce([]);
    execute
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([]); // guarded UPDATE matched no row -> cap reached

    const result = await checkAndReserve('content.publish', 1);

    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'daily cap reached' });
  });
});

describe('recordEvent', () => {
  it('logs an event tied to the resolved channel id', async () => {
    limit.mockResolvedValueOnce([CHANNEL_ROW]);

    await recordEvent({ channel: 'content.publish', action: 'check', allowed: true, reason: 'ok' });

    expect(insert).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 1, action: 'check', allowed: true, reason: 'ok' }),
    );
  });
});

describe('addSuppression', () => {
  it('lowercases the email and upserts idempotently', async () => {
    await addSuppression('Bad@Example.com', 'bounced', 'resend-webhook');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'bad@example.com', reason: 'bounced', source: 'resend-webhook' }),
    );
    expect(onConflictDoNothing).toHaveBeenCalled();
  });
});

describe('toggleKillSwitch', () => {
  it('upserts the kill switch row for the given scope', async () => {
    await toggleKillSwitch('email.qron-drip', true, 'bounce rate 15%', 'system');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'email.qron-drip', enabled: true, reason: 'bounce rate 15%', updatedBy: 'system' }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/guardrail.test.ts`
Expected: FAIL — `./guardrail` module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/guardrail.ts
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { guardrailChannels, guardrailCounters, suppressionList, killSwitches, guardrailEvents } from '@/db/schema';

export type CheckResult = { allowed: boolean; remaining: number; reason?: string };

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically checks every guardrail gate (global kill switch, channel kill
 * switch, channel enabled, suppression, daily cap) and reserves `count`
 * units of the channel's daily cap if allowed. The cap check and increment
 * happen in the same UPDATE statement (`count + n <= dailyCap`), which
 * Postgres evaluates and applies under a single row lock — two concurrent
 * calls against a near-exhausted cap can't both succeed.
 */
export async function checkAndReserve(
  channelName: string,
  count = 1,
  recipient?: string,
): Promise<CheckResult> {
  const [globalKill] = await db.select().from(killSwitches).where(eq(killSwitches.scope, 'global')).limit(1);
  if (globalKill?.enabled) {
    return { allowed: false, remaining: 0, reason: 'global kill switch engaged' };
  }

  const [channel] = await db.select().from(guardrailChannels).where(eq(guardrailChannels.name, channelName)).limit(1);
  if (!channel) {
    return { allowed: false, remaining: 0, reason: `unknown channel: ${channelName}` };
  }
  if (!channel.enabled) {
    return { allowed: false, remaining: 0, reason: 'channel disabled' };
  }

  const [channelKill] = await db.select().from(killSwitches).where(eq(killSwitches.scope, channelName)).limit(1);
  if (channelKill?.enabled) {
    return { allowed: false, remaining: 0, reason: `channel kill switch engaged: ${channelKill.reason ?? 'no reason given'}` };
  }

  if (recipient) {
    const [suppressed] = await db.select().from(suppressionList).where(eq(suppressionList.email, recipient.toLowerCase())).limit(1);
    if (suppressed) {
      return { allowed: false, remaining: 0, reason: `recipient suppressed: ${suppressed.reason}` };
    }
  }

  if (count > channel.dailyCap) {
    return { allowed: false, remaining: 0, reason: 'requested count exceeds daily cap' };
  }

  const today = todayUtc();
  await db.execute(sql`
    INSERT INTO guardrail_counters (channel_id, day, count)
    VALUES (${channel.id}, ${today}, 0)
    ON CONFLICT (channel_id, day) DO NOTHING
  `);
  const updated = await db.execute(sql`
    UPDATE guardrail_counters
    SET count = count + ${count}
    WHERE channel_id = ${channel.id} AND day = ${today} AND count + ${count} <= ${channel.dailyCap}
    RETURNING count
  `);
  const rows = updated as unknown as Array<{ count: number }>;
  if (!rows.length) {
    return { allowed: false, remaining: 0, reason: 'daily cap reached' };
  }
  return { allowed: true, remaining: channel.dailyCap - rows[0].count };
}

export async function recordEvent(input: {
  channel: string;
  action: 'check' | 'record' | 'suppress' | 'kill_toggle';
  allowed?: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const [channel] = await db.select().from(guardrailChannels).where(eq(guardrailChannels.name, input.channel)).limit(1);
  await db.insert(guardrailEvents).values({
    channelId: channel?.id ?? null,
    action: input.action,
    allowed: input.allowed ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function addSuppression(email: string, reason: string, source: string): Promise<void> {
  await db
    .insert(suppressionList)
    .values({ email: email.toLowerCase(), reason, source })
    .onConflictDoNothing({ target: suppressionList.email });
}

export async function toggleKillSwitch(scope: string, enabled: boolean, reason: string, updatedBy: string): Promise<void> {
  await db
    .insert(killSwitches)
    .values({ scope, enabled, reason, updatedBy })
    .onConflictDoUpdate({
      target: killSwitches.scope,
      set: { enabled, reason, updatedBy, updatedAt: new Date() },
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/guardrail.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/guardrail.ts src/lib/guardrail.test.ts
git commit -m "feat(guardrail): add core check/record/suppress/kill-switch logic"
```

---

### Task 4: Machine-facing routes — check, record, suppress

**Files:**
- Create: `src/app/api/guardrail/check/route.ts`
- Create: `src/app/api/guardrail/record/route.ts`
- Create: `src/app/api/guardrail/suppress/route.ts`

**Interfaces:**
- Consumes: `requireInternalSecret` (Task 2), `checkAndReserve`/`recordEvent`/`addSuppression` (Task 3).
- Produces: `POST /api/guardrail/check`, `POST /api/guardrail/record`, `POST /api/guardrail/suppress` — the three HTTP entry points every future sender integration will call.

No dedicated route-level test files — this repo's convention (confirmed: none of `src/app/api/**/route.ts` have `route.test.ts` siblings; business logic is tested at the lib layer, e.g. `src/lib/seo-pages.test.ts`) is to keep route handlers as thin, manually-smoke-tested wrappers around tested lib functions. Verification is the curl smoke test in Step 4 below.

- [ ] **Step 1: Write `check/route.ts`**

```ts
// src/app/api/guardrail/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/require-internal-secret';
import { checkAndReserve } from '@/lib/guardrail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: { channel?: string; count?: number; recipient?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.channel || typeof body.channel !== 'string') {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 });
  }

  try {
    const result = await checkAndReserve(body.channel, body.count ?? 1, body.recipient);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[guardrail/check] failed:', err);
    return NextResponse.json({ allowed: false, remaining: 0, reason: 'internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `record/route.ts`**

```ts
// src/app/api/guardrail/record/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/require-internal-secret';
import { recordEvent } from '@/lib/guardrail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: { channel?: string; action?: string; allowed?: boolean; reason?: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.channel || !body.action) {
    return NextResponse.json({ error: 'channel and action are required' }, { status: 400 });
  }

  try {
    await recordEvent({
      channel: body.channel,
      action: body.action as 'check' | 'record' | 'suppress' | 'kill_toggle',
      allowed: body.allowed,
      reason: body.reason,
      metadata: body.metadata,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[guardrail/record] failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write `suppress/route.ts`**

```ts
// src/app/api/guardrail/suppress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/require-internal-secret';
import { addSuppression, recordEvent } from '@/lib/guardrail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: { email?: string; reason?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.email || !body.reason || !body.source) {
    return NextResponse.json({ error: 'email, reason, and source are required' }, { status: 400 });
  }

  try {
    await addSuppression(body.email, body.reason, body.source);
    await recordEvent({ channel: body.source, action: 'suppress', reason: body.reason, metadata: { email: body.email } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[guardrail/suppress] failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Manual smoke test against a preview deploy**

After deploying to a Vercel preview (or running `pnpm dev` locally with `INTERNAL_API_SECRET` set), run:

```bash
curl -s -X POST "$PREVIEW_URL/api/guardrail/check" \
  -H "x-internal-secret: $INTERNAL_API_SECRET" -H "content-type: application/json" \
  -d '{"channel":"content.publish","count":1}'
```

Expected: `{"allowed":false,"remaining":0,"reason":"unknown channel: content.publish"}` (Task 9's seed script hasn't run yet, so no channel rows exist) — a 200 response with that exact deny reason confirms the auth + wiring path all work end to end. Also confirm a request with no `x-internal-secret` header returns 401 or 503.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/guardrail/check src/app/api/guardrail/record src/app/api/guardrail/suppress
git commit -m "feat(guardrail): add check/record/suppress machine-facing routes"
```

---

### Task 5: Admin-facing routes — status, kill

**Files:**
- Create: `src/app/api/guardrail/status/route.ts`
- Create: `src/app/api/guardrail/kill/route.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/require-admin`, existing), `createClient` (`@/utils/supabase/server`, existing), `toggleKillSwitch`/`recordEvent`/`todayUtc` (Task 3).
- Produces: `GET /api/guardrail/status`, `POST /api/guardrail/kill` — consumed by Task 9's dashboard page.

- [ ] **Step 1: Write `status/route.ts`**

```ts
// src/app/api/guardrail/status/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/require-admin';
import { db } from '@/db';
import { guardrailChannels, guardrailCounters, killSwitches, suppressionList, guardrailEvents } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { todayUtc } from '@/lib/guardrail';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const authResult = await requireAdmin(supabase);
  if (authResult instanceof NextResponse) return authResult;

  const today = todayUtc();
  const [channels, counters, switches, suppression, recentEvents] = await Promise.all([
    db.select().from(guardrailChannels),
    db.select().from(guardrailCounters),
    db.select().from(killSwitches),
    db.select().from(suppressionList),
    db.select().from(guardrailEvents).orderBy(desc(guardrailEvents.createdAt)).limit(100),
  ]);

  const todaysCounters = counters.filter((c) => String(c.day) === today);
  const channelStatus = channels.map((ch) => {
    const counter = todaysCounters.find((c) => c.channelId === ch.id);
    const killSwitch = switches.find((k) => k.scope === ch.name);
    return {
      name: ch.name,
      category: ch.category,
      enabled: ch.enabled,
      dailyCap: ch.dailyCap,
      usedToday: counter?.count ?? 0,
      killSwitchEngaged: killSwitch?.enabled ?? false,
      killSwitchReason: killSwitch?.reason ?? null,
    };
  });

  const globalKillSwitch = switches.find((k) => k.scope === 'global');

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    global_kill_switch: { engaged: globalKillSwitch?.enabled ?? false, reason: globalKillSwitch?.reason ?? null },
    channels: channelStatus,
    suppression_list_size: suppression.length,
    recent_events: recentEvents.map((e) => ({
      channel_id: e.channelId,
      action: e.action,
      allowed: e.allowed,
      reason: e.reason,
      at: e.createdAt,
    })),
  });
}
```

- [ ] **Step 2: Write `kill/route.ts`**

```ts
// src/app/api/guardrail/kill/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/require-admin';
import { toggleKillSwitch, recordEvent } from '@/lib/guardrail';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const authResult = await requireAdmin(supabase);
  if (authResult instanceof NextResponse) return authResult;

  let body: { scope?: string; enabled?: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.scope || typeof body.enabled !== 'boolean' || !body.reason) {
    return NextResponse.json({ error: 'scope, enabled, and reason are required' }, { status: 400 });
  }

  await toggleKillSwitch(body.scope, body.enabled, body.reason, authResult.user.email ?? authResult.user.id);
  await recordEvent({ channel: body.scope, action: 'kill_toggle', allowed: !body.enabled, reason: body.reason });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Manual smoke test**

Signed in as the admin (`ADMIN_EMAIL`), against a preview deploy:

```bash
curl -s "$PREVIEW_URL/api/guardrail/status" -H "cookie: $ADMIN_SESSION_COOKIE"
```

Expected: 200 with `{"channels":[], "global_kill_switch": {"engaged": false, ...}, ...}` (empty until Task 9 seeds channels). Confirm an unauthenticated request returns 401.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/guardrail/status src/app/api/guardrail/kill
git commit -m "feat(guardrail): add admin status and kill-switch routes"
```

---

### Task 6: Anomaly evaluator

**Files:**
- Create: `src/lib/guardrail-anomaly.ts`
- Test: `src/lib/guardrail-anomaly.test.ts`

**Interfaces:**
- Consumes: `guardrailChannels`, `guardrailEvents`, `guardrailCounters` from `@/db/schema`; `toggleKillSwitch`, `recordEvent` from `./guardrail` (Task 3).
- Produces: `evaluateAnomalies(now?: Date): Promise<Array<{channel: string; reason: string}>>` — consumed by Task 7's digest route.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/guardrail-anomaly.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const where = vi.fn();
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));

vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: () => ({ select }) }));
vi.mock('postgres', () => ({ default: () => ({}) }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

const toggleKillSwitch = vi.fn(async () => undefined);
const recordEvent = vi.fn(async () => undefined);
vi.mock('./guardrail', () => ({ toggleKillSwitch, recordEvent }));

import { evaluateAnomalies } from './guardrail-anomaly';

const CHANNEL = { id: 1, name: 'email.qron-drip', category: 'email', dailyCap: 30, enabled: true, spendCeilingCents: 0, description: null };
const NOW = new Date('2026-07-29T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('evaluateAnomalies', () => {
  it('trips a channel whose 24h bounce rate exceeds 10%', async () => {
    const sendEvents = Array.from({ length: 20 }, (_, i) => ({
      id: i, channelId: 1, action: 'record', allowed: true, reason: null,
      metadata: { bounced: i < 4 }, // 4/20 = 20% bounce
      createdAt: NOW,
    }));
    where
      .mockResolvedValueOnce([CHANNEL]) // enabled channels
      .mockResolvedValueOnce(sendEvents); // events for this channel

    const trips = await evaluateAnomalies(NOW);

    expect(trips).toEqual([{ channel: 'email.qron-drip', reason: expect.stringMatching(/bounce rate 20\.0%/) }]);
    expect(toggleKillSwitch).toHaveBeenCalledWith('email.qron-drip', true, expect.stringMatching(/bounce rate/), 'system');
  });

  it('trips a channel whose volume is 3x its trailing 7-day average', async () => {
    where
      .mockResolvedValueOnce([CHANNEL]) // enabled channels
      .mockResolvedValueOnce([]) // no send events
      .mockResolvedValueOnce([
        { id: 1, channelId: 1, day: '2026-07-22', count: 5 },
        { id: 2, channelId: 1, day: '2026-07-28', count: 5 },
        { id: 3, channelId: 1, day: '2026-07-29', count: 30 }, // today, 6x the ~5 avg
      ]);

    const trips = await evaluateAnomalies(NOW);

    expect(trips).toEqual([{ channel: 'email.qron-drip', reason: expect.stringMatching(/volume spike/) }]);
  });

  it('does not trip a healthy channel', async () => {
    where
      .mockResolvedValueOnce([CHANNEL])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, channelId: 1, day: '2026-07-28', count: 10 },
        { id: 2, channelId: 1, day: '2026-07-29', count: 11 },
      ]);

    const trips = await evaluateAnomalies(NOW);

    expect(trips).toEqual([]);
    expect(toggleKillSwitch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/guardrail-anomaly.test.ts`
Expected: FAIL — `./guardrail-anomaly` module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/guardrail-anomaly.ts
import { gte, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { guardrailChannels, guardrailEvents, guardrailCounters } from '@/db/schema';
import { toggleKillSwitch, recordEvent } from './guardrail';

export type AnomalyTrip = { channel: string; reason: string };

const BOUNCE_RATE_THRESHOLD = 0.10;
const VOLUME_SPIKE_MULTIPLIER = 3;
const MIN_SAMPLE_SIZE = 10;

/**
 * Scans the last 24h of guardrail_events per enabled channel and auto-trips
 * that channel's kill switch if the bounce/complaint rate is too high or
 * volume has spiked far above its trailing 7-day average. This is the
 * substitute for per-action human approval: the system polices itself and
 * only surfaces to the owner (via the digest) once something has already
 * been stopped.
 */
export async function evaluateAnomalies(now: Date = new Date()): Promise<AnomalyTrip[]> {
  const trips: AnomalyTrip[] = [];
  const channels = await db.select().from(guardrailChannels).where(eq(guardrailChannels.enabled, true));

  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const channel of channels) {
    const events = await db
      .select()
      .from(guardrailEvents)
      .where(and(eq(guardrailEvents.channelId, channel.id), gte(guardrailEvents.createdAt, since24h)));

    const sendEvents = events.filter((e) => e.action === 'record');
    const bounced = sendEvents.filter((e) => (e.metadata as Record<string, unknown> | null)?.bounced === true);
    if (sendEvents.length >= MIN_SAMPLE_SIZE && bounced.length / sendEvents.length > BOUNCE_RATE_THRESHOLD) {
      const reason = `bounce rate ${(100 * bounced.length / sendEvents.length).toFixed(1)}% over ${sendEvents.length} sends in 24h`;
      await toggleKillSwitch(channel.name, true, reason, 'system');
      await recordEvent({ channel: channel.name, action: 'kill_toggle', allowed: false, reason });
      trips.push({ channel: channel.name, reason });
      continue;
    }

    const counters = await db
      .select()
      .from(guardrailCounters)
      .where(eq(guardrailCounters.channelId, channel.id));

    const todayStr = now.toISOString().slice(0, 10);
    const last7 = counters.filter((c) => {
      const dayStr = new Date(c.day).toISOString().slice(0, 10);
      const dayTime = new Date(c.day).getTime();
      return dayStr !== todayStr && dayTime >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
    });
    const trailingAvg = last7.length ? last7.reduce((sum, c) => sum + c.count, 0) / last7.length : 0;
    const todayCount = counters.find((c) => new Date(c.day).toISOString().slice(0, 10) === todayStr)?.count ?? 0;

    if (trailingAvg > 0 && todayCount > trailingAvg * VOLUME_SPIKE_MULTIPLIER) {
      const reason = `volume spike: ${todayCount} today vs ${trailingAvg.toFixed(1)} trailing 7-day average`;
      await toggleKillSwitch(channel.name, true, reason, 'system');
      await recordEvent({ channel: channel.name, action: 'kill_toggle', allowed: false, reason });
      trips.push({ channel: channel.name, reason });
    }
  }

  return trips;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/guardrail-anomaly.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/guardrail-anomaly.ts src/lib/guardrail-anomaly.test.ts
git commit -m "feat(guardrail): add bounce-rate and volume-spike anomaly evaluator"
```

---

### Task 7: Digest route

**Files:**
- Create: `src/app/api/guardrail/digest/route.ts`

**Interfaces:**
- Consumes: `requireInternalSecret` (Task 2), `evaluateAnomalies` (Task 6), `todayUtc` (Task 3), `sendEmail` from `@/lib/email` (existing), `guardrailChannels`/`guardrailCounters`/`suppressionList` from `@/db/schema`.
- Produces: `GET /api/guardrail/digest` — the single endpoint Task 8's scheduled workflow calls once a day.

- [ ] **Step 1: Write `digest/route.ts`**

```ts
// src/app/api/guardrail/digest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/require-internal-secret';
import { evaluateAnomalies } from '@/lib/guardrail-anomaly';
import { db } from '@/db';
import { guardrailChannels, guardrailCounters, suppressionList } from '@/db/schema';
import { sendEmail } from '@/lib/email';
import { todayUtc } from '@/lib/guardrail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const trips = await evaluateAnomalies();

  const today = todayUtc();
  const [channels, counters, suppression] = await Promise.all([
    db.select().from(guardrailChannels),
    db.select().from(guardrailCounters),
    db.select().from(suppressionList),
  ]);

  const lines = channels.map((ch) => {
    const used = counters.find((c) => c.channelId === ch.id && String(c.day) === today)?.count ?? 0;
    return `- ${ch.name}: ${used}/${ch.dailyCap} today${ch.enabled ? '' : ' (disabled)'}`;
  });

  const tripLines = trips.length ? trips.map((t) => `- ${t.channel}: ${t.reason}`) : ['- none'];

  const body = [
    `Guardrail daily digest — ${today}`,
    '',
    'Channel volume:',
    ...lines,
    '',
    'Auto-trips in the last 24h:',
    ...tripLines,
    '',
    `Suppression list size: ${suppression.length}`,
  ].join('\n');

  const to = process.env.ADMIN_EMAIL || 'undone.k@gmail.com';
  const result = await sendEmail({
    to,
    from: process.env.RESEND_FROM_EMAIL || 'noreply@authichain.com',
    subject: `Guardrail digest — ${today}${trips.length ? ` (${trips.length} auto-trip${trips.length > 1 ? 's' : ''})` : ''}`,
    text: body,
  });

  return NextResponse.json({ ok: result.ok, trips, provider: result.provider });
}
```

- [ ] **Step 2: Manual smoke test**

```bash
curl -s "$PREVIEW_URL/api/guardrail/digest" -H "x-internal-secret: $INTERNAL_API_SECRET"
```

Expected: `{"ok":true,"trips":[],"provider":"resend"}` (or whichever provider `sendEmail` picks) and an email arrives at `ADMIN_EMAIL`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/guardrail/digest
git commit -m "feat(guardrail): add daily digest route (anomaly sweep + summary email)"
```

---

### Task 8: Scheduled trigger (GitHub Actions)

**Files:**
- Create: `.github/workflows/guardrail-digest.yml`

**Interfaces:**
- Consumes: `GET /api/guardrail/digest` (Task 7), the `INTERNAL_API_SECRET` GitHub Actions secret (reuses the same secret name as the Vercel env var — must already exist as a repo secret; if not, that's an owner action, not something this task can do).

This mirrors the exact pattern already used by `.github/workflows/outreach-trigger.yml` (a scheduled workflow curling an endpoint with a secret and failing the job on non-2xx), rather than a Vercel `vercel.json` cron entry — the root `vercel.json` currently has no `crons` array at all (verified directly), and prior stabilization notes flag the account as Vercel Hobby (cron-slot-limited), so a GitHub Actions trigger is the safer, already-proven mechanism here.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/guardrail-digest.yml
name: Guardrail Daily Digest

on:
  schedule:
    - cron: '0 13 * * *'
  workflow_dispatch:

jobs:
  digest:
    runs-on: ubuntu-latest
    steps:
      - name: Run guardrail evaluator + send digest
        run: |
          STATUS=$(curl -sS -o /tmp/resp.json -w "%{http_code}" \
            -H "x-internal-secret: ${{ secrets.INTERNAL_API_SECRET }}" \
            "https://app.authichain.com/api/guardrail/digest")
          cat /tmp/resp.json
          echo "HTTP $STATUS"
          [[ "$STATUS" =~ ^2 ]] || exit 1
```

- [ ] **Step 2: Verify the `INTERNAL_API_SECRET` repo secret exists**

Check (does not require repo write access): `gh secret list --repo <owner>/authichain-unified | grep INTERNAL_API_SECRET`. If missing, this is an owner action (`gh secret set INTERNAL_API_SECRET`) — flag it rather than attempting to set it, since its value must match the same secret already configured in Vercel prod env.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/guardrail-digest.yml
git commit -m "ci: schedule the guardrail daily digest via GitHub Actions"
```

---

### Task 9: Admin dashboard page

**Files:**
- Create: `src/app/admin/guardrail/page.tsx`

**Interfaces:**
- Consumes: `GET /api/guardrail/status` (Task 5), `POST /api/guardrail/kill` (Task 5). Follows the exact visual/structural convention of `src/app/admin/ops/page.tsx` (client component, `fetch` + `useState`/`useEffect`, `protocol-card`/`gold-text`/zinc-900 Tailwind classes).

- [ ] **Step 1: Write the dashboard page**

```tsx
// src/app/admin/guardrail/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, Power, RefreshCw, ShieldAlert } from 'lucide-react';

interface ChannelStatus {
  name: string;
  category: string;
  enabled: boolean;
  dailyCap: number;
  usedToday: number;
  killSwitchEngaged: boolean;
  killSwitchReason: string | null;
}

interface GuardrailStatus {
  generated_at: string;
  global_kill_switch: { engaged: boolean; reason: string | null };
  channels: ChannelStatus[];
  suppression_list_size: number;
  recent_events: Array<{ channel_id: number | null; action: string; allowed: boolean | null; reason: string | null; at: string }>;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function GuardrailDashboard() {
  const [data, setData] = useState<GuardrailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guardrail/status', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleKill(scope: string, enabled: boolean) {
    const reason = window.prompt(`Reason for ${enabled ? 'engaging' : 'releasing'} the kill switch on "${scope}"?`);
    if (!reason) return;
    await fetch('/api/guardrail/kill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope, enabled, reason }),
    });
    void load();
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-red-400 font-mono text-sm">Error: {error}</p>
          <button onClick={() => void load()} className="mt-4 px-4 py-2 border border-zinc-800 rounded text-xs uppercase tracking-widest">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-zinc-500 hover:text-gold text-xs font-bold uppercase tracking-widest mb-3">
              <ChevronLeft className="w-3 h-3" /> Admin
            </Link>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
              Guardrail <span className="gold-text">Console</span>
            </h1>
            <p className="text-zinc-500 mt-2 text-sm uppercase tracking-widest">
              refreshed {data ? formatTime(data.generated_at) : '—'} · suppression list: {data?.suppression_list_size ?? 0}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleKill('global', !(data?.global_kill_switch.engaged ?? false))}
              className={`inline-flex items-center gap-2 px-4 py-2 border rounded text-xs uppercase tracking-widest transition-colors ${
                data?.global_kill_switch.engaged ? 'border-red-500 text-red-400' : 'border-zinc-800 hover:border-red-500/40'
              }`}
            >
              <Power className="w-3 h-3" /> {data?.global_kill_switch.engaged ? 'Global: BLOCKED' : 'Global: Live'}
            </button>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 rounded text-xs uppercase tracking-widest hover:border-gold/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Channels</h2>
          <div className="protocol-card bg-zinc-950/50 border-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/50 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-3">Channel</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Today / Cap</th>
                  <th className="text-left px-4 py-3">Kill Switch</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.channels.length ? (
                  data.channels.map((ch) => (
                    <tr key={ch.name} className="border-t border-zinc-900/50">
                      <td className="px-4 py-3 font-mono text-xs">{ch.name}{!ch.enabled && <span className="text-zinc-600"> (disabled)</span>}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{ch.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{ch.usedToday} / {ch.dailyCap}</td>
                      <td className="px-4 py-3 text-xs">
                        {ch.killSwitchEngaged ? (
                          <span className="inline-flex items-center gap-1 text-red-400">
                            <ShieldAlert className="w-3 h-3" /> {ch.killSwitchReason ?? 'engaged'}
                          </span>
                        ) : (
                          <span className="text-green-400">clear</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleKill(ch.name, !ch.killSwitchEngaged)}
                          className="px-3 py-1 border border-zinc-800 rounded text-[10px] uppercase tracking-widest hover:border-gold/40"
                        >
                          {ch.killSwitchEngaged ? 'Release' : 'Trip'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-700 text-xs uppercase tracking-widest">
                      No channels seeded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Recent Events</h2>
          <div className="protocol-card bg-zinc-950/50 border-zinc-900 divide-y divide-zinc-900/50">
            {data?.recent_events.length ? (
              data.recent_events.map((e, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full ${e.allowed === false ? 'bg-red-400' : 'bg-green-400'}`} />
                    <span className="font-mono text-xs">{e.action}</span>
                    <span className="text-[10px] text-zinc-600">{e.reason ?? ''}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600">{formatTime(e.at)}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-12 text-center text-zinc-700 text-xs uppercase tracking-widest">
                No recent events
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test in a browser**

Sign in as the admin, visit `/admin/guardrail` on a preview deploy, confirm the page loads without error (empty channel table is expected before Task 10 seeds any rows), and that the global kill-switch button round-trips (click, confirm the prompt, confirm the row updates after refresh).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/guardrail
git commit -m "feat(guardrail): add admin dashboard page"
```

---

### Task 10: Seed initial channel rows

**Files:**
- Create: `scripts/seed-guardrail-channels.ts`

**Interfaces:**
- Consumes: `@supabase/supabase-js` directly (this repo's established convention for standalone `tsx` scripts — see `scripts/send-digest.ts` — since `@/`-aliased Drizzle imports aren't reliably resolvable outside the Next.js build).

Every row is seeded with `enabled: false` — nothing can pass a guardrail check until the owner explicitly flips a channel on (via the dashboard or a direct DB update) and reviews/adjusts its `daily_cap`. This deliberately avoids guessing real per-channel volume numbers in this plan.

- [ ] **Step 1: Write the seed script**

```ts
// scripts/seed-guardrail-channels.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CHANNELS: Array<{ name: string; category: string; daily_cap: number; description: string }> = [
  { name: 'email.qron-drip', category: 'email', daily_cap: 25, description: 'Supabase pg_cron qron-drip-sequence — not yet integrated with this guardrail; seeded disabled as a placeholder for when it is.' },
  { name: 'email.b2b-cold', category: 'email', daily_cap: 25, description: 'ops/scripts/b2b-cold-outreach.ts weekly cold outreach — not yet integrated with this guardrail.' },
  { name: 'content.publish', category: 'content', daily_cap: 10, description: 'SEO/content page publishing (sub-project 3, not yet built).' },
  { name: 'licensing.docusign', category: 'contract', daily_cap: 5, description: 'licensing_closer contract-value actions (DocuSign envelopes, setup-fee links) — not yet integrated with this guardrail.' },
  { name: 'partnership.outreach', category: 'email', daily_cap: 10, description: 'Partnership/affiliate outreach (sub-project 4, not yet built).' },
];

async function main() {
  for (const ch of CHANNELS) {
    const { error } = await supabase
      .from('guardrail_channels')
      .upsert({ ...ch, enabled: false, spend_ceiling_cents: 0 }, { onConflict: 'name', ignoreDuplicates: true });
    if (error) {
      console.error(`Failed to seed channel ${ch.name}:`, error.message);
      process.exitCode = 1;
      continue;
    }
    console.log(`Seeded channel: ${ch.name} (disabled, cap=${ch.daily_cap}/day)`);
  }
}

main();
```

- [ ] **Step 2: Run it against the live database (confirm with the owner first)**

Get explicit confirmation before this step (it writes to the live Supabase project, same caveat as Task 1 Step 4). Then:

```bash
wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified; export NVM_DIR=$HOME/.nvm; . $NVM_DIR/nvm.sh; nvm use 22 >/dev/null; export PATH="$(echo "$PATH"|tr ":" "\n"|grep -v /mnt/c/|paste -sd : -):$HOME/.nvm/versions/node/v22.22.3/bin"; pnpm exec tsx scripts/seed-guardrail-channels.ts'
```

Expected: 5 lines of `Seeded channel: ...` output, no errors.

- [ ] **Step 3: Re-run Task 4's smoke test to confirm end-to-end behavior**

```bash
curl -s -X POST "$PREVIEW_URL/api/guardrail/check" \
  -H "x-internal-secret: $INTERNAL_API_SECRET" -H "content-type: application/json" \
  -d '{"channel":"content.publish","count":1}'
```

Expected now: `{"allowed":false,"remaining":0,"reason":"channel disabled"}` — proves the channel row is found and the `enabled` gate is correctly the thing blocking it (not a lookup failure). Visit `/admin/guardrail` and confirm all 5 channels now appear in the table.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-guardrail-channels.ts
git commit -m "feat(guardrail): seed initial channel rows (disabled by default)"
```

---

## Plan Self-Review

**Spec coverage:** Data model (5 tables) → Task 1. API surface (`check`/`record`/`status`/`suppress`/`kill`) → Tasks 4-5. Anomaly/auto-trip → Task 6. Alerting/digest → Task 7-8. Dashboard → Task 9. Error handling (fail-closed) → built into Task 2's helper and every route's try/catch. Testing (unit + concurrency reasoning + manual smoke) → each task's own test step plus the atomicity argument documented in Task 3's `checkAndReserve` doc comment. Integration follow-ups (CF worker, b2b-cold-outreach, agentz, Supabase edge function) are explicitly out of scope per the spec's Non-goals — correctly not tasked here.

**Placeholder scan:** No TBD/TODO; every code block is complete and runnable as written.

**Type consistency:** `CheckResult`, `AnomalyTrip`, and the `guardrailChannels`/`guardrailCounters`/`suppressionList`/`killSwitches`/`guardrailEvents` table names and field names (`dailyCap`, `channelId`, `enabled`, `scope`, `reason`, `updatedBy`, `metadata`) are used identically across Tasks 1, 3, 4, 5, 6, 7, 9, and 10.
