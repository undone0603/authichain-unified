import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  listNfts,
  getNftById,
  createNft,
  logActivity,
  listCollections,
  getCollectionBySlug,
  createCollection,
  getActiveAuctions,
  getAuctionById,
  getAuctionBids,
  createAuction,
  placeBid,
} from "../identity-db-helpers";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { triggerMacrohardEvent } from "../macrohard/service";

export const nftRouter = router({
  list: publicProcedure.input(z.object({
    collectionId: z.number().optional(),
    status: z.string().optional(),
    limit: z.number().optional().default(50),
  })).query(async ({ input }) => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await listNfts(db, input);
  }),
  getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb(); // see list() above
    return await getNftById(db, input.id);
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
    const db = await getDb(); // see list() above
    const result = await createNft(db, { ...input, ownerId: ctx.user.id, creatorId: ctx.user.id, status: "listed" });
    await logActivity(db, { userId: ctx.user.id, action: "nft_created", entityType: "nft", entityId: result.id });

    // Trigger MACROHARD Webhook: nft_minted
    await triggerMacrohardEvent("nft_minted", {
      nftId: result.id,
      name: result.name,
      productId: input.productId,
      userId: ctx.user.id
    });

    return result;
  }),

  collections: router({
    list: publicProcedure.query(async () => {
      const db = await getDb(); // see list() above
      return await listCollections(db);
    }),
    getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      const db = await getDb(); // see list() above
      return await getCollectionBySlug(db, input.slug);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); // see list() above
      return await createCollection(db, { ...input, userId: ctx.user.id });
    }),
  }),
  auctions: router({
    list: publicProcedure.query(async () => {
      const db = await getDb(); // see list() above
      return await getActiveAuctions(db);
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const db = await getDb(); // see list() above
      const auction = await getAuctionById(db, input.id);
      const bids = await getAuctionBids(db, input.id);
      return { auction, bids };
    }),
    create: protectedProcedure.input(z.object({
      nftId: z.number(),
      startPrice: z.string(),
      reservePrice: z.string().optional(),
      endsAt: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); // see list() above
      const nft = await getNftById(db, input.nftId);
      if (!nft) throw new TRPCError({ code: "NOT_FOUND", message: "NFT not found" });
      if (nft.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this NFT" });
      return await createAuction(db, { ...input, sellerId: ctx.user.id, endsAt: new Date(input.endsAt) });
    }),
    bid: protectedProcedure.input(z.object({
      auctionId: z.number(),
      amount: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); // see list() above
      const auction = await getAuctionById(db, input.auctionId);
      if (!auction) throw new TRPCError({ code: "NOT_FOUND" });
      if (auction.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Auction not active" });
      if (auction.currentBid && parseFloat(input.amount) <= parseFloat(auction.currentBid)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bid must be higher than current bid" });
      }
      await placeBid(db, input.auctionId, ctx.user.id, input.amount);
      return { success: true };
    }),
  }),
});
