import { and, count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../db.js";
import { missionTasks } from "../../drizzle/schema.js";

export interface PipelineSnapshot {
  sampledAt: Date;
  pendingTasks: number;
  runningTasks: number;
  waitingHumanTasks: number;
  oldestPendingTasks: TaskSummary[];
  runningTasksByAge: TaskSummary[];
  waitingHumanDetails: TaskSummary[];
  completedTasks24h: number;
  failedTasks24h: number;
  successRate24h: number | null;
  recentErrors: { error: string; updatedAt: Date }[];
}

export interface TaskSummary {
  id: string;
  kind: string;
  title: string;
  updatedAt: Date;
}

export async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    currentCounts,
    recentCounts,
    oldestPending,
    running,
    waitingHuman,
    recentErrors,
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
      .select({ error: missionTasks.error, updatedAt: missionTasks.updatedAt })
      .from(missionTasks)
      .where(
        and(
          eq(missionTasks.status, "failed"),
          gte(missionTasks.updatedAt, since)
        )
      )
      .orderBy(desc(missionTasks.updatedAt))
      .limit(5),
    db
      .select({
        id: missionTasks.id,
        kind: missionTasks.kind,
        title: missionTasks.title,
        updatedAt: missionTasks.updatedAt,
      })
      .from(missionTasks)
      .where(eq(missionTasks.status, "pending"))
      .orderBy(missionTasks.createdAt)
      .limit(5),
    db
      .select({
        id: missionTasks.id,
        kind: missionTasks.kind,
        title: missionTasks.title,
        updatedAt: missionTasks.updatedAt,
      })
      .from(missionTasks)
      .where(eq(missionTasks.status, "in_progress"))
      .orderBy(missionTasks.updatedAt)
      .limit(5),
    db
      .select({
        id: missionTasks.id,
        kind: missionTasks.kind,
        title: missionTasks.title,
        updatedAt: missionTasks.updatedAt,
      })
      .from(missionTasks)
      .where(eq(missionTasks.status, "waiting_human"))
      .orderBy(missionTasks.updatedAt)
      .limit(5),
  ]);

  const sampledAt = new Date();
  const current = new Map(currentCounts.map(row => [row.status, row.count]));
  const recent = new Map(recentCounts.map(row => [row.status, row.count]));
  const completedTasks24h = recent.get("completed") ?? 0;
  const failedTasks24h = recent.get("failed") ?? 0;
  const outcomes24h = completedTasks24h + failedTasks24h;

  return {
    sampledAt,
    pendingTasks: current.get("pending") ?? 0,
    runningTasks: current.get("in_progress") ?? 0,
    waitingHumanTasks: current.get("waiting_human") ?? 0,
    oldestPendingTasks: oldestPending,
    runningTasksByAge: running,
    waitingHumanDetails: waitingHuman,
    completedTasks24h,
    failedTasks24h,
    successRate24h:
      outcomes24h > 0 ? (completedTasks24h / outcomes24h) * 100 : null,
    recentErrors: recentErrors
      .filter(row => row.error)
      .map(row => ({ error: row.error!, updatedAt: row.updatedAt })),
  };
}

export function formatPipelineSnapshot(snapshot: PipelineSnapshot): string {
  const rate =
    snapshot.successRate24h === null
      ? "n/a"
      : `${snapshot.successRate24h.toFixed(1)}%`;
  const errors = snapshot.recentErrors.length
    ? snapshot.recentErrors
        .map(
          item =>
            `  - ${item.updatedAt.toISOString()}: ${item.error.slice(0, 240)}`
        )
        .join("\n")
    : "  - none";
  const taskList = (tasks: TaskSummary[]) =>
    tasks.length
      ? tasks
          .map(task => {
            const ageHours = Math.max(
              0,
              (snapshot.sampledAt.getTime() - task.updatedAt.getTime()) /
                (60 * 60_000)
            );
            return `  - ${task.kind} [${task.id}] ${task.title} (${ageHours.toFixed(1)}h)`;
          })
          .join("\n")
      : "  - none";

  return [
    `Sampled: ${snapshot.sampledAt.toISOString()}`,
    `Tasks now: ${snapshot.pendingTasks} pending, ${snapshot.runningTasks} in progress, ${snapshot.waitingHumanTasks} waiting for a person`,
    `Last 24h: ${snapshot.completedTasks24h} completed, ${snapshot.failedTasks24h} failed, ${rate} success rate`,
    `Oldest pending tasks:\n${taskList(snapshot.oldestPendingTasks)}`,
    `In-progress tasks, oldest activity first:\n${taskList(snapshot.runningTasksByAge)}`,
    `Waiting for a person:\n${taskList(snapshot.waitingHumanDetails)}`,
    `Recent task errors:\n${errors}`,
  ].join("\n");
}
