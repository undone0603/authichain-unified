// server/missions/missions.db.ts
import type { getHyperdriveDb } from "../db";
import { missions, missionTasks } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { missionTemplates, taskTemplates } from "./templates";
import type { MissionType, MissionStatus } from "./types";

export type Db = ReturnType<typeof getHyperdriveDb>;

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getMissions(db: Db, statusFilter?: string) {
  if (statusFilter) {
    return db
      .select()
      .from(missions)
      .where(eq(missions.status, statusFilter as any))
      .orderBy(desc(missions.createdAt))
      .limit(200);
  }
  return db.select().from(missions).orderBy(desc(missions.createdAt)).limit(200);
}

export async function getMissionById(db: Db, id: string) {
  const [mission] = await db
    .select()
    .from(missions)
    .where(eq(missions.id, id))
    .limit(1);
  if (!mission) return null;

  const tasks = await db
    .select()
    .from(missionTasks)
    .where(eq(missionTasks.missionId, id))
    .orderBy(missionTasks.order);

  return { ...mission, tasks };
}

// ─── Write ───────────────────────────────────────────────────────────────────

export async function createMission(db: Db, type: MissionType) {
  const template = missionTemplates[type];
  if (!template) throw new Error(`Unknown mission type: ${type}`);

  const id = randomUUID();
  await db.insert(missions).values({
    id,
    type,
    title: template.title,
    description: `Mission: ${template.title}`,
    status: "pending",
  });

  // Auto-create tasks from template
  const templateTasks = taskTemplates[type] ?? [];
  if (templateTasks.length > 0) {
    const taskRows = templateTasks.map((t, index) => ({
      id: randomUUID(),
      missionId: id,
      kind: t.kind,
      title: t.kind,
      description: JSON.stringify(t.payload),
      status: "pending" as const,
      order: index + 1,
    }));
    await db.insert(missionTasks).values(taskRows);
  }

  return id;
}

export async function updateMissionStatus(db: Db, id: string, status: MissionStatus) {
  await db
    .update(missions)
    .set({ status: status.toLowerCase() as any })
    .where(eq(missions.id, id));
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasksByMission(db: Db, missionId: string) {
  return db
    .select()
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId))
    .orderBy(missionTasks.order);
}

export async function retryTask(db: Db, id: string) {
  await db
    .update(missionTasks)
    .set({ status: "pending" })
    .where(eq(missionTasks.id, id));
}

export async function updateTaskStatus(
  db: Db,
  id: string,
  status: "pending" | "in_progress" | "completed" | "failed"
) {
  await db.update(missionTasks).set({ status }).where(eq(missionTasks.id, id));
}
