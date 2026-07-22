// server/_core/db-helpers.ts
//
// Db-parameterized replacements for the handful of server/db.ts helper
// functions used by server/_core/** (excluding context.ts, context.workers.ts,
// and sdk.ts, which are Task 1/2's territory and correctly use
// getDb()/getHyperdriveDb() directly). server/db.ts's helpers all close over
// the module-scope getDb() singleton (Node-only, process.env.DATABASE_URL),
// which is incompatible with Cloudflare Workers' per-request env bindings.
//
// These do the same queries but take an explicit `db` instance instead of
// reaching for the singleton themselves.
import { desc, gte } from 'drizzle-orm';
import { users, scheduledJobRuns, type InsertUser } from '../../drizzle/schema';
import { ENV } from './env';
import type { getHyperdriveDb } from '../db';

export type Db = ReturnType<typeof getHyperdriveDb>;

// ─── Users (mirrors server/db.ts's upsertUser — the version server/_core/oauth.ts
// actually calls; NOT server/db/users.ts's separate, unused implementation) ───

export async function upsertUser(db: Db, user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error('User openId is required for upsert');
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ['name', 'email', 'loginMethod'] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      (values as any)[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.role) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if ((user as any).points !== undefined) {
      (values as any).points = (user as any).points;
      updateSet.points = (user as any).points;
    }

    if (user.lastSignedIn) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    } else if (user.openId === ENV.ownerOpenId) values.role = 'admin';

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error('[Database] Failed to upsert user:', error);
    throw error;
  }
}

// ─── Ops console aggregation (used by /api/admin/ops in server/_core/app.ts) ──
// Job statuses are running/completed/failed; the console speaks success/failure.
export async function getOpsSummary(db: Db, windowHours = 24) {
  const since = new Date(Date.now() - windowHours * 3600_000);
  const runs = await db
    .select()
    .from(scheduledJobRuns)
    .where(gte(scheduledJobRuns.startedAt, since))
    .orderBy(desc(scheduledJobRuns.startedAt))
    .limit(500);

  const toUiStatus = (s: string) => (s === 'completed' ? 'success' : s === 'failed' ? 'failure' : s);

  type SummaryEntry = { success: number; failure: number; lastSeen: Date; lastError: string | null };
  const byJob = new Map<string, SummaryEntry>();
  for (const r of runs) {
    const entry = byJob.get(r.jobName) ?? { success: 0, failure: 0, lastSeen: r.startedAt, lastError: null };
    if (r.status === 'completed') entry.success++;
    if (r.status === 'failed') {
      entry.failure++;
      entry.lastError ??= r.error || '(no message)';
    }
    if (r.startedAt > entry.lastSeen) entry.lastSeen = r.startedAt;
    byJob.set(r.jobName, entry);
  }

  const summary = Array.from(byJob.entries())
    .map(([name, v]) => ({
      workflow: name,
      success: v.success,
      failure: v.failure,
      last_seen: v.lastSeen.toISOString(),
      last_error: v.lastError,
    }))
    .sort((a, b) => b.failure - a.failure || b.success - a.success);

  const failures = runs
    .filter(r => r.status === 'failed')
    .slice(0, 50)
    .map(r => ({
      workflow: r.jobName,
      error: r.error,
      payload: r.result ? JSON.stringify(r.result) : null,
      at: r.startedAt.toISOString(),
    }));

  const recent = runs.slice(0, 50).map(r => ({
    workflow: r.jobName,
    status: toUiStatus(r.status),
    at: r.startedAt.toISOString(),
  }));

  return {
    window_hours: windowHours,
    generated_at: new Date().toISOString(),
    totals: {
      success: runs.filter(r => r.status === 'completed').length,
      failure: runs.filter(r => r.status === 'failed').length,
    },
    summary,
    failures,
    recent,
  };
}
