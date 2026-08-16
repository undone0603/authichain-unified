/**
 * tRPC Router for Stripe Connect operations
 * Exposes stripe-connect-service functions to the frontend
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  provisionVendorAccount,
  generateOnboardingLink,
  createVendorCheckoutSession,
  createPlatformSubscriptionPlan,
  attachBalancePaymentMethod,
  subscribeVendorToPlatform,
} from "./stripe-connect-service";

export const stripeConnectRouter = router({
  provisionAccount: protectedProcedure
    .input(z.object({ country: z.string().length(2).default("US") }))
    .mutation(async ({ ctx, input }) => {
      const accountId = await provisionVendorAccount(
        ctx.user.id,
        ctx.user.name ?? "Vendor",
        ctx.user.email ?? "",
        input.country,
      );
      return { accountId };
    }),

  getOnboardingLink: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      const url = await generateOnboardingLink(input.accountId);
      return { url };
    }),

  createCheckout: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      currency: z.string().default("usd"),
    }))
    .mutation(async ({ input }) => {
      const url = await createVendorCheckoutSession(input.accountId, input.currency);
      return { url };
    }),

  createPlan: protectedProcedure
    .input(z.object({ currency: z.string().default("usd") }))
    .mutation(async ({ input }) => {
      const product = await createPlatformSubscriptionPlan(input.currency);
      return { productId: product.id, defaultPriceId: product.default_price as string };
    }),

  attachPaymentMethod: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      const paymentMethodId = await attachBalancePaymentMethod(input.accountId);
      return { paymentMethodId };
    }),

  subscribe: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      paymentMethodId: z.string(),
      priceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const subscription = await subscribeVendorToPlatform(
        input.accountId,
        input.paymentMethodId,
        input.priceId,
      );
      return { subscriptionId: subscription.id, status: subscription.status };
    }),
});
