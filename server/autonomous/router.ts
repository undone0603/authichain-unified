import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { runPipelineTick } from "../jobs/pipeline-tick";
import { getDb } from "../db";
import { activityLog, revenueRecords, missions, leads } from "../../drizzle/schema";
import { desc, gte, sql, eq, and } from "drizzle-orm";

export const autonomousRouter = router({
  getSystemStatus: protectedProcedure.query(async () => {
    const config = await db.getAutopilotConfig();
    const d = await getDb();

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [activeMissions, todayActivityCount, pendingTasks, todayRevenue] = await Promise.all([
      d.select({ count: sql<number>`count(*)` }).from(missions)
        .where(sql`status IN ('pending','active','in_progress')`),
      d.select({ count: sql<number>`count(*)` }).from(activityLog)
        .where(gte(activityLog.createdAt, dayStart)),
      db.getDueTasks(100),
      d.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
        .from(revenueRecords).where(gte(revenueRecords.createdAt, dayStart)),
    ]);

    return {
      handsOffEnabled: (config?.enabled ?? 0) === 1,
      mode: config?.mode ?? "balanced",
      activeMissionCount: Number(activeMissions[0]?.count ?? 0),
      pendingTaskCount: pendingTasks.length,
      todayActivityCount: Number(todayActivityCount[0]?.count ?? 0),
      todayRevenue: parseFloat(String(todayRevenue[0]?.total ?? "0")),
      lastUpdated: new Date().toISOString(),
    };
  }),

  setHandsOffMode: protectedProcedure
    .input(z.object({ enabled: z.boolean(), mode: z.enum(["conservative", "balanced", "aggressive"]).optional() }))
    .mutation(async ({ input }) => {
      await db.upsertAutopilotConfig({
        enabled: input.enabled ? 1 : 0,
        mode: input.mode ?? "balanced",
        updatedAt: new Date(),
      });
      return { success: true, enabled: input.enabled };
    }),

  getLiveActivity: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(25) }))
    .query(async ({ input }) => {
      const d = await getDb();
      const rows = await d.select()
        .from(activityLog)
        .orderBy(desc(activityLog.createdAt))
        .limit(input.limit);
      return rows;
    }),

  triggerPipelineTick: protectedProcedure.mutation(async () => {
    const result = await runPipelineTick();
    return { success: true, result };
  }),

  runDealBlitz: protectedProcedure.mutation(async () => {
    const d = await getDb();

    const ALL_SEGMENTS = [
      { kind: "FIND_GOV_LEADS",           missionType: "GOV_PILOT",           segment: "GOV" },
      { kind: "FIND_RETAIL_LEADS",         missionType: "RETAIL_PILOT",        segment: "RETAIL" },
      { kind: "FIND_ENTERTAINMENT_LEADS",  missionType: "ENTERTAINMENT_PILOT", segment: "ENTERTAINMENT" },
      { kind: "FIND_SPORTS_LEADS",         missionType: "SPORTS_PILOT",        segment: "SPORTS" },
      { kind: "FIND_CREATOR_LEADS",        missionType: "CREATOR_PILOT",       segment: "CREATOR" },
      { kind: "FIND_COLLECTIBLES_LEADS",   missionType: "COLLECTIBLES_PILOT",  segment: "COLLECTIBLES" },
    ];

    const tasksQueued: string[] = [];
    const hotLeadsPitched: string[] = [];

    // ── 1. Seed all lead-finding tasks immediately ────────────────────────────
    await Promise.all(ALL_SEGMENTS.map(async ({ kind, missionType, segment }) => {
      let missionId: string | undefined;
      const activeMissionTypes = await db.getActiveMissionTypes();
      if (!activeMissionTypes.includes(missionType)) {
        missionId = await db.createMission(missionType as any);
      } else {
        const rows = await d.select().from(missions).where(eq(missions.title, missionType)).limit(1);
        missionId = rows[0]?.id;
      }
      if (missionId) {
        await db.enqueueTask(missionId, kind, { segment, count: 25 }); // blitz = 25 leads per segment
        tasksQueued.push(kind);
      }
    }));

    // ── 2. Pitch all existing HOT leads that haven't been contacted yet ───────
    const MOONSHOT_SEGMENTS = new Set(["ENTERTAINMENT", "SPORTS", "CREATOR", "COLLECTIBLES"]);
    const hotLeads = await d.select().from(leads)
      .where(and(
        sql`${leads.leadScore} >= 70`,
        eq(leads.contractSent, false),
        sql`${leads.status} NOT IN ('MOONSHOT_PITCHED','PILOT_PROPOSED','CLOSED_WON','CLOSED_LOST')`,
      ))
      .limit(50);

    for (const lead of hotLeads) {
      if (!lead.email) continue;
      const seg = lead.segment ?? "GOV";
      const taskKind = MOONSHOT_SEGMENTS.has(seg) ? "PITCH_MOONSHOT_DEAL" : "GENERATE_PROPOSAL";

      // Find or create a mission for this segment
      const missionType = `${seg}_PILOT`;
      const activeMissionTypes = await db.getActiveMissionTypes();
      let missionId: string | undefined;
      if (!activeMissionTypes.includes(missionType)) {
        missionId = await db.createMission(missionType as any);
      } else {
        const rows = await d.select().from(missions).where(eq(missions.title, missionType)).limit(1);
        missionId = rows[0]?.id;
      }
      if (missionId) {
        await db.enqueueTask(missionId, taskKind, {
          segment: seg,
          leadEmail: lead.email,
          leadName: lead.name ?? undefined,
          leadOrg: lead.company ?? undefined,
          leadTitle: lead.title ?? undefined,
        });
        hotLeadsPitched.push(lead.email);
      }
    }

    // ── 3. Run a full pipeline tick to kick everything off immediately ────────
    const tickResult = await runPipelineTick();

    await db.logActivity({
      userId: null,
      action: "deal_blitz_executed",
      entityType: "automation",
      entityId: 0,
      details: { tasksQueued, hotLeadsPitched: hotLeadsPitched.length, tickResult },
    });

    return {
      success: true,
      tasksQueued,
      hotLeadsPitched: hotLeadsPitched.length,
      hotLeads: hotLeadsPitched,
      segmentsHit: ALL_SEGMENTS.length,
      tickResult,
    };
  }),

  getActiveMissions: protectedProcedure.query(async () => {
    const d = await getDb();
    const rows = await d.select().from(missions)
      .where(sql`status IN ('pending','active','in_progress')`)
      .orderBy(desc(missions.createdAt))
      .limit(20);
    return rows;
  }),

  getRevenueSummary: protectedProcedure.query(async () => {
    const d = await getDb();
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month, allTime] = await Promise.all([
      d.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)`, count: sql<number>`count(*)` })
        .from(revenueRecords).where(gte(revenueRecords.createdAt, dayStart)),
      d.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)`, count: sql<number>`count(*)` })
        .from(revenueRecords).where(gte(revenueRecords.createdAt, weekStart)),
      d.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)`, count: sql<number>`count(*)` })
        .from(revenueRecords).where(gte(revenueRecords.createdAt, monthStart)),
      d.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)`, count: sql<number>`count(*)` })
        .from(revenueRecords),
    ]);

    return {
      today: { total: parseFloat(String(today[0]?.total ?? "0")), count: Number(today[0]?.count ?? 0) },
      week: { total: parseFloat(String(week[0]?.total ?? "0")), count: Number(week[0]?.count ?? 0) },
      month: { total: parseFloat(String(month[0]?.total ?? "0")), count: Number(month[0]?.count ?? 0) },
      allTime: { total: parseFloat(String(allTime[0]?.total ?? "0")), count: Number(allTime[0]?.count ?? 0) },
    };
  }),
});
