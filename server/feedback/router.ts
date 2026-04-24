import { z } from "zod";
import { protectedProcedure, publicProcedure, adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
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
      const feedbackId = await createFeedback({
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
    const feedbackList = await getAllFeedback();
    return feedbackList;
  }),

  // Get feedback by ID
  getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const feedbackItem = await getFeedbackById(input.id);
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
    const userFeedback = await getFeedbackByUserId(ctx.user.id);
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
      await voteFeedback(input.feedbackId, ctx.user.id, input.voteType);
      return { success: true };
    }),

  // Remove vote
  removeVote: protectedProcedure
    .input(z.object({ feedbackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await removeVote(input.feedbackId, ctx.user.id);
      return { success: true };
    }),

  // Get user's vote on feedback
  getUserVote: protectedProcedure
    .input(z.object({ feedbackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const vote = await getUserVote(input.feedbackId, ctx.user.id);
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
      await updateFeedbackStatus(input.id, input.status, input.adminResponse);
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
      await updateFeedbackPriority(input.id, input.priority);
      return { success: true };
    }),

  // Get feedback statistics
  stats: publicProcedure.query(async () => {
    const stats = await getFeedbackStats();
    return stats;
  }),
});
