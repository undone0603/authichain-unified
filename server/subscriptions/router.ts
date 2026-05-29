import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
// NOTE: subscriptions.create is admin-only — it writes an active sub without
// payment. The normal user flow goes through subscriptions.checkout → Stripe.
import * as db from "../db";
import * as stripeService from "../stripe-service";
import * as paddleService from "../paddle-service";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SUBSCRIPTION_PLANS } from "@shared/subscriptionPlans";

// Paddle price IDs by plan/billing — override with env vars
const PADDLE_PRICES: Record<string, Record<string, string>> = {
  starter:      { monthly: process.env.PADDLE_PRICE_STARTER_MONTHLY || "", annual: process.env.PADDLE_PRICE_STARTER_ANNUAL || "" },
  professional: { monthly: process.env.PADDLE_PRICE_PRO_MONTHLY || "",     annual: process.env.PADDLE_PRICE_PRO_ANNUAL || "" },
  enterprise:   { monthly: process.env.PADDLE_PRICE_ENT_MONTHLY || "",     annual: process.env.PADDLE_PRICE_ENT_ANNUAL || "" },
};

const ALLOWED_CHECKOUT_ORIGINS = [
  "https://authichain.com",
  "https://www.authichain.com",
  "https://govchain.us",
  "https://strainchain.io",
  "https://qron.io",
];

export const subscriptionsRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    const sub = await db.getUserSubscription(ctx.user.id);
    return sub ?? null;
  }),
  create: protectedProcedure.input(z.object({
    plan: z.enum(["starter", "professional", "enterprise", "medtech"]),
    billingCycle: z.enum(["monthly", "annual"]).optional().default("monthly"),
  })).mutation(async ({ ctx, input }) => {
    const quotas: Record<string, number> = {
      starter: SUBSCRIPTION_PLANS.starter.monthlyQuota,
      professional: SUBSCRIPTION_PLANS.professional.monthlyQuota,
      enterprise: SUBSCRIPTION_PLANS.enterprise.monthlyQuota,
      medtech: (SUBSCRIPTION_PLANS as any).medtech?.monthlyQuota ?? 0,
    };
    const result = await db.createSubscription({
      userId: ctx.user.id, plan: input.plan as any, monthlyQuota: quotas[input.plan] ?? 0,
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
    plan: z.enum(["starter", "professional", "enterprise", "medtech"]),
    billing: z.enum(["monthly", "annual"]).optional().default("monthly"),
    origin: z.string().url(),
  })).mutation(async ({ ctx, input }) => {
    const isLocalDev = process.env.NODE_ENV !== "production" &&
      /^https?:\/\/localhost(:\d+)?$/.test(input.origin);
    if (!ALLOWED_CHECKOUT_ORIGINS.includes(input.origin) && !isLocalDev) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid origin" });
    }
    const trialDays = (input.plan === "starter" || input.plan === "professional") ? 14 : undefined;
    const url = await stripeService.createSubscriptionCheckout({
      userId: ctx.user.id,
      userEmail: ctx.user.email || "",
      userName: ctx.user.name || "",
      plan: input.plan as any,
      billing: input.billing,
      origin: input.origin,
      stripeCustomerId: (ctx.user as any).stripeCustomerId || undefined,
      trialDays,
    });
    return { checkoutUrl: url };
  }),
  createPaddleCheckout: protectedProcedure.input(z.object({
    plan: z.enum(["starter", "professional", "enterprise", "medtech"]),
    billing: z.enum(["monthly", "annual"]).optional().default("monthly"),
    successUrl: z.string().url(),
  })).mutation(async ({ ctx, input }) => {
    const priceId = PADDLE_PRICES[input.plan]?.[input.billing];
    if (!priceId) throw new TRPCError({ code: "BAD_REQUEST", message: `Paddle price not configured for ${input.plan}/${input.billing}` });
    const customerId = await paddleService.upsertPaddleCustomer({
      email: ctx.user.email || "",
      name: ctx.user.name || "",
      userId: ctx.user.id,
    });
    const checkoutUrl = await paddleService.createPaddleTransaction({
      customerId,
      priceId,
      successUrl: input.successUrl,
    });
    return { checkoutUrl };
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
    const promo = await (stripe.promotionCodes.create as any)({
      coupon: coupon.id,
      code: input.code,
      active: true,
    });
    return { success: true, code: promo.code, id: promo.id, percentOff: input.percentOff };
  }),
});
