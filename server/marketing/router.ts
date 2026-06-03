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
  activateBrand: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const lead = await db.getLeadById(input.id);
    if (!lead) throw new Error("Lead not found");

    // 1. Create a production product entry for the new brand
    const productName = `${lead.company || lead.name} Signature Series`;
    const product = await db.createProduct({
      userId: 1, // System admin
      name: productName,
      brand: lead.company || lead.name || "Pilot Partner",
      category: "Luxury",
      description: `Authentic digital twin for ${lead.company}. Anchored in the AuthiChain Protocol.`,
      isRegistered: true,
      metadata: { pilot_lead_id: lead.id }
    });

    // 2. Anchor to L1 (Simulation of the worker we built)
    const { anchorToPolygon } = await import("../../src/actions/anchor");
    const anchor = await anchorToPolygon(`ACTIVATE-${product.id}`, `0x${Buffer.from(productName).toString('hex')}`, product.id);

    if (anchor.success) {
       await db.updateProduct(product.id, { blockchainTxHash: anchor.txHash });
    }

    // 3. Mark lead as active
    await db.updateLeadStatus(input.id, "active_partner");

    return { success: true, productId: product.id, productCount: 1 };
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
