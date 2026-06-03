import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { disputedArtifacts, governanceVotes, protocolAgents, products, stakingPositions } from "../../src/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const governanceRouter = router({
  listDisputes: publicProcedure.query(async () => {
    const db = await getDb();
    return await db.select({
      id: disputedArtifacts.id,
      productId: disputedArtifacts.id,
      aiScore: disputedArtifacts.aiScore,
      status: disputedArtifacts.status,
      votesAuthentic: disputedArtifacts.votesAuthentic,
      votesCounterfeit: disputedArtifacts.votesCounterfeit,
      deadline: disputedArtifacts.deadline,
      productName: products.name,
      brand: products.brand,
    })
    .from(disputedArtifacts)
    .innerJoin(products, eq(disputedArtifacts.productId, products.id))
    .where(eq(disputedArtifacts.status, "open"))
    .orderBy(desc(disputedArtifacts.createdAt));
  }),

  castVote: protectedProcedure
    .input(z.object({
      disputeId: z.number(),
      vote: z.enum(["authentic", "counterfeit"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      
      // 1. Verify user has an active agent with reputation
      const [agent] = await db.select()
        .from(protocolAgents)
        .where(and(eq(protocolAgents.userId, ctx.user.id), eq(protocolAgents.status, "active")))
        .limit(1);

      if (!agent || (agent.reputationScore ?? 0) < 50) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "You need a reputation score of at least 50 to arbitrate disputes." 
        });
      }

      // 2. Check if user already voted
      const [existing] = await db.select()
        .from(governanceVotes)
        .where(and(eq(governanceVotes.disputeId, input.disputeId), eq(governanceVotes.userId, ctx.user.id)))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "You have already cast your vote for this dispute." });
      }

      // 3. Calculate Vote Weight based on Staked QRON
      const [staking] = await db.select({ total: sql<string>`sum(amount)` })
        .from(stakingPositions)
        .where(and(eq(stakingPositions.userId, ctx.user.id), eq(stakingPositions.status, "active")))
        .limit(1);

      const weight = (parseFloat(staking?.total || "0") + 100).toString(); // Base weight of 100

      // 4. Record Vote
      await db.insert(governanceVotes).values({
        disputeId: input.disputeId,
        userId: ctx.user.id,
        agentId: agent.id,
        vote: input.vote,
        weight: weight,
      });

      // 5. Update Dispute Totals
      const updateField = input.vote === "authentic" ? disputedArtifacts.votesAuthentic : disputedArtifacts.votesCounterfeit;
      await db.update(disputedArtifacts)
        .set({ [updateField.name]: sql`${updateField} + 1` })
        .where(eq(disputedArtifacts.id, input.disputeId));

      return { success: true, weight: parseFloat(weight) };
    }),
});
