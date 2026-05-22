import { eq } from "drizzle-orm";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { invokeLLM, parseLLMContent } from "../_core/llm";
import { autopilotDecisions } from "../../drizzle/schema";

export const autopilotRouter = router({
  getStatus: protectedProcedure.query(async () => {
    const config = await db.getAutopilotConfig();
    const decisions = await db.getRecentDecisions(5);
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
    const config = await db.getAutopilotConfig();
    await db.upsertAutopilotConfig({
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
    await db.upsertAutopilotConfig({ mode: input.mode, updatedBy: ctx.user.id });
    return { success: true };
  }),
  getDecisions: protectedProcedure.input(z.object({ limit: z.number().optional().default(20) })).query(async ({ input }) => {
    return await db.getRecentDecisions(input.limit);
  }),
  overrideDecision: adminProcedure.input(z.object({
    decisionId: z.number(),
    reason: z.string().max(500),
  })).mutation(async ({ ctx, input }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");
    await dbInstance.update(autopilotDecisions).set({ status: "overridden", overriddenBy: ctx.user.id, overrideReason: input.reason }).where(eq(autopilotDecisions.id, input.decisionId));
    return { success: true };
  }),
  executeAction: adminProcedure.input(z.object({
    type: z.string().min(1).max(100),
    action: z.string().min(1).max(1000),
    reasoning: z.string().max(1000).optional(),
  })).mutation(async ({ ctx, input }) => {
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
    const decision = await db.createAutopilotDecision({
      type: input.type, action: input.action, reasoning: input.reasoning,
      confidence: evaluation.confidence, status: evaluation.proceed ? "executed" : "pending",
      result: evaluation,
    });
    await db.logActivity({ userId: ctx.user.id, action: "autopilot_decision", entityType: "autopilot_decision", entityId: decision.id });
    return { decision, evaluation };
  }),
});
