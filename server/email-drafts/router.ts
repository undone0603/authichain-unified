import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getPendingDrafts, createEmailDraft, updateDraftStatus } from "../content-db-helpers";
import { z } from "zod";
import { sendEmail } from "../email/smtp";

export const emailDraftsRouter = router({
  listPending: adminProcedure.query(async () => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getPendingDrafts(db);
  }),
  create: protectedProcedure.input(z.object({
    prospectName: z.string().optional(),
    prospectEmail: z.string().email(),
    prospectCompany: z.string().optional(),
    industry: z.string().optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    return await createEmailDraft(db, { ...input, status: "pending", generatedBy: "ai_manager" });
  }),
  approve: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const drafts = await getPendingDrafts(db);
    const draft = drafts.find(d => d.id === input.id);
    await updateDraftStatus(db, input.id, "approved", ctx.user.id);
    // Send the actual email after approval
    if (draft) {
      try {
        await sendEmail({
          to: draft.prospectEmail,
          subject: draft.subject,
          html: draft.body,
        });
        await updateDraftStatus(db, input.id, "sent", ctx.user.id);
      } catch (err) {
        console.error("[EmailDrafts] Failed to send approved email:", err);
      }
    }
    return { success: true };
  }),
  reject: adminProcedure.input(z.object({ id: z.number(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    await updateDraftStatus(db, input.id, "rejected", ctx.user.id);
    return { success: true };
  }),
  bulkApprove: adminProcedure.input(z.object({ ids: z.array(z.number()) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    await Promise.all(input.ids.map(id => updateDraftStatus(db, id, "approved", ctx.user.id)));
    return { success: true, count: input.ids.length };
  }),
});
