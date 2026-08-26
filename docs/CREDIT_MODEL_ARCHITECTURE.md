# Credit Model Architecture: Reconciliation

**Date:** 2026-08-23  
**Status:** Documentation + Cleanup Phase  
**Audience:** Platform architects, provisioning engineers, billing team

---

## Overview: Three Models in One Codebase

The AuthiChain platform contains **three distinct credit/entitlement models**, reflecting different design iterations:

1. **seal_credits** (Designed, Never Integrated)
2. **subscriptions** table (Drizzle ORM, Not Used)
3. **profiles.generations_limit** (Deployed, Active)

Only model #3 is active in production. This document explains why and provides a path forward.

---

## Model 1: seal_credits (Designed, Abandoned)

### Concept
Per-seal, fine-grained credit tracking. Each purchase would create individual credit records in a `seal_credits` table with:
- Expiration dates per seal
- Usage tracking per seal
- Refund capability per seal
- Credit-bucket isolation (UI mode vs. generation mode)

### Design Rationale
- **Granular control**: Users could see exactly which seal was used for which action
- **Time-based expiration**: Credits expire after X days, encouraging engagement
- **Refund transparency**: Each seal refund is separately tracked
- **Multi-mode support**: Different credit buckets per mode (e.g., UI gen, BTC mode, etc.)

### Why Abandoned
1. **Schema complexity**: Requires joins across users → seal_credits → usage logs
2. **Query overhead**: Every generation check needs seal lookup + expiration validation
3. **UX cognitive load**: Users see dozens of individual seals instead of one balance
4. **Refund complexity**: Handling partial seal usage and refunds per seal
5. **Simpler alternative available**: The subscriptions model (plan-based) achieves the same business goal

### Current State
- **Code references**: Zero (`grep -r seal_credits` returns no matches)
- **Schema location**: Possibly defined in early migrations but never connected to provisioning
- **Recommendation**: Mark as deprecated; archive migration if it exists

---

## Model 2: subscriptions (Drizzle ORM, Not Deployed)

### Concept
A legacy subscription model managed through Drizzle ORM at `src/db/schema.ts`:

```typescript
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull(),
  plan: varchar('plan', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  monthlyQuota: integer('monthlyQuota').notNull(),
  usedQuota: integer('usedQuota').default(0),
  stripeCustomerId: varchar('stripeCustomerId', { length: 128 }),
  stripeSubscriptionId: varchar('stripeSubscriptionId', { length: 128 }),
  billingCycle: varchar('billingCycle', { length: 50 }).default('monthly'),
  currentPeriodStart: timestamp('currentPeriodStart'),
  currentPeriodEnd: timestamp('currentPeriodEnd'),
  trialEndsAt: timestamp('trialEndsAt'),
  cancelledAt: timestamp('cancelledAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});
```

### Design Rationale
- **Separate entitlements**: Subscriptions tracked in their own table
- **Quota management**: monthlyQuota and usedQuota allow per-month limits
- **Billing cycle tracking**: currentPeriodStart/End for subscription lifecycle

### Why Not Deployed
1. **provisioning.ts uses profiles**: The checkout.session.completed webhook calls `provisionPurchase()`, which upserts `profiles.generations_limit`, never touches `subscriptions` table
2. **Drizzle schema drift**: The `subscriptions` table definition exists in Drizzle, but the **active** provisioning path in `src/app/api/stripe/webhook/route.ts` ignores it
3. **No read path**: No code queries the `subscriptions` table for entitlements; generation checks query `profiles.generations_limit` instead
4. **Dual schema mismatch**: Drizzle table ≠ Supabase profiles table

### Current State
- **Code references**: Defined in `src/db/schema.ts` but never queried in provisioning path
- **Admin queries**: `getSubscriptionAnalytics()` in `server/admin/router.ts` does query it, but only for analytics/reporting
- **Recommendation**: Decide: either remove it entirely, or use it for the actual provisioning (major refactor)

---

## Model 3: profiles.generations_limit (Deployed, Active)

### Concept
Unified credit model on the Supabase `profiles` table (outside Drizzle schema):

```sql
-- Supabase profiles table (not in Drizzle ORM)
ALTER TABLE profiles ADD COLUMN (
  generations_limit INTEGER DEFAULT 0,
  generations_used INTEGER DEFAULT 0,
  subscription_plan VARCHAR(50),
  subscription_status VARCHAR(50),
  subscribed_at TIMESTAMP,
  last_payment_at TIMESTAMP,
  stripe_customer_id VARCHAR(128),
  stripe_subscription_id VARCHAR(128)
);
```

### Design Rationale
- **Simple mental model**: One profile = one subscription = one generation budget
- **Minimal schema**: Just two integers (limit, used) per user
- **Fast lookups**: No joins; direct `profiles.generations_limit` query on every generation
- **Billing clarity**: Plan price maps directly to a generation count
- **Subscription integration**: `invoice.paid` events refill `generations_limit` each period

### Where It's Used
1. **Provisioning entry point** (`src/app/api/stripe/webhook/route.ts:142-235`)
   - `checkout.session.completed` → `provisionPurchase()` → upsert `profiles.generations_limit`
   
2. **Generation authorization** (assumed in `src/app/_home/QronHome.tsx` or generation endpoints)
   - Check `profiles.generations_used < profiles.generations_limit` before allowing generation
   
3. **Dunning & retention** (`server/jobs/dunning.ts`, `server/jobs/retention.ts`)
   - Query `subscriptions` table for past-due status, but the **entitlements** are in `profiles.generations_limit`

4. **Admin analytics** (`server/admin/router.ts`)
   - Reports use `subscriptions` table for subscription status breakdown (not generations_limit)

### Current State
- **Status**: Live in production
- **Usage**: Active in checkout webhook provisioning, generation authorization
- **No expiration logic**: Credits don't expire; they last until end of subscription period or manual override
- **Recommendation**: Standardize on this model; document it clearly; migrate subscriptions table to match

---

## The Discrepancy Explained

### Why Two Tables?
```
Deployed provisioning path:
  Stripe event → Next.js webhook → getSupabase() → profiles.update({ generations_limit })
  
Drizzle schema defines:
  subscriptions table (not touched by provisioning)

Supabase defines (outside Drizzle):
  profiles table (with generations_limit column)
```

**Root Cause**: The provisioning flow was built against a Supabase backend first, then Drizzle ORM was added for other features (products, authentications, etc.). The `subscriptions` table in Drizzle was intended to model subscriptions, but the **actual** provisioning path uses the raw Supabase `profiles` table, bypassing Drizzle entirely.

### Why seal_credits Was Abandoned
1. **Complexity vs. benefit**: Fine-grained per-seal tracking adds query overhead for minimal UX gain
2. **Early-stage product**: Credit-only model gave way to plan-based subscriptions (starter/creator/theater)
3. **Simpler won**: Users prefer "I have 500 generations" over "I have 12 seals, 7 of which expire in 3 days"

---

## Reconciliation: Path Forward

### Short-term (This Sprint)
✅ **Done**: Documented the three models in this file  
✅ **Done**: Added admin dashboard churn signals (uses subscriptions table for status)  
⏳ **Pending**: Decide on subscriptions table fate

### Medium-term (Next Sprint)
- **Option A: Unify on profiles model**
  - Remove `subscriptions` table from Drizzle schema
  - Migrate all subscription state to `profiles` table columns
  - Benefits: Single source of truth; simpler queries
  - Risk: Requires data migration if any code still writes to subscriptions

- **Option B: Mirror subscriptions ↔ profiles**
  - Keep Drizzle subscriptions; write provisioning to both tables
  - Add triggers or migration sync to keep them in sync
  - Benefits: Drizzle code can use subscriptions; backward compatible
  - Risk: Data consistency issues; double writes

- **Recommendation**: **Option A (Unify on profiles)**
  - Search codebase for any writes to `subscriptions` table
  - If none found (likely), deprecate it and remove from schema
  - Update admin queries to read from profiles if needed

### Long-term (Architecture)
1. **Single source of truth**: All entitlement state → `profiles` table columns
2. **One schema layer**: Drizzle ORM or Supabase migrations, not both
3. **Clear model**: Plan-based subscriptions with monthly quota reset on `invoice.paid`
4. **No seal_credits**: Close that design chapter with a migration note

---

## Action Items

### Code Review Checklist
- [ ] Search codebase for writes to `subscriptions` table (expect: 0)
- [ ] Verify provisioning flow only touches `profiles.generations_limit`
- [ ] Confirm admin.revenueStats reads from `subscriptions` (expected)
- [ ] Check if seal_credits table exists in any migration (expect: defined but orphaned)

### Cleanup Tasks
- [ ] Add deprecation comment to `subscriptions` table in Drizzle schema
- [ ] Archive seal_credits migration (if exists) with a note in commit message
- [ ] Update schema docs to point developers to `profiles` table for entitlements
- [ ] Add code comment to provisioning.ts explaining why Supabase profiles, not Drizzle subscriptions

### Testing
- [ ] Run a test checkout.session.completed webhook; verify profiles.generations_limit is set
- [ ] Verify admin dashboard shows pastDueSubs from subscriptions table (still valid for tracking)
- [ ] Confirm no generation endpoint reads from subscriptions table

---

## References

### Related Files
- `src/app/api/stripe/webhook/route.ts` — Provisioning entry point (lines 142-235)
- `src/lib/provisioning.ts` — Credit grant logic (lines 50-105)
- `src/db/schema.ts` — Drizzle definitions (lines 269-287 subscriptions)
- `server/admin/router.ts` — Admin analytics using subscriptions
- `server/jobs/dunning.ts` — Past-due subscription escalation

### Architecture Docs
- `docs/superpowers/truth-layer.md` (if exists) — Truth Layer audit trail
- `.github/workflows/deploy-*.yml` — Deployment gates for schema changes

---

## Glossary

| Term | Definition | Location |
|------|-----------|----------|
| **subscriptions** | Drizzle ORM table model; tracks subscription lifecycle (status, period dates) | Drizzle schema, sometimes read by admin |
| **profiles** | Supabase table; stores user data + entitlements (generations_limit) | Supabase backend, used by provisioning |
| **generations_limit** | Credit grant given on purchase; budget for generation requests | profiles.generations_limit |
| **generations_used** | Cumulative generations consumed; reset on subscription renewal | profiles.generations_used |
| **seal_credits** | Abandoned design for per-seal credit tracking with expiration | Never implemented |
| **provisioning** | Process of granting credits on checkout.session.completed | `src/lib/provisioning.ts` |

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-23  
**Maintainer**: Engineering team  
**Status**: Active (reference architecture)
