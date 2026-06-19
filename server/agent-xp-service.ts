import { getDb } from "./db";
import { agentXp } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

const XP_PER_LEVEL = 1000;
const TASK_XP_REWARDS: Record<string, number> = {
  "FIND_GOV_LEADS": 50,
  "FIND_RETAIL_LEADS": 40,
  "FIND_LUXURY_LEADS": 60,
  "DRAFT_OUTBOUND_EMAIL": 75,
  "FOLLOWUP_SEQUENCE": 100,
  "GENERATE_OUTREACH_VIDEO": 150,
  "GENERATE_PROPOSAL": 125,
  "SEND_CONTRACT": 150,
  "BUILD_PILOT_PACKET": 200,
  "PITCH_MOONSHOT_DEAL": 300,
  "MOONSHOT_PROPOSAL": 250,
};

export interface AgentXpRecord {
  agentId: string;
  agentName: string;
  taskKind: string;
  xp: number;
  level: number;
  totalTasksCompleted: number;
  successRate: string | number;
  dealsClosedCount: number;
  revenueGeneratedUsd: string | number;
}

function calculateLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export async function awardXp(
  agentId: string,
  agentName: string,
  taskKind: string,
  options?: {
    dealClosed?: boolean;
    revenueUsd?: number;
    success?: boolean;
    season?: number;
  }
): Promise<AgentXpRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const season = options?.season ?? 1;
  const xpReward = TASK_XP_REWARDS[taskKind] ?? 75;
  const success = options?.success !== false;

  // Upsert: find or create agent XP record
  const existing = await db
    .select()
    .from(agentXp)
    .where(
      and(
        eq(agentXp.agentId, agentId),
        eq(agentXp.taskKind, taskKind),
        eq(agentXp.season, season)
      )
    )
    .limit(1);

  const record = existing[0];

  if (!record) {
    // Create new record
    const newRecord = {
      agentId,
      agentName,
      taskKind,
      xp: xpReward,
      level: calculateLevel(xpReward),
      totalTasksCompleted: success ? 1 : 0,
      successRate: success ? '100' : '0',
      dealsClosedCount: options?.dealClosed ? 1 : 0,
      revenueGeneratedUsd: String(options?.revenueUsd ?? 0),
      lastTaskCompletedAt: new Date(),
      lastLevelUpAt: null,
      season,
      seasonXp: xpReward,
    };

    await db.insert(agentXp).values(newRecord as any);
    return {
      ...newRecord,
      successRate: parseFloat(newRecord.successRate),
      revenueGeneratedUsd: parseFloat(newRecord.revenueGeneratedUsd),
    };
  }

  // Update existing record
  const totalAttempts = record.totalTasksCompleted + 1;
  const successCount = success ? record.totalTasksCompleted + 1 : record.totalTasksCompleted;
  const newSuccessRate = (successCount / totalAttempts) * 100;
  const newXp = record.xp + (success ? xpReward : 0);
  const newSeasonXp = record.seasonXp + (success ? xpReward : 0);
  const oldLevel = record.level;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > oldLevel;

  const prevRevenueUsd = typeof record.revenueGeneratedUsd === 'string'
    ? parseFloat(record.revenueGeneratedUsd)
    : record.revenueGeneratedUsd;

  await db
    .update(agentXp)
    .set({
      xp: newXp,
      seasonXp: newSeasonXp,
      level: newLevel,
      totalTasksCompleted: totalAttempts,
      successRate: String(newSuccessRate),
      dealsClosedCount: record.dealsClosedCount + (options?.dealClosed ? 1 : 0),
      revenueGeneratedUsd: String(prevRevenueUsd + (options?.revenueUsd ?? 0)),
      lastTaskCompletedAt: new Date(),
      lastLevelUpAt: leveledUp ? new Date() : record.lastLevelUpAt,
      updatedAt: new Date(),
    })
    .where(eq(agentXp.id, record.id));

  return {
    agentId: record.agentId,
    agentName: record.agentName,
    taskKind: record.taskKind,
    xp: newXp,
    level: newLevel,
    totalTasksCompleted: totalAttempts,
    successRate: newSuccessRate,
    dealsClosedCount: record.dealsClosedCount + (options?.dealClosed ? 1 : 0),
    revenueGeneratedUsd: prevRevenueUsd + (options?.revenueUsd ?? 0),
  };
}

export async function getAgentXp(
  agentId: string,
  taskKind?: string,
  season?: number
): Promise<AgentXpRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const conditions: any[] = [eq(agentXp.agentId, agentId)];
  if (taskKind) conditions.push(eq(agentXp.taskKind, taskKind));
  if (season) conditions.push(eq(agentXp.season, season));

  const result = await db
    .select()
    .from(agentXp)
    .where(and(...conditions))
    .limit(1);

  return result[0] ?? null;
}

export async function getLeaderboard(
  limit = 10,
  season?: number
): Promise<AgentXpRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];
  if (season) conditions.push(eq(agentXp.season, season));

  const results = await db
    .select()
    .from(agentXp)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(agentXp.xp)
    .limit(limit);

  return results;
}

export async function seasonReset(newSeason: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Reset all records to new season
  const records = await db.select().from(agentXp);
  for (const record of records) {
    await db.update(agentXp).set({
      season: newSeason,
      seasonXp: 0,
      dealsClosedCount: 0,
      revenueGeneratedUsd: '0',
      updatedAt: new Date(),
    }).where(eq(agentXp.id, record.id));
  }
}
