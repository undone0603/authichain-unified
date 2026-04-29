import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as stripeService from "../stripe-service";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { B2B_PLANS, B2B_BRANDS, type B2BBrand } from "@shared/pricing";

export const subscriptionsRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    const sub = await db.getUserSubscription(ctx.user.id);
    return sub ?? null;
  }),
  create: protectedProcedure.input(z.object({
    plan: z.enum(["starter", "professional", "enterprise"]),
    billingCycle: z.enum(["monthly", "annual"]).optional().default("monthly"),
  })).mutation(async ({ ctx, input }) => {
    const quotas = {
      starter: B2B_PLANS.starter.quota,
      professional: B2B_PLANS.professional.quota,
      enterprise: B2B_PLANS.enterprise.quota,
    };
    const result = await db.createSubscription({
      userId: ctx.user.id, plan: input.plan, monthlyQuota: quotas[input.plan],
      usedQuota: 0, billingCycle: input.billingCycle, status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + (input.billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000),
    });
    await db.logActivity({ userId: ctx.user.id, action: "subscription_created", entityType: "subscription", entityId: result.id });
    return result;
  }),
  invoices: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserInvoices(ctx.user.id);
  }),
  usage: protectedProcedure.query(async ({ ctx }) => {
    const sub = await db.getUserSubscription(ctx.user.id);
    if (!sub) return { plan: null, used: 0, limit: 0, percentage: 0 };
    return { plan: sub.plan, used: sub.usedQuota || 0, limit: sub.monthlyQuota, percentage: Math.round(((sub.usedQuota || 0) / sub.monthlyQuota) * 100) };
  }),
  checkout: protectedProcedure.input(z.object({
    plan: z.enum(["starter", "professional", "enterprise"]),
    billing: z.enum(["monthly", "annual"]).optional().default("monthly"),
    origin: z.string(),
    brand: z.enum(B2B_BRANDS as unknown as [B2BBrand, ...B2BBrand[]]).optional(),
    contractSetupOrderId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const url = await stripeService.createSubscriptionCheckout({
      userId: ctx.user.id,
      userEmail: ctx.user.email || "",
      userName: ctx.user.name || "",
      plan: input.plan,
      billing: input.billing,
      origin: input.origin,
      stripeCustomerId: (ctx.user as any).stripeCustomerId || undefined,
      brand: input.brand,
      contractSetupOrderId: input.contractSetupOrderId,
    });
    return { checkoutUrl: url };
  }),
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const sub = await db.getUserSubscription(ctx.user.id);
    if (!sub?.stripeSubscriptionId) throw new TRPCError({ code: "NOT_FOUND", message: "No active Stripe subscription" });
    await stripeService.cancelSubscription(sub.stripeSubscriptionId);
    return { success: true, message: "Subscription will cancel at end of billing period" };
  }),
  paymentHistory: protectedProcedure.query(async ({ ctx }) => {
    const stripeCustomerId = (ctx.user as any).stripeCustomerId;
    if (!stripeCustomerId) return { payments: [], invoices: [] };
    const [payments, invoices] = await Promise.all([
      stripeService.getCustomerPayments(stripeCustomerId).catch(() => []),
      stripeService.getCustomerInvoices(stripeCustomerId).catch(() => []),
    ]);
    return { payments, invoices };
  }),
  createPromoCode: adminProcedure.input(z.object({
    code: z.string().min(1),
    percentOff: z.number().min(1).max(100).default(99),
    name: z.string().optional(),
  })).mutation(async ({ input }) => {
    const stripe = stripeService.getStripe();
    const coupon = await stripe.coupons.create({
      percent_off: input.percentOff,
      duration: "forever",
      name: input.name || `AuthiChain ${input.percentOff}% Off`,
    });
    const promo = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code: input.code,
      active: true,
    });
    return { success: true, code: promo.code, id: promo.id, percentOff: input.percentOff };
  }),
});
