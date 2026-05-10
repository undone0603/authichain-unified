import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";

export const emailCampaignsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserEmailCampaigns(ctx.user.id);
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    type: z.enum(["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]),
    scheduledAt: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    return await db.createEmailCampaign({
      ...input, userId: ctx.user.id, status: input.scheduledAt ? "scheduled" : "draft",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    });
  }),
  generateContent: protectedProcedure.input(z.object({
    type: z.enum(["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]),
    topic: z.string(),
    targetAudience: z.string().optional(),
  })).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert email marketing specialist for a blockchain authentication platform. Create compelling, professional email content that drives conversions." },
        { role: "user", content: `Create a ${input.type} email about: ${input.topic}. Target audience: ${input.targetAudience || "enterprise decision makers"}. Return JSON with subject and body fields.` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_content",
          strict: true,
          schema: {
            type: "object",
            properties: { subject: { type: "string" }, body: { type: "string" } },
            required: ["subject", "body"],
            additionalProperties: false,
          },
        },
      },
    });
    return JSON.parse(response.choices[0].message.content as string);
  }),
});
