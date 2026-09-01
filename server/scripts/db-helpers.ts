// server/scripts/db-helpers.ts
//
// Db-parameterized replacements for the handful of server/db.ts helper
// functions used by server/scripts/**. server/db.ts's helpers all close
// over the module-scope getDb() singleton (Node-only, process.env.DATABASE_URL),
// which is incompatible with Cloudflare Workers' per-request env bindings.
//
// These do the same queries but take an explicit `db` instance instead of
// reaching for the singleton themselves. server/scripts/** are standalone
// Node CLI scripts (run via tsx) with no per-request caller to thread a db
// from, so each script resolves `db` once at its own entrypoint via a
// documented getDb() bridge and passes it into these helpers.
import { randomUUID } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { leads, missions, missionTasks } from '../../drizzle/schema';
import type { getHyperdriveDb } from '../db';
import type { MissionType } from '../missions/types';

export type Db = ReturnType<typeof getHyperdriveDb>;
type LeadInput = {
  email: string;
  name?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: string | null;
  isVip?: boolean | null;
  industry?: string | null;
  metadata?: Record<string, unknown> | null;
};
type MissionStatus = typeof missions.$inferSelect["status"];
type TaskPayload = Record<string, unknown>;

// ─── Leads ──────────────────────────────────────────────────────────────────

export async function createLead(db: Db, data: LeadInput) {
  const values = {
    email: data.email,
    name: data.name ?? null,
    company: data.company ?? null,
    title: data.title ?? null,
    phone: data.phone ?? null,
    source: data.source ?? 'direct',
    status: data.status ?? 'new',
    isVip: data.isVip ?? false,
    industry: data.industry ?? null,
    metadata: data.metadata ?? null,
  };
  const [result] = await db.insert(leads).values(values).returning();
  return result;
}

export async function updateLead(db: Db, id: number, data: Partial<LeadInput>) {
  await db.update(leads).set(data).where(eq(leads.id, id));
}

export async function getLeadByEmail(db: Db, email: string) {
  const rows = await db.select().from(leads).where(eq(leads.email, email)).limit(1);
  return rows[0] ?? null;
}

// ─── Missions / tasks ───────────────────────────────────────────────────────
// Mirrors server/db.ts's (pre-migration) createMission()/getMissions() —
// intentionally NOT server/missions/missions.db.ts's versions, which also
// auto-create template tasks and would change these scripts' behavior.

export async function createMission(db: Db, type: MissionType) {
  const id = randomUUID();
  await db.insert(missions).values({
    id,
    type,
    title: type,
    description: `Mission: ${type}`,
    status: 'pending',
  });
  return id;
}

export async function getMissions(db: Db, statusFilter?: MissionStatus) {
  if (statusFilter) {
    return db.select().from(missions).where(eq(missions.status, statusFilter));
  }
  return db.select().from(missions).orderBy(desc(missions.createdAt)).limit(200);
}

export async function enqueueTask(
  db: Db,
  missionId: string,
  kind: string,
  payload: TaskPayload,
  scheduledAt?: Date,
) {
  const id = randomUUID();
  await db.insert(missionTasks).values({
    id,
    missionId,
    kind,
    title: kind,
    status: 'pending',
    payload,
    ...(scheduledAt ? { scheduledAt } : {}),
  });
  return id;
}
