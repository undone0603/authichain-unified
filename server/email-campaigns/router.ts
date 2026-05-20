import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { sendEmail } from "../email-service";
import { TRPCError } from "@trpc/server";

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
    targetEmail: z.string().email().optional(),
  })).mutation(async ({ ctx, input }) => {
    return await db.createEmailCampaign({
      ...input, userId: ctx.user.id, status: input.scheduledAt ? "scheduled" : "draft",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    });
  }),
  send: protectedProcedure.input(z.object({
    campaignId: z.number(),
    targetEmail: z.string().email(),
  })).mutation(async ({ ctx, input }) => {
    const campaigns = await db.getUserEmailCampaigns(ctx.user.id);
    const campaign = campaigns.find(c => c.id === input.campaignId);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

    const result = await sendEmail({
      to: input.targetEmail,
      subject: campaign.subject,
      body: campaign.body,
    });

    if (result.status === "sent") {
      await db.updateEmailCampaign(input.campaignId, {
        status: "sent",
        sentAt: new Date(),
        targetEmail: input.targetEmail,
        providerMessageId: result.providerMessageId,
      });
      return { success: true, messageId: result.providerMessageId };
    } else {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to send email: ${result.reason || "unknown error"}`,
      });
    }
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

