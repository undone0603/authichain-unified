# Webhook Idempotency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `hasWebhookEventProcessed`-based dedup in the Stripe webhook handler with an atomic, race-safe dedup backed by a dedicated `webhook_events` table with a `UNIQUE(provider, event_id)` constraint.

**Architecture:** Add a `webhookEvents` Postgres table. Replace check-then-insert with a single `INSERT ... ON CONFLICT DO NOTHING RETURNING id` "claim" operation: a returned id means first delivery (run side effects); no row returned means duplicate (skip). Mark `processedAt` on success. This eliminates the four bugs in the existing implementation: bounded scan, post-side-effect dedup write, TOCTOU race, and dependence on `activityLog` containing an `audit:*` row.

**Tech Stack:** Postgres + drizzle-orm/drizzle-kit, vitest, existing webhook flow in `server/webhooks/stripe.ts`.

---

## Background — what's broken today

Findings from the audit (full detail in conversation log):

1. `hasWebhookEventProcessed` (`server/db.ts:1194`) does `.select(...).where(like(action, 'audit:%')).limit(100)` with **no `ORDER BY`** — non-deterministic 100-row sample.
2. The dedup audit row is written **after** all side effects. Mid-handler crash → no audit row → retry re-runs side effects.
3. No UNIQUE constraint, no transaction → **TOCTOU race** on concurrent retries.
4. Dedup is keyed off `activityLog` rows whose `action` starts with `audit:` — coupling dedup to a side-effect log.

Affected non-idempotent side effects on `checkout.session.completed`: `recordRevenue`, `logActivity('lead_closed_won')`, the `logAutomationAudit` call itself.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `drizzle/schema.ts` | Modify (add table) | Define `webhookEvents` table with composite unique index |
| `drizzle/0006_*.sql` | Create (drizzle-kit) | Generated migration to apply to Postgres |
| `server/db.ts` | Modify | Add `claimWebhookEvent` + `markWebhookEventProcessed`; remove `hasWebhookEventProcessed` |
| `server/webhooks/stripe.ts` | Modify | Replace dedup block; mark processed at end of switch |
| `server/test-setup.ts` | Modify | Mock the two new db functions so unrelated tests don't break |

The existing tests for `order-payment-handler`, `order-payment-decision`, etc. continue to pass without changes — they don't go through the webhook entry point.

---

## Tasks

### Task 1: Add `webhookEvents` table to drizzle schema

**Files:**
- Modify: `drizzle/schema.ts` (append a new table near `activityLog`, around line 498)

- [ ] **Step 1: Add the table definition**

Append after the `activityLog` block (line 498):

```ts
// ─── Webhook Event Dedup ──────────────────────────────────────────────────
// Atomic claim/process tracker for inbound webhook events from external
// providers (Stripe, Paddle, etc.). UNIQUE(provider, eventId) lets us use
// INSERT ... ON CONFLICT DO NOTHING as a race-safe dedup primitive.
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  eventId: varchar("eventId", { length: 128 }).notNull(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
}, (t) => ({
  uniqProviderEvent: uniqueIndex("webhook_events_provider_eventId_uniq").on(t.provider, t.eventId),
}));
```

`uniqueIndex` is already imported at the top of the file — no import changes needed.

- [ ] **Step 2: Verify the schema compiles**

Run: `pnpm check`
Expected: clean (no errors).

### Task 2: Generate the drizzle migration

**Files:**
- Create: `drizzle/0006_<random_name>.sql` (drizzle-kit generates the filename)
- Create/modify: `drizzle/meta/_journal.json`, `drizzle/meta/0006_snapshot.json`

- [ ] **Step 1: Run drizzle-kit generate**

Run: `pnpm exec drizzle-kit generate`
Expected: a new `drizzle/0006_*.sql` file with `CREATE TABLE "webhook_events"` and `CREATE UNIQUE INDEX "webhook_events_provider_eventId_uniq"`.

- [ ] **Step 2: Inspect the generated SQL**

Open the new file. Confirm:
- `CREATE TABLE "webhook_events"` with the 6 columns
- `CREATE UNIQUE INDEX ... ON "webhook_events" ("provider", "eventId")`
- No unrelated changes to other tables

If anything else changed, that means the schema drifted at some point — stop and investigate before proceeding.

- [ ] **Step 3: Do NOT run `drizzle-kit migrate`**

Migrations are applied by ops at deploy time. Committing the SQL file is enough; the user will apply it via `pnpm db:push` (or equivalent) when merging.

### Task 3: Add `claimWebhookEvent` + `markWebhookEventProcessed` to db.ts

**Files:**
- Modify: `server/db.ts` (replace `hasWebhookEventProcessed` at line 1194 with the two new functions)

- [ ] **Step 1: Add `webhookEvents` to the schema imports**

In the import block from `../drizzle/schema` near the top of `server/db.ts` (around line 7-49), add `webhookEvents` to the alphabetized list:

```ts
import {
  // ... existing imports ...
  serviceOrders,
  webhookEvents,         // ← add
  missions,
  missionTasks,
  // ...
} from "../drizzle/schema";
```

- [ ] **Step 2: Replace `hasWebhookEventProcessed` with the new functions**

Find the existing block at `server/db.ts:1194-1203`:

```ts
export async function hasWebhookEventProcessed(eventId: string): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select().from(activityLog)
    .where(like(activityLog.action, `audit:%`))
    .limit(100);
  return rows.some(r => {
    const details = r.details as any;
    return details?.eventId === eventId;
  });
}
```

Replace it with:

```ts
/**
 * Atomically claim a webhook event for processing.
 * Returns true if this delivery is the first one (caller should run side effects).
 * Returns false if the event was already claimed (caller should skip — duplicate).
 *
 * Backed by INSERT ... ON CONFLICT DO NOTHING against the UNIQUE(provider, eventId)
 * index on webhook_events. This is race-safe: two concurrent claims for the same
 * eventId result in exactly one returned row.
 */
export async function claimWebhookEvent(
  provider: string,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const d = await getDb();
  const inserted = await d.insert(webhookEvents)
    .values({ provider, eventId, eventType })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });
  return inserted.length > 0;
}

/**
 * Stamp a successfully-processed webhook event with `processedAt = now()`.
 * No-op if the row doesn't exist (shouldn't happen — `claimWebhookEvent` always
 * inserts the row first).
 */
export async function markWebhookEventProcessed(provider: string, eventId: string): Promise<void> {
  const d = await getDb();
  await d.update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)));
}
```

`and`, `eq` are already imported at the top of `db.ts`.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm check`
Expected: clean.

### Task 4: Refactor the Stripe webhook handler

**Files:**
- Modify: `server/webhooks/stripe.ts` (replace dedup block at lines 144-148; add mark-processed at end of switch around line 472)

- [ ] **Step 1: Update the import block**

Find lines 17-26:

```ts
import {
  logActivity,
  logAutomationAudit,
  recordRevenue,
  upsertStripeSubscription,
  setSubscriptionStatusByStripeId,
  getSubscriptionByStripeSubscriptionId,
  createSystemNotification,
  hasWebhookEventProcessed,
} from "../db";
```

Replace with:

```ts
import {
  logActivity,
  logAutomationAudit,
  recordRevenue,
  upsertStripeSubscription,
  setSubscriptionStatusByStripeId,
  getSubscriptionByStripeSubscriptionId,
  createSystemNotification,
  claimWebhookEvent,
  markWebhookEventProcessed,
} from "../db";
```

- [ ] **Step 2: Replace the dedup check**

Find lines 144-148:

```ts
  // Idempotency — skip if we already processed this event
  if (await hasWebhookEventProcessed(event.id)) {
    console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`);
    return { received: true, type: event.type, duplicate: true };
  }
```

Replace with:

```ts
  // Idempotency — atomic claim against UNIQUE(provider, eventId).
  // First delivery: claim returns true, side effects run.
  // Duplicate / concurrent retry: claim returns false, skip.
  const claimed = await claimWebhookEvent("stripe", event.id, event.type);
  if (!claimed) {
    console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`);
    return { received: true, type: event.type, duplicate: true };
  }
```

- [ ] **Step 3: Mark the event processed at the end of the switch**

Find the final return at line 472:

```ts
  return { received: true, type: event.type, handled: true };
}
```

Replace with:

```ts
  // Side effects ran successfully — stamp the claim so we have a complete record
  // (rows with processedAt = NULL indicate handlers that crashed mid-processing
  // and are useful for ops alerting; production runs should leave none stuck).
  await markWebhookEventProcessed("stripe", event.id);
  return { received: true, type: event.type, handled: true };
}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm check`
Expected: clean.

### Task 5: Add the new functions to test-setup mocks

**Files:**
- Modify: `server/test-setup.ts` (add the two new functions to the global db mock)

The global mock spreads `...actual` so missing functions fall through to the real implementation. The real `claimWebhookEvent` calls `getDb()` (mocked) and chains `.insert().values().onConflictDoNothing().returning()` — `onConflictDoNothing` doesn't exist on the stub chain. Without an explicit mock, any test path that triggers the webhook handler would crash.

- [ ] **Step 1: Add the mocks**

Find this block in `server/test-setup.ts` (around line 76):

```ts
    incrementScanCount: vi.fn().mockResolvedValue(undefined),
  };
});
```

Insert two lines before `incrementScanCount`:

```ts
    incrementScanCount: vi.fn().mockResolvedValue(undefined),
    claimWebhookEvent: vi.fn().mockResolvedValue(true),
    markWebhookEventProcessed: vi.fn().mockResolvedValue(undefined),
  };
});
```

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: 322/322 pass (no regressions).

### Task 6: Final verification + commit + push

- [ ] **Step 1: Run typecheck, build, full test suite**

Run: `pnpm check && pnpm test && pnpm build`
Expected: all three succeed.

- [ ] **Step 2: Stage the affected files**

```bash
git add drizzle/schema.ts drizzle/0006_*.sql drizzle/meta/ server/db.ts server/webhooks/stripe.ts server/test-setup.ts
```

Do NOT stage `api/server.js` (build artifact left over from prior session).

- [ ] **Step 3: Commit**

Use a HEREDOC for the message:

```bash
git commit -m "$(cat <<'EOF'
fix(webhook): atomic dedup via webhook_events table

Replaces the broken hasWebhookEventProcessed scan with a UNIQUE-backed
INSERT ... ON CONFLICT DO NOTHING claim. Fixes four idempotency bugs:

- Bounded 100-row scan with no ORDER BY (could miss recent events under
  load — Stripe retries up to 3 days)
- Dedup row written AFTER side effects: mid-handler crash → no audit
  row → retry re-runs side effects (e.g., recordRevenue double-counts)
- TOCTOU race: two concurrent retries both pass the check, both run
- Coupling to activityLog rows with action LIKE 'audit:%'

New schema: webhook_events(provider, eventId, eventType, receivedAt,
processedAt) with UNIQUE(provider, eventId). Claim is the INSERT;
processedAt is stamped after the switch completes. Rows with
processedAt = NULL are stuck mid-processing — useful for ops alerting.

Migration: drizzle/0006_*.sql. Apply via pnpm db:push at deploy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push**

Run: `git push -u origin audit/webhook-idempotency`
Expected: branch published.

- [ ] **Step 5: Open PR**

Run: `gh pr create --title "fix(webhook): atomic dedup via webhook_events table" --body "$(cat <<'EOF'
## Summary
- Replaces the bounded 100-row activity-log scan with an atomic `INSERT ... ON CONFLICT DO NOTHING` against a new `webhook_events` table
- Fixes four idempotency bugs documented in commit message: bounded scan, post-side-effect dedup write, TOCTOU race on concurrent retries, dependence on activityLog `audit:*` rows
- Includes drizzle migration `0006_*.sql`

## Deploy notes
The migration must be applied before the new code reaches production:
\`\`\`
pnpm db:push  # drizzle-kit generate (already done) && drizzle-kit migrate
\`\`\`

## Test plan
- [x] `pnpm check` clean (tests included in tsc since PR #75)
- [x] `pnpm test` — 322/322 pass
- [x] `pnpm build` clean
- [ ] After merge + db migration: send a test webhook twice from Stripe dashboard, verify second delivery returns `{duplicate: true}` and `recordRevenue`/`logActivity` are NOT called twice

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"`

---

## Self-review checklist

**Spec coverage:**
- [x] Bug 1 (bounded scan / no ORDER BY): fixed by removing scan entirely
- [x] Bug 2 (post-side-effect dedup): fixed by claim-first / mark-processed-after
- [x] Bug 3 (TOCTOU race): fixed by UNIQUE constraint
- [x] Bug 4 (activityLog coupling): fixed by dedicated table
- [x] `recordRevenue` not double-called on retry: claim returns false → switch is skipped
- [x] `logAutomationAudit` not double-called: same path
- [x] Forward-compatible with paddle/other providers via `provider` column

**Placeholder scan:** None.

**Type consistency:**
- `claimWebhookEvent(provider, eventId, eventType)` — used consistently in db.ts (Task 3) and webhooks/stripe.ts (Task 4)
- `markWebhookEventProcessed(provider, eventId)` — same shape both places
- Column names `provider`/`eventId`/`eventType`/`receivedAt`/`processedAt` consistent between schema, db functions, and migration

**Out of scope (intentional):**
- Refactoring `paddle/webhook.ts` to use the same dedup. Separate PR.
- Adding monitoring for stuck rows (`processedAt IS NULL` and old). Ops concern.
- Removing the `event.id.startsWith("evt_test_")` test escape hatch. Pre-existing, not caused by this change.
