import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { bonuses } from "../../drizzle/schema";

export const bonusesRouter = router({
  getUserBonuses: protectedProcedure.query(async ({ ctx }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await db.select().from(bonuses).where(eq(bonuses.userId, ctx.user.id));
  }),
  claimBonus: protectedProcedure.input(z.object({ bonusId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see getUserBonuses() above
    const [bonus] = await db.select().from(bonuses)
      .where(and(eq(bonuses.id, input.bonusId), eq(bonuses.userId, ctx.user.id)))
      .limit(1);
    if (!bonus) throw new Error("Bonus not found");
    if (bonus.status !== "pending") throw new Error("Bonus already claimed or delivered");
    const claimed = await db.update(bonuses)
      .set({ status: "claimed", claimedAt: new Date() })
      .where(and(eq(bonuses.id, input.bonusId), eq(bonuses.status, "pending")))
      .returning({ id: bonuses.id });
    if (claimed.length === 0) throw new Error("Bonus already claimed or delivered");
    return { success: true };
  }),
  createUserBonuses: adminProcedure.input(z.object({
    userId: z.number(),
    bonusType: z.string(),
    bonusName: z.string(),
    bonusValue: z.number(),
    tier: z.enum(["starter", "professional", "enterprise", "agency"]).optional(),
    deliveryMethod: z.string().optional().default("account_credit"),
  })).mutation(async ({ input }) => {
    const db = await getDb(); // see getUserBonuses() above
    const [row] = await db.insert(bonuses).values({
      userId: input.userId,
      bonusType: input.bonusType,
      bonusName: input.bonusName,
      bonusValue: input.bonusValue,
      tier: input.tier as any,
      status: "pending",
      deliveryMethod: input.deliveryMethod,
    }).returning();
    return { id: row.id };
  }),
});
