// server/agents/db-helpers.ts
//
// Db-parameterized replacements for the handful of server/db.ts helper
// functions used by server/agents/**. server/db.ts's helpers all close over
// the module-scope getDb() singleton (Node-only, process.env.DATABASE_URL),
// which is incompatible with Cloudflare Workers' per-request env bindings.
//
// These do the same queries but take an explicit `db` instance (threaded
// from the caller — ultimately ctx.db in a tRPC procedure, or a per-request
// Workers db) instead of reaching for the singleton themselves.
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import {
  activityLog,
  missionTasks,
  proposals,
  bayesianPriors,
  users,
  notifications,
  seoPages,
  type InsertNotification,
  type InsertSeoPageRow,
} from '../../drizzle/schema';
import { SEGMENT_PRIORS } from '../_core/bayesian';
import type { getHyperdriveDb } from '../db';

export type Db = ReturnType<typeof getHyperdriveDb>;

export async function logActivity(
  db: Db,
  actionOrData: string | { userId?: number | null; action: string; entityType?: string; entityId?: number | string; details?: any },
  details?: string,
): Promise<void> {
  if (typeof actionOrData === 'string') {
    await db.insert(activityLog).values({ action: actionOrData, details: details ? { text: details } : undefined });
  } else {
    await db.insert(activityLog).values({
      userId: actionOrData.userId ?? undefined,
      action: actionOrData.action,
      entityType: actionOrData.entityType,
      entityId: actionOrData.entityId == null ? undefined : String(actionOrData.entityId),
      details: actionOrData.details,
    });
  }
}

export async function enqueueTask(
  db: Db,
  missionId: string,
  kind: string,
  payload: any,
  scheduledAt?: Date,
): Promise<string> {
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

export async function markTaskWaitingHuman(db: Db, id: string): Promise<void> {
  await db.update(missionTasks).set({ status: 'waiting_human', updatedAt: new Date() }).where(eq(missionTasks.id, id));
}

export async function getAdaptivePriors(db: Db): Promise<Record<string, { alpha: number; beta: number }>> {
  try {
    if (!db) return { ...SEGMENT_PRIORS };
    const rows = await db.select({
      segment: bayesianPriors.segment,
      priorAlpha: bayesianPriors.priorAlpha,
      priorBeta: bayesianPriors.priorBeta,
    }).from(bayesianPriors).limit(200);
    if (!rows.length) return { ...SEGMENT_PRIORS };
    const map: Record<string, { alpha: number; beta: number }> = { ...SEGMENT_PRIORS };
    for (const row of rows) {
      map[row.segment] = {
        alpha: parseFloat(row.priorAlpha ?? '2'),
        beta: parseFloat(row.priorBeta ?? '18'),
      };
    }
    return map;
  } catch {
    return { ...SEGMENT_PRIORS };
  }
}

export async function createProposal(
  db: Db,
  data: {
    leadEmail: string;
    missionId: string;
    taskId?: string;
    segment: string;
    content: string;
    paymentLink?: string;
    checkoutSessionId?: string;
    pilotPriceUsd?: number;
  },
): Promise<string> {
  const id = randomUUID();
  await db.insert(proposals).values({ id, ...data });
  return id;
}

export async function getAllAdminIds(db: Db): Promise<number[]> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
  return rows.map(r => r.id);
}

export async function createNotification(
  db: Db,
  data: Omit<InsertNotification, 'id' | 'createdAt'>,
): Promise<{ id: string }> {
  const [result] = await db.insert(notifications).values(data).returning();
  return { id: result.id };
}

export async function upsertSeoPage(
  db: Db,
  page: Omit<InsertSeoPageRow, 'id' | 'createdAt'>,
): Promise<void> {
  await db
    .insert(seoPages)
    .values(page)
    .onConflictDoUpdate({
      target: seoPages.slug,
      set: {
        keyword: page.keyword,
        brand: page.brand,
        domain: page.domain,
        title: page.title,
        metaDescription: page.metaDescription,
        h1: page.h1,
        bodyHtml: page.bodyHtml,
        jsonLd: page.jsonLd,
      },
    });
}

export async function listPublishedSlugs(db: Db): Promise<string[]> {
  const rows = await db.select({ slug: seoPages.slug }).from(seoPages);
  return rows.map(r => r.slug);
}

export async function createSystemNotification(
  db: Db,
  userId: number,
  title: string,
  message: string,
  type: InsertNotification['type'],
  actionUrl?: string,
): Promise<{ id: string }> {
  return createNotification(db, { userId, type: type as any, title, message, isRead: false, actionUrl });
}

export async function createTask(db: Db, data: any): Promise<string> {
  const id = randomUUID();
  await db.insert(missionTasks).values({
    id,
    missionId: data.missionId,
    kind: data.kind,
    title: data.title || data.kind,
    description: data.description || data.kind,
    priority: data.priority || 0,
    status: data.status || 'pending',
    payload: data.payload,
  });
  return id;
}

export async function getTasksByMission(db: Db, missionId: string) {
  return db.select().from(missionTasks).where(eq(missionTasks.missionId, missionId)).orderBy(missionTasks.order);
}
