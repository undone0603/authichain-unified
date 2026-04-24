// server/missions/missions.db.ts
import { getDb } from "../db";
import { missions, missionTasks } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { missionTemplates, taskTemplates } from "./templates";
import type { MissionType, MissionStatus } from "./types";

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getMissions(statusFilter?: string) {
  const d = await getDb();
  if (statusFilter) {
    return d
      .select()
      .from(missions)
      .where(eq(missions.status, statusFilter as any));
  }
  return d.select().from(missions).orderBy(desc(missions.createdAt));
}

export async function getMissionById(id: string) {
  const d = await getDb();
  const [mission] = await d
    .select()
    .from(missions)
    .where(eq(missions.id, id))
    .limit(1);
  if (!mission) return null;

  const tasks = await d
    .select()
    .from(missionTasks)
    .where(eq(missionTasks.missionId, id))
    .orderBy(missionTasks.order);

  return { ...mission, tasks };
}

// ─── Write ───────────────────────────────────────────────────────────────────

export async function createMission(type: MissionType) {
  const d = await getDb();
  const template = missionTemplates[type];
  if (!template) throw new Error(`Unknown mission type: ${type}`);

  const id = randomUUID();
  await d.insert(missions).values({
    id,
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
      title: t.kind,
      description: JSON.stringify(t.payload),
      status: "pending" as const,
      order: index + 1,
    }));
    await d.insert(missionTasks).values(taskRows);
  }

  return id;
}

export async function updateMissionStatus(id: string, status: MissionStatus) {
  const d = await getDb();
  await d
    .update(missions)
    .set({ status: status.toLowerCase() as any })
    .where(eq(missions.id, id));
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasksByMission(missionId: string) {
  const d = await getDb();
  return d
    .select()
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId))
    .orderBy(missionTasks.order);
}

export async function retryTask(id: string) {
  const d = await getDb();
  await d
    .update(missionTasks)
    .set({ status: "pending" })
    .where(eq(missionTasks.id, id));
}

export async function updateTaskStatus(
  id: string,
  status: "pending" | "in_progress" | "completed" | "failed"
) {
  const d = await getDb();
  await d.update(missionTasks).set({ status }).where(eq(missionTasks.id, id));
}
