import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { sendEmail } from "../email/smtp";

export const emailDraftsRouter = router({
  listPending: protectedProcedure.query(async () => {
    return await db.getPendingDrafts();
  }),
  create: protectedProcedure.input(z.object({
    prospectName: z.string().optional(),
    prospectEmail: z.string().email(),
    prospectCompany: z.string().optional(),
    industry: z.string().optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
  })).mutation(async ({ input }) => {
    return await db.createEmailDraft({ ...input, status: "pending", generatedBy: "ai_manager" });
  }),
  approve: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const drafts = await db.getPendingDrafts();
    const draft = drafts.find(d => d.id === input.id);
    await db.updateDraftStatus(input.id, "approved", ctx.user.id);
    // Send the actual email after approval
    if (draft) {
      try {
        await sendEmail({
          to: draft.prospectEmail,
          subject: draft.subject,
          html: draft.body,
        });
        await db.updateDraftStatus(input.id, "sent", ctx.user.id);
      } catch (err) {
        console.error("[EmailDrafts] Failed to send approved email:", err);
      }
    }
    return { success: true };
  }),
  reject: protectedProcedure.input(z.object({ id: z.number(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
    await db.updateDraftStatus(input.id, "rejected", ctx.user.id);
    return { success: true };
  }),
  bulkApprove: protectedProcedure.input(z.object({ ids: z.array(z.number()) })).mutation(async ({ ctx, input }) => {
    for (const id of input.ids) await db.updateDraftStatus(id, "approved", ctx.user.id);
    return { success: true, count: input.ids.length };
  }),

  // Fetch the draft generated for a given AgentZ task (consumed by the Missions review modal).
  getByTaskId: protectedProcedure.input(z.object({ taskId: z.string() })).query(async ({ input }): Promise<any> => {
    const d = await db.getDb();
    const { emailDrafts } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await d.select().from(emailDrafts).where(eq(emailDrafts.taskId, input.taskId)).limit(1);
    return rows[0] ?? null;
  }),

  // Mark a draft as sent by id.
  sendById: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }): Promise<{ success: boolean }> => {
    const d = await db.getDb();
    const { emailDrafts } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await d.update(emailDrafts).set({ status: "sent", sentAt: new Date() }).where(eq(emailDrafts.id, input.id));
    return { success: true };
  }),
});
