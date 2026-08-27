import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as ordinals from "../ordinals-service";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";

// Loose sanity check, not full address validation — legacy (1...), P2SH (3...),
// and bech32/bech32m (bc1...) mainnet formats. OrdinalsBot does the real
// validation; this just catches obvious typos before we spend a request.
const BTC_ADDRESS_RE = /^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

export const ordinalsRouter = router({
  /**
   * Orders a Bitcoin Ordinals inscription of a product's image via OrdinalsBot.
   * This is a real, billable on-chain action — OrdinalsBot funds and broadcasts
   * the commit/reveal transactions and charges for it. It returns an ORDER, not
   * a confirmed inscription: Bitcoin confirmation takes time, so the client
   * should poll `getStatus` (once OrdinalsBot's response yields an inscription
   * ID) before calling `linkToProduct`.
   */
  createInscription: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        receiveAddress: z
          .string()
          .regex(BTC_ADDRESS_RE, "Not a recognizable Bitcoin address"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = ENV.ordinalsBotApiKey;
      if (!apiKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Bitcoin inscription is not configured",
        });
      }

      const product = await db.getProductById(input.productId);
      if (!product)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      if (product.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      if (!product.imageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Product has no image to inscribe",
        });
      }

      const envelope = await ordinals.prepareOrdinalEnvelope(product.imageUrl, {
        productId: product.id,
        productName: product.name,
        timestamp: new Date().toISOString(),
      });

      const order = await ordinals.createInscriptionOrder(
        envelope,
        input.receiveAddress,
        apiKey
      );

      await db.logActivity({
        userId: ctx.user.id,
        action: "ordinal_inscription_ordered",
        entityType: "product",
        entityId: product.id,
      });

      return { order };
    }),

  /** Polls OrdinalsBot/Hiro for the on-chain status of a given inscription ID. */
  getStatus: protectedProcedure
    .input(z.object({ inscriptionId: z.string() }))
    .query(async ({ input }) => {
      return await ordinals.getInscriptionStatus(input.inscriptionId);
    }),

  /** Records a confirmed inscription ID against the product once it has settled. */
  linkToProduct: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        inscriptionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await db.getProductById(input.productId);
      if (!product)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      if (product.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

      return await ordinals.linkOrdinalToProduct(
        input.productId,
        input.inscriptionId
      );
    }),
});
