import { z } from "zod";
import { protectedProcedure, publicProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getAllLeads, createLead, updateLeadScore, updateLeadStatus } from "../content-db-helpers";
import * as hubspot from "../hubspot-service";
import { invokeLLM } from "../_core/llm";

export const marketingRouter = router({
  leads: adminProcedure.query(async () => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getAllLeads(db);
  }),
  createLead: publicProcedure.input(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    company: z.string().optional(),
    source: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    const result = await createLead(db, input);
    try {
      await hubspot.syncLeadToHubSpot(input);
    } catch (e) { /* HubSpot sync is best-effort */ }
    return result;
  }),
  updateLeadScore: adminProcedure.input(z.object({ id: z.number(), score: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    await updateLeadScore(db, input.id, input.score);
    return { success: true };
  }),
  updateLeadStatus: adminProcedure.input(z.object({ id: z.number(), status: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    await updateLeadStatus(db, input.id, input.status);
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
