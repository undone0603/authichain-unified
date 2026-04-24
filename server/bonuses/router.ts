import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { db } from "../db";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { bonuses } from "../../drizzle/schema";

export const bonusesRouter = router({
  getUserBonuses: protectedProcedure.query(async ({ ctx }) => {
    return await db.select().from(bonuses).where(eq(bonuses.userId, ctx.user.id));
  }),
  claimBonus: protectedProcedure.input(z.object({ bonusId: z.number() })).mutation(async ({ ctx, input }) => {
    const [bonus] = await db.select().from(bonuses)
      .where(and(eq(bonuses.id, input.bonusId), eq(bonuses.userId, ctx.user.id)))
      .limit(1);
    if (!bonus) throw new Error("Bonus not found");
    if (bonus.status !== "pending") throw new Error("Bonus already claimed or delivered");
    await db.update(bonuses)
      .set({ status: "claimed", claimedAt: new Date() })
      .where(eq(bonuses.id, input.bonusId));
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
    const [result] = await db.insert(bonuses).values({
      userId: input.userId,
      bonusType: input.bonusType,
      bonusName: input.bonusName,
      bonusValue: input.bonusValue,
      tier: input.tier as any,
      status: "pending",
      deliveryMethod: input.deliveryMethod,
    }).returning();
    return { id: result.id };
  }),
});
