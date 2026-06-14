import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { triggerMacrohardEvent } from "../macrohard/service";

export const nftRouter = router({
  list: publicProcedure.input(z.object({
    collectionId: z.number().optional(),
    status: z.string().optional(),
    limit: z.number().optional().default(50),
  })).query(async ({ input }) => {
    return await db.listNfts(input);
  }),
  getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return await db.getNftById(input.id);
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    ipfsHash: z.string().optional(),
    collectionId: z.number().optional(),
    price: z.string().optional(),
    currency: z.string().optional().default("ETH"),
    traits: z.any().optional(),
    productId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const result = await db.createNft({ ...input, ownerId: ctx.user.id, creatorId: ctx.user.id, status: "listed" });
    await db.logActivity({ userId: ctx.user.id, action: "nft_created", entityType: "nft", entityId: result.id });

    // Trigger MACROHARD Webhook: nft_minted
    await triggerMacrohardEvent("nft_minted", {
      nftId: result.id,
      name: input.name,
      productId: input.productId,
      userId: ctx.user.id
    });

    return result;
  }),

  collections: router({
    list: publicProcedure.query(async () => {
      return await db.listCollections();
    }),
    getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      return await db.getCollectionBySlug(input.slug);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      return await db.createCollection({ ...input, userId: ctx.user.id });
    }),
  }),
  auctions: router({
    list: publicProcedure.query(async () => {
      return await db.getActiveAuctions();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const auction = await db.getAuctionById(input.id);
      const bids = await db.getAuctionBids(input.id);
      return { auction, bids };
    }),
    create: protectedProcedure.input(z.object({
      nftId: z.number(),
      startPrice: z.string(),
      reservePrice: z.string().optional(),
      endsAt: z.string(),
    })).mutation(async ({ ctx, input }) => {
      return await db.createAuction({ ...input, sellerId: ctx.user.id, endsAt: new Date(input.endsAt) });
    }),
    bid: protectedProcedure.input(z.object({
      auctionId: z.number(),
      amount: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const auction = await db.getAuctionById(input.auctionId);
      if (!auction) throw new TRPCError({ code: "NOT_FOUND" });
      if (auction.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Auction not active" });
      if (auction.currentBid && parseFloat(input.amount) <= parseFloat(auction.currentBid)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bid must be higher than current bid" });
      }
      await db.placeBid(input.auctionId, ctx.user.id, input.amount);
      return { success: true };
    }),
  }),
});
