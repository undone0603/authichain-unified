import { eq } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  getAutopilotConfig,
  getRecentDecisions,
  upsertAutopilotConfig,
  createAutopilotDecision,
  logActivity,
} from "../content-db-helpers";
import { z } from "zod";
import { invokeLLM, parseLLMContent } from "../_core/llm";
import { autopilotDecisions } from "../../drizzle/schema";

export const autopilotRouter = router({
  getStatus: adminProcedure.query(async () => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    const config = await getAutopilotConfig(db);
    const decisions = await getRecentDecisions(db, 5);
    const executed = decisions.filter(d => d.status === "executed").length;
    return {
      enabled: config?.enabled || 0,
      mode: config?.mode || "balanced",
      guardrails: config?.guardrails,
      uptime: 99.5,
      decisionsToday: decisions.length,
      actionsToday: executed,
      successRate: decisions.length > 0 ? Math.round((executed / decisions.length) * 100) : 0,
      recentDecisions: decisions,
    };
  }),
  toggle: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    const config = await getAutopilotConfig(db);
    await upsertAutopilotConfig(db, {
      enabled: config?.enabled === 1 ? 0 : 1,
      mode: config?.mode || "balanced",
      guardrails: config?.guardrails || JSON.stringify({ maxEmailsPerDay: 50, maxSocialPostsPerDay: 5, maxDiscountPercent: 30 }),
      updatedBy: ctx.user.id,
    });
    return { success: true, enabled: config?.enabled === 1 ? 0 : 1 };
  }),
  updateMode: adminProcedure.input(z.object({
    mode: z.enum(["conservative", "balanced", "aggressive"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    await upsertAutopilotConfig(db, { mode: input.mode, updatedBy: ctx.user.id });
    return { success: true };
  }),
  getDecisions: adminProcedure.input(z.object({ limit: z.number().min(1).max(200).optional().default(20) })).query(async ({ input }) => {
    const db = await getDb();
    return await getRecentDecisions(db, input.limit);
  }),
  overrideDecision: adminProcedure.input(z.object({
    decisionId: z.number(),
    reason: z.string().max(500),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    await db.update(autopilotDecisions).set({ status: "overridden", overriddenBy: ctx.user.id, overrideReason: input.reason }).where(eq(autopilotDecisions.id, input.decisionId));
    return { success: true };
  }),
  executeAction: adminProcedure.input(z.object({
    type: z.string().min(1).max(100),
    action: z.string().min(1).max(1000),
    reasoning: z.string().max(1000).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an AI business autopilot. Evaluate the proposed action and determine confidence level (0-100) and expected outcome." },
        { role: "user", content: `Action type: ${input.type}\nAction: ${input.action}\nReasoning: ${input.reasoning || "N/A"}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "action_evaluation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              confidence: { type: "integer" },
              expectedOutcome: { type: "string" },
              risks: { type: "string" },
              proceed: { type: "boolean" },
            },
            required: ["confidence", "expectedOutcome", "risks", "proceed"],
            additionalProperties: false,
          },
        },
      },
    });
    const evaluation = parseLLMContent<any>(response.choices[0].message.content);
    const decision = await createAutopilotDecision(db, {
      type: input.type, action: input.action, reasoning: input.reasoning,
      confidence: evaluation.confidence, status: evaluation.proceed ? "executed" : "pending",
      result: evaluation,
    });
    await logActivity(db, { userId: ctx.user.id, action: "autopilot_decision", entityType: "autopilot_decision", entityId: decision.id });
    return { decision, evaluation };
  }),
});
