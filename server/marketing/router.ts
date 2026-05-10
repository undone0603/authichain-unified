import { protectedProcedure, publicProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as hubspot from "../hubspot-service";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";

export const marketingRouter = router({
  leads: adminProcedure.query(async () => {
    return await db.getAllLeads();
  }),
  createLead: publicProcedure.input(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    company: z.string().optional(),
    source: z.string().optional(),
  })).mutation(async ({ input }) => {
    const result = await db.createLead(input);
    try {
      await hubspot.syncLeadToHubSpot(input);
    } catch (e) { /* HubSpot sync is best-effort */ }
    return result;
  }),
  updateLeadScore: adminProcedure.input(z.object({ id: z.number(), score: z.number() })).mutation(async ({ input }) => {
    await db.updateLeadScore(input.id, input.score);
    return { success: true };
  }),
  updateLeadStatus: adminProcedure.input(z.object({ id: z.number(), status: z.string() })).mutation(async ({ input }) => {
    await db.updateLeadStatus(input.id, input.status);
    return { success: true };
  }),
  generateContent: protectedProcedure.input(z.object({
    type: z.enum(["email", "social", "blog"]),
    topic: z.string(),
    targetAudience: z.string().optional(),
  })).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a marketing expert for a blockchain authentication platform. Create compelling, professional content." },
        { role: "user", content: `Create ${input.type} content about: ${input.topic}. Target: ${input.targetAudience || "enterprise decision makers"}` },
      ],
    });
    return { content: response.choices[0].message.content };
  }),
});
