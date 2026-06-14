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

export interface CreateMissionInput {
  userId?: number;
  title: string;
  description?: string;
  type: MissionType;
  tasks?: { kind: string; payload?: unknown }[];
}

// Template form: tasks come from the mission templates, returns the id.
export async function createMission(type: MissionType): Promise<string>;
// Ad-hoc form (Commander / revenue orchestrator): explicit title + tasks.
export async function createMission(input: CreateMissionInput): Promise<{ id: string; title: string }>;
export async function createMission(
  arg: MissionType | CreateMissionInput,
): Promise<string | { id: string; title: string }> {
  const d = await getDb();
  const id = randomUUID();

  if (typeof arg !== "string") {
    await d.insert(missions).values({
      id,
      type: arg.type,
      title: arg.title,
      description: arg.description ?? `Mission: ${arg.title}`,
      status: "pending",
    });
    const adhocTasks = arg.tasks ?? [];
    if (adhocTasks.length > 0) {
      const taskRows = adhocTasks.map((t, index) => ({
        id: randomUUID(),
        missionId: id,
        kind: t.kind,
        title: t.kind,
        description: JSON.stringify(t.payload ?? {}),
        status: "pending" as const,
        order: index + 1,
      }));
      await d.insert(missionTasks).values(taskRows);
    }
    return { id, title: arg.title };
  }

  const type = arg;
  const template = missionTemplates[type];
  if (!template) throw new Error(`Unknown mission type: ${type}`);

  await d.insert(missions).values({
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
