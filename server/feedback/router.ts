import { z } from "zod";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  createFeedback,
  getAllFeedback,
  getFeedbackById,
  getFeedbackByUserId,
  updateFeedbackStatus,
  updateFeedbackPriority,
  voteFeedback,
  removeVote,
  getUserVote,
  getFeedbackStats,
} from "./db";

export const feedbackRouter = router({
  // Submit new feedback (protected - requires login)
  submit: protectedProcedure
    .input(
      z.object({
        type: z.enum(["bug", "feature", "improvement", "general"]),
        title: z.string().min(5).max(255),
        description: z.string().min(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
      // context does. Bridge via getDb() until this router has a ctx.db to use.
      const db = await getDb();
      const feedbackId = await createFeedback(db, {
        userId: ctx.user.id,
        type: input.type,
        title: input.title,
        description: input.description,
      });

      return {
        success: true,
        feedbackId,
      };
    }),

  // Get all feedback (public - anyone can view)
  list: publicProcedure.query(async () => {
    const db = await getDb();
    const feedbackList = await getAllFeedback(db);
    return feedbackList;
  }),

  // Get feedback by ID
  getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    const feedbackItem = await getFeedbackById(db, input.id);
    if (!feedbackItem) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Feedback not found",
      });
    }
    return feedbackItem;
  }),

  // Get user's feedback
  myFeedback: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const userFeedback = await getFeedbackByUserId(db, ctx.user.id);
    return userFeedback;
  }),

  // Vote on feedback
  vote: protectedProcedure
    .input(
      z.object({
        feedbackId: z.number(),
        voteType: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await voteFeedback(db, input.feedbackId, ctx.user.id, input.voteType);
      return { success: true };
    }),

  // Remove vote
  removeVote: protectedProcedure
    .input(z.object({ feedbackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await removeVote(db, input.feedbackId, ctx.user.id);
      return { success: true };
    }),

  // Get user's vote on feedback
  getUserVote: protectedProcedure
    .input(z.object({ feedbackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const vote = await getUserVote(db, input.feedbackId, ctx.user.id);
      return vote;
    }),

  // Admin: Update feedback status
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "in_progress", "completed", "rejected"]),
        adminResponse: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      await updateFeedbackStatus(db, input.id, input.status, input.adminResponse);
      return { success: true };
    }),

  // Admin: Update feedback priority
  updatePriority: adminProcedure
    .input(
      z.object({
        id: z.number(),
        priority: z.enum(["low", "medium", "high", "critical"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      await updateFeedbackPriority(db, input.id, input.priority);
      return { success: true };
    }),

  // Get feedback statistics
  stats: publicProcedure.query(async () => {
    const db = await getDb();
    const stats = await getFeedbackStats(db);
    return stats;
  }),
});
