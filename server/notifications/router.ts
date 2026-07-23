import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
} from "../content-db-helpers";
import { z } from "zod";

export const notificationsRouter = router({
  list: protectedProcedure.input(z.object({
    limit: z.number().min(1).max(200).optional().default(50),
  }).optional()).query(async ({ ctx, input }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getUserNotifications(db, ctx.user.id, input?.limit ?? 50);
  }),
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return { count: await getUnreadNotificationCount(db, ctx.user.id) };
  }),
  markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    await markNotificationRead(db, input.id, ctx.user.id);
    return { success: true };
  }),
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    await markAllNotificationsRead(db, ctx.user.id);
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    await deleteNotification(db, input.id, ctx.user.id);
    return { success: true };
  }),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    type: z.enum(["authentication", "certificate", "payment", "subscription", "nft", "referral", "system", "alert", "supply_chain", "autopilot"]),
    actionUrl: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    return await createNotification(db, { ...input, userId: ctx.user.id, isRead: 0 });
  }),
});
