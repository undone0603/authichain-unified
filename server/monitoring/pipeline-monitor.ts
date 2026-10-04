import { and, count, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../db.js";
import { missionTasks } from "../../drizzle/schema.js";

export interface PipelineSnapshot {
  sampledAt: Date;
  pendingTasks: number;
  runningTasks: number;
  waitingHumanTasks: number;
  oldestPendingAgeHours: number | null;
  oldestRunningAgeHours: number | null;
  oldestWaitingHumanAgeHours: number | null;
  completedTasks24h: number;
  failedTasks24h: number;
  completedTasksPrevious24h: number;
  failedTasksPrevious24h: number;
  successRate24h: number | null;
}

export async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    currentCounts,
    recentCounts,
    previousCounts,
    oldestPending,
    oldestRunning,
    oldestWaitingHuman,
  ] = await Promise.all([
    db
      .select({ status: missionTasks.status, count: count() })
      .from(missionTasks)
      .groupBy(missionTasks.status),
    db
      .select({ status: missionTasks.status, count: count() })
      .from(missionTasks)
      .where(gte(missionTasks.updatedAt, since))
      .groupBy(missionTasks.status),
    db
      .select({ status: missionTasks.status, count: count() })
      .from(missionTasks)
      .where(
        and(
          gte(
            missionTasks.updatedAt,
            new Date(since.getTime() - 24 * 60 * 60_000)
          ),
          lt(missionTasks.updatedAt, since)
        )
      )
      .groupBy(missionTasks.status),
    db
      .select({ timestamp: missionTasks.createdAt })
      .from(missionTasks)
      .where(eq(missionTasks.status, "pending"))
      .orderBy(missionTasks.createdAt)
      .limit(1),
    db
      .select({ timestamp: missionTasks.updatedAt })
      .from(missionTasks)
      .where(eq(missionTasks.status, "in_progress"))
      .orderBy(missionTasks.updatedAt)
      .limit(1),
    db
      .select({ timestamp: missionTasks.updatedAt })
      .from(missionTasks)
      .where(eq(missionTasks.status, "waiting_human"))
      .orderBy(missionTasks.updatedAt)
      .limit(1),
  ]);

  const sampledAt = new Date();
  const ageHours = (timestamp?: Date) =>
    timestamp
      ? Math.max(0, (sampledAt.getTime() - timestamp.getTime()) / (60 * 60_000))
      : null;
  const current = new Map(currentCounts.map(row => [row.status, row.count]));
  const recent = new Map(recentCounts.map(row => [row.status, row.count]));
  const previous = new Map(previousCounts.map(row => [row.status, row.count]));
  const completedTasks24h = recent.get("completed") ?? 0;
  const failedTasks24h = recent.get("failed") ?? 0;
  const completedTasksPrevious24h = previous.get("completed") ?? 0;
  const failedTasksPrevious24h = previous.get("failed") ?? 0;
  const outcomes24h = completedTasks24h + failedTasks24h;

  return {
    sampledAt,
    pendingTasks: current.get("pending") ?? 0,
    runningTasks: current.get("in_progress") ?? 0,
    waitingHumanTasks: current.get("waiting_human") ?? 0,
    oldestPendingAgeHours: ageHours(oldestPending[0]?.timestamp),
    oldestRunningAgeHours: ageHours(oldestRunning[0]?.timestamp),
    oldestWaitingHumanAgeHours: ageHours(oldestWaitingHuman[0]?.timestamp),
    completedTasks24h,
    failedTasks24h,
    completedTasksPrevious24h,
    failedTasksPrevious24h,
    successRate24h:
      outcomes24h > 0 ? (completedTasks24h / outcomes24h) * 100 : null,
  };
}

export function formatPipelineSnapshot(snapshot: PipelineSnapshot): string {
  const rate =
    snapshot.successRate24h === null
      ? "n/a"
      : `${snapshot.successRate24h.toFixed(1)}%`;
  const age = (hours: number | null) =>
    hours === null ? "none" : `${hours.toFixed(1)}h`;
  const delta = (current: number, previous: number) => {
    const change = current - previous;
    return `${change > 0 ? "+" : ""}${change}`;
  };

  return [
    `Sampled: ${snapshot.sampledAt.toISOString()}`,
    `Tasks now: ${snapshot.pendingTasks} pending, ${snapshot.runningTasks} in progress, ${snapshot.waitingHumanTasks} waiting for a person`,
    `Last 24h: ${snapshot.completedTasks24h} completed, ${snapshot.failedTasks24h} failed, ${rate} success rate`,
    `Trend vs previous 24h: completed ${delta(snapshot.completedTasks24h, snapshot.completedTasksPrevious24h)}, failed ${delta(snapshot.failedTasks24h, snapshot.failedTasksPrevious24h)}`,
    `Oldest task ages: pending ${age(snapshot.oldestPendingAgeHours)}, in progress ${age(snapshot.oldestRunningAgeHours)}, waiting for a person ${age(snapshot.oldestWaitingHumanAgeHours)}`,
    `Recent task errors: ${snapshot.failedTasks24h} failed task(s); detailed error text is intentionally omitted from workflow logs`,
  ].join("\n");
}
