import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { guardedSend } from "../outreach/send-guard";
import { TRPCError } from "@trpc/server";

export const emailDraftsRouter = router({
  listPending: adminProcedure.query(async () => {
    return await db.getPendingDrafts();
  }),
  create: protectedProcedure
    .input(
      z.object({
        prospectName: z.string().optional(),
        prospectEmail: z.string().email(),
        prospectCompany: z.string().optional(),
        industry: z.string().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      return await db.createEmailDraft({
        ...input,
        status: "pending",
        generatedBy: "ai_manager",
      });
    }),
  approve: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const drafts = await db.getPendingDrafts();
      const draft = drafts.find(d => d.id === input.id);
      if (!draft)
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

      await db.updateDraftStatus(input.id, "approved", ctx.user.id);

      const result = await guardedSend({
        to: draft.prospectEmail,
        source: "inbound_optin",
        subject: draft.subject,
        html: draft.body,
      });

      if (result.sent) {
        await db.updateDraftStatus(input.id, "sent", ctx.user.id);
        return { success: true, messageId: result.id };
      }
      if (result.reason === "suppression_list") {
        return { success: false, skipped: true, reason: result.reason };
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to send email: ${result.reason || "unknown error"}`,
      });
    }),
  reject: adminProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateDraftStatus(input.id, "rejected", ctx.user.id);
      return { success: true };
    }),
  bulkApprove: adminProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.ids.map(id => db.updateDraftStatus(id, "approved", ctx.user.id))
      );
      return { success: true, count: input.ids.length };
    }),
});
