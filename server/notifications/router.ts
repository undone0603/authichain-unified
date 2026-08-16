import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const notificationsRouter = router({
  list: protectedProcedure.input(z.object({
    limit: z.number().min(1).max(200).optional().default(50),
  }).optional()).query(async ({ ctx, input }) => {
    return await db.getUserNotifications(ctx.user.id, input?.limit ?? 50);
  }),
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return { count: await db.getUnreadNotificationCount(ctx.user.id) };
  }),
  markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.markNotificationRead(input.id, ctx.user.id);
    return { success: true };
  }),
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deleteNotification(input.id, ctx.user.id);
    return { success: true };
  }),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    type: z.enum(["authentication", "certificate", "payment", "subscription", "nft", "referral", "system", "alert", "supply_chain", "autopilot"]),
    actionUrl: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    return await db.createNotification({ ...input, userId: ctx.user.id, isRead: 0 });
  }),
});
