import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SUBSCRIPTION_PLANS } from "@shared/subscriptionPlans";
import { nanoid } from "nanoid";
import * as db from "./db";
import * as stripeService from "./stripe-service";
import * as thirdweb from "./thirdweb";
import * as hubspot from "./hubspot-service";
import { invokeLLM } from "./_core/llm";
import QRCode from "qrcode";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Products ────────────────────────────────────────────────────────────
  products: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserProducts(ctx.user.id);
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getProductById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      brand: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      serialNumber: z.string().optional(),
      batchNumber: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.createProduct({ ...input, userId: ctx.user.id });
      await db.logActivity({ userId: ctx.user.id, action: "product_created", entityType: "product", entityId: result.id });
      return result;
    }),
  }),

  // ─── AI Authentication ───────────────────────────────────────────────────
  authenticate: router({
    analyze: protectedProcedure.input(z.object({
      productId: z.number(),
      imageUrl: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const sub = await db.getUserSubscription(ctx.user.id);
      if (sub && (sub.usedQuota ?? 0) >= sub.monthlyQuota) throw new TRPCError({ code: "FORBIDDEN", message: "Monthly quota exceeded. Please upgrade your plan." });
      const product = await db.getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert luxury product authenticator with blockchain verification capabilities. Analyze the provided product image and determine if it is authentic or counterfeit. Provide detailed reasoning, a confidence score (0-100), red flags, and authentic markers." },
          { role: "user", content: [
            { type: "text" as const, text: `Authenticate this ${product.brand || ""} ${product.name}. Serial: ${product.serialNumber || "N/A"}. Category: ${product.category || "general"}` },
            { type: "image_url" as const, image_url: { url: input.imageUrl } }
          ]}
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "authentication_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                result: { type: "string", enum: ["authentic", "counterfeit", "uncertain"] },
                confidence: { type: "integer" },
                analysis: { type: "string" },
                redFlags: { type: "array", items: { type: "string" } },
                authenticMarkers: { type: "array", items: { type: "string" } },
                recommendation: { type: "string" }
              },
              required: ["result", "confidence", "analysis", "redFlags", "authenticMarkers", "recommendation"],
              additionalProperties: false
            }
          }
        }
      });
      const aiResult = JSON.parse(response.choices[0].message.content as string);
      const authResult = await db.createAuthentication({
        productId: input.productId, userId: ctx.user.id, aiAnalysis: aiResult,
        confidenceScore: aiResult.confidence, result: aiResult.result, imageUrl: input.imageUrl,
      });
      // Auto-generate certificate for authentic products
      if (aiResult.result === "authentic" && aiResult.confidence >= 80) {
        const certNumber = `AC-${Date.now()}-${nanoid(8).toUpperCase()}`;
        await db.createCertificate({
          productId: input.productId, authenticationId: authResult.id, userId: ctx.user.id,
          certificateNumber: certNumber, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      }
      if (sub) await db.updateSubscriptionUsage(ctx.user.id, (sub.usedQuota || 0) + 1);
      await db.recordUsage({ userId: ctx.user.id, subscriptionId: sub?.id, type: "authentication", quantity: 1 });
      await db.logActivity({ userId: ctx.user.id, action: "product_authenticated", entityType: "authentication", entityId: authResult.id });
      // Auto-notification for authentication result
      try {
        const emoji = aiResult.result === "authentic" ? "Verified" : aiResult.result === "counterfeit" ? "Alert" : "Review Needed";
        await db.createSystemNotification(
          ctx.user.id,
          `Authentication ${emoji}: ${product.name}`,
          `${product.brand || "Product"} ${product.name} scored ${aiResult.confidence}% confidence as ${aiResult.result}. ${aiResult.recommendation}`,
          aiResult.result === "counterfeit" ? "alert" : "authentication",
          "/authenticate"
        );
      } catch (notifErr) { console.warn("[Notification] Failed:", notifErr); }
      return aiResult;
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserAuthentications(ctx.user.id);
    }),
  }),

  // ─── Certificates ────────────────────────────────────────────────────────
  certificates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserCertificates(ctx.user.id);
    }),
    verify: publicProcedure.input(z.object({ certificateNumber: z.string() })).query(async ({ input }) => {
      const cert = await db.getCertificateByNumber(input.certificateNumber);
      if (!cert) return { valid: false, message: "Certificate not found" };
      if (cert.status === "revoked") return { valid: false, message: "Certificate has been revoked" };
      if (cert.expiresAt && cert.expiresAt < new Date()) return { valid: false, message: "Certificate has expired" };
      const product = await db.getProductById(cert.productId);
      return { valid: true, certificate: cert, product };
    }),
    makePublic: protectedProcedure.input(z.object({ authenticationId: z.number() })).mutation(async ({ input }) => {
      const crypto = await import("crypto");
      const shareToken = crypto.randomBytes(32).toString("hex");
      await db.updateAuthenticationSharing(input.authenticationId, true, shareToken);
      return { shareToken, shareUrl: `/certificate/${shareToken}` };
    }),
    getPublic: publicProcedure.input(z.object({ shareToken: z.string() })).query(async ({ input }) => {
      const auth = await db.getAuthenticationByShareToken(input.shareToken);
      if (!auth || !auth.isPublic) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      const product = await db.getProductById(auth.productId);
      await db.incrementShareCount(auth.id);
      return { authentication: auth, product };
    }),
  }),

  // ─── QR Codes ────────────────────────────────────────────────────────────
  qrcode: router({
    generate: protectedProcedure.input(z.object({
      productId: z.number(),
      size: z.number().optional().default(300),
    })).mutation(async ({ ctx, input }) => {
      const product = await db.getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      const verifyUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || "https://authichain.com"}/verify/${product.id}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: input.size, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
      await db.createQrCode({ productId: input.productId, userId: ctx.user.id, qrData: verifyUrl, qrImageUrl: qrDataUrl });
      return { qrCodeDataUrl: qrDataUrl, verifyUrl };
    }),
    scan: publicProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      const product = await db.getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      const qrCodes = await db.getProductQrCodes(input.productId);
      if (qrCodes.length > 0) await db.incrementScanCount(qrCodes[0].id);
      return { product, scanCount: (qrCodes[0]?.scanCount || 0) + 1 };
    }),
    listForProduct: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      return await db.getProductQrCodes(input.productId);
    }),
  }),

  // ─── NFT Marketplace ─────────────────────────────────────────────────────
  nft: router({
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
  }),

  // ─── Subscriptions ───────────────────────────────────────────────────────
  subscription: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      const sub = await db.getUserSubscription(ctx.user.id);
      return sub ?? null;
    }),
    create: protectedProcedure.input(z.object({
      plan: z.enum(["starter", "professional", "enterprise"]),
      billingCycle: z.enum(["monthly", "annual"]).optional().default("monthly"),
    })).mutation(async ({ ctx, input }) => {
      const quotas = {
        starter: SUBSCRIPTION_PLANS.starter.monthlyQuota,
        professional: SUBSCRIPTION_PLANS.professional.monthlyQuota,
        enterprise: SUBSCRIPTION_PLANS.enterprise.monthlyQuota,
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
    })).mutation(async ({ ctx, input }) => {
      const url = await stripeService.createSubscriptionCheckout({
        userId: ctx.user.id,
        userEmail: ctx.user.email || "",
        userName: ctx.user.name || "",
        plan: input.plan,
        billing: input.billing,
        origin: input.origin,
        stripeCustomerId: (ctx.user as any).stripeCustomerId || undefined,
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
  }),

  // ─── Payments ────────────────────────────────────────────────────────────
  payments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserPayments(ctx.user.id);
    }),
    createStripe: protectedProcedure.input(z.object({
      amount: z.string(),
      currency: z.string().optional().default("USD"),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      return await db.createPayment({ userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "stripe", status: "pending", metadata: input.metadata });
    }),
    createCrypto: protectedProcedure.input(z.object({
      amount: z.string(),
      currency: z.string().optional().default("BTC"),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      return await db.createPayment({ userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "crypto", status: "pending", metadata: input.metadata });
    }),
    createEscrow: protectedProcedure.input(z.object({
      amount: z.string(),
      releaseDate: z.string(),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      return await db.createPayment({
        userId: ctx.user.id, amount: input.amount, method: "escrow", status: "escrowed",
        escrowReleaseDate: new Date(input.releaseDate), metadata: input.metadata,
      });
    }),
  }),

  // ─── Autopilot ───────────────────────────────────────────────────────────
  autopilot: router({
    getStatus: protectedProcedure.query(async () => {
      const config = await db.getAutopilotConfig();
      const decisions = await db.getRecentDecisions(5);
      const executed = decisions.filter(d => d.status === "executed").length;
      return {
        enabled: config?.enabled || 0,
        mode: config?.mode || "balanced",
        guardrails: config?.guardrails,
        uptime: 99.5,
        decisionsToday: decisions.length,
        actionsToday: executed,
        successRate: decisions.length > 0 ? Math.round((executed / decisions.length) * 100) : 0,
        recentDecisions: decisions,
      };
    }),
    toggle: protectedProcedure.mutation(async ({ ctx }) => {
      const config = await db.getAutopilotConfig();
      await db.upsertAutopilotConfig({
        enabled: config?.enabled === 1 ? 0 : 1,
        mode: config?.mode || "balanced",
        guardrails: config?.guardrails || JSON.stringify({ maxEmailsPerDay: 50, maxSocialPostsPerDay: 5, maxDiscountPercent: 30 }),
        updatedBy: ctx.user.id,
      });
      return { success: true, enabled: config?.enabled === 1 ? 0 : 1 };
    }),
    updateMode: protectedProcedure.input(z.object({
      mode: z.enum(["conservative", "balanced", "aggressive"]),
    })).mutation(async ({ ctx, input }) => {
      await db.upsertAutopilotConfig({ mode: input.mode, updatedBy: ctx.user.id });
      return { success: true };
    }),
    getDecisions: protectedProcedure.input(z.object({ limit: z.number().optional().default(20) })).query(async ({ input }) => {
      return await db.getRecentDecisions(input.limit);
    }),
    overrideDecision: protectedProcedure.input(z.object({
      decisionId: z.number(),
      reason: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const { autopilotDecisions } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new Error("Database not available");
      await dbInstance.update(autopilotDecisions).set({ status: "overridden", overriddenBy: ctx.user.id, overrideReason: input.reason }).where(eq(autopilotDecisions.id, input.decisionId));
      return { success: true };
    }),
    executeAction: protectedProcedure.input(z.object({
      type: z.string(),
      action: z.string(),
      reasoning: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an AI business autopilot. Evaluate the proposed action and determine confidence level (0-100) and expected outcome." },
          { role: "user", content: `Action type: ${input.type}\nAction: ${input.action}\nReasoning: ${input.reasoning || "N/A"}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "action_evaluation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                confidence: { type: "integer" },
                expectedOutcome: { type: "string" },
                risks: { type: "string" },
                proceed: { type: "boolean" },
              },
              required: ["confidence", "expectedOutcome", "risks", "proceed"],
              additionalProperties: false,
            },
          },
        },
      });
      const evaluation = JSON.parse(response.choices[0].message.content as string);
      const decision = await db.createAutopilotDecision({
        type: input.type, action: input.action, reasoning: input.reasoning,
        confidence: evaluation.confidence, status: evaluation.proceed ? "executed" : "pending",
        result: evaluation,
      });
      await db.logActivity({ userId: ctx.user.id, action: "autopilot_decision", entityType: "autopilot_decision", entityId: decision.id });
      return { decision, evaluation };
    }),
  }),

  // ─── Email Campaigns ─────────────────────────────────────────────────────
  emailCampaigns: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserEmailCampaigns(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
      type: z.enum(["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]),
      scheduledAt: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      return await db.createEmailCampaign({
        ...input, userId: ctx.user.id, status: input.scheduledAt ? "scheduled" : "draft",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      });
    }),
    generateContent: protectedProcedure.input(z.object({
      type: z.enum(["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]),
      topic: z.string(),
      targetAudience: z.string().optional(),
    })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert email marketing specialist for a blockchain authentication platform. Create compelling, professional email content that drives conversions." },
          { role: "user", content: `Create a ${input.type} email about: ${input.topic}. Target audience: ${input.targetAudience || "enterprise decision makers"}. Return JSON with subject and body fields.` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "email_content",
            strict: true,
            schema: {
              type: "object",
              properties: { subject: { type: "string" }, body: { type: "string" } },
              required: ["subject", "body"],
              additionalProperties: false,
            },
          },
        },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),
  }),

  // ─── Email Drafts (Approval Workflow) ─────────────────────────────────────
  emailDrafts: router({
    listPending: protectedProcedure.query(async () => {
      return await db.getPendingDrafts();
    }),
    create: protectedProcedure.input(z.object({
      prospectName: z.string().optional(),
      prospectEmail: z.string().email(),
      prospectCompany: z.string().optional(),
      industry: z.string().optional(),
      subject: z.string().min(1),
      body: z.string().min(1),
    })).mutation(async ({ input }) => {
      return await db.createEmailDraft({ ...input, status: "pending", generatedBy: "ai_manager" });
    }),
    approve: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.updateDraftStatus(input.id, "approved", ctx.user.id);
      return { success: true };
    }),
    reject: protectedProcedure.input(z.object({ id: z.number(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
      await db.updateDraftStatus(input.id, "rejected", ctx.user.id);
      return { success: true };
    }),
    bulkApprove: protectedProcedure.input(z.object({ ids: z.array(z.number()) })).mutation(async ({ ctx, input }) => {
      for (const id of input.ids) await db.updateDraftStatus(id, "approved", ctx.user.id);
      return { success: true, count: input.ids.length };
    }),
  }),

  // ─── Supply Chain ────────────────────────────────────────────────────────
  supplyChain: router({
    getEvents: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      return await db.getProductSupplyChain(input.productId);
    }),
    addEvent: protectedProcedure.input(z.object({
      productId: z.number(),
      eventType: z.enum(["manufactured", "shipped", "in_transit", "customs", "delivered", "verified", "recalled"]),
      location: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      temperature: z.string().optional(),
      humidity: z.string().optional(),
      handler: z.string().optional(),
      notes: z.string().optional(),
      iotDeviceId: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.createSupplyChainEvent(input);
      await db.logActivity({ userId: ctx.user.id, action: "supply_chain_event", entityType: "supply_chain", entityId: result.id });
      return result;
    }),
  }),

  // ─── Referrals ───────────────────────────────────────────────────────────
  referrals: router({
    myReferrals: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserReferrals(ctx.user.id);
    }),
    generateCode: protectedProcedure.mutation(async ({ ctx }) => {
      const code = `AC-${ctx.user.id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return await db.createReferral({ referrerId: ctx.user.id, referralCode: code, status: "pending" });
    }),
    validate: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
      const referral = await db.getReferralByCode(input.code);
      return { valid: !!referral, referral };
    }),
  }),

  // ─── Affiliates ──────────────────────────────────────────────────────────
  affiliates: router({
    myProfile: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAffiliateByUserId(ctx.user.id);
    }),
    join: protectedProcedure.mutation(async ({ ctx }) => {
      const code = `AFF-${ctx.user.id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return await db.createAffiliate({ userId: ctx.user.id, affiliateCode: code, status: "active", commissionRate: "10.00" });
    }),
    commissions: protectedProcedure.query(async ({ ctx }) => {
      const affiliate = await db.getAffiliateByUserId(ctx.user.id);
      if (!affiliate) return [];
      return await db.getAffiliateCommissions(affiliate.id);
    }),
  }),

  // ─── A/B Testing ─────────────────────────────────────────────────────────
  abTesting: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllAbTests();
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.string(),
      variants: z.any(),
    })).mutation(async ({ input }) => {
      return await db.createAbTest({ ...input, status: "draft" });
    }),
  }),

  // ─── White Label ─────────────────────────────────────────────────────────
  whiteLabel: router({
    list: adminProcedure.query(async () => {
      return await db.getWhiteLabelClients();
    }),
    create: adminProcedure.input(z.object({
      companyName: z.string().min(1),
      domain: z.string().optional(),
      logoUrl: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      apiCallLimit: z.number().optional().default(10000),
    })).mutation(async ({ ctx, input }) => {
      const crypto = await import("crypto");
      const apiKey = `wl_${crypto.randomBytes(24).toString("hex")}`;
      const apiSecret = crypto.randomBytes(32).toString("hex");
      return await db.createWhiteLabelClient({ ...input, userId: ctx.user.id, apiKey, apiSecret });
    }),
    validateApiKey: publicProcedure.input(z.object({ apiKey: z.string() })).query(async ({ input }) => {
      const client = await db.getWhiteLabelByApiKey(input.apiKey);
      return { valid: !!client && client.status === "active", client: client ? { companyName: client.companyName, domain: client.domain } : null };
    }),
  }),

  // ─── Leads & Marketing ───────────────────────────────────────────────────
  marketing: router({
    leads: adminProcedure.query(async () => {
      return await db.getAllLeads();
    }),
    createLead: publicProcedure.input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      company: z.string().optional(),
      source: z.string().optional(),
    })).mutation(async ({ input }) => {
      const result = await db.createLead(input);
      // Auto-sync to HubSpot
      try {
        await hubspot.syncLeadToHubSpot(input);
      } catch (e) { /* HubSpot sync is best-effort */ }
      return result;
    }),
    updateLeadScore: adminProcedure.input(z.object({ id: z.number(), score: z.number() })).mutation(async ({ input }) => {
      await db.updateLeadScore(input.id, input.score);
      return { success: true };
    }),
    updateLeadStatus: adminProcedure.input(z.object({ id: z.number(), status: z.string() })).mutation(async ({ input }) => {
      await db.updateLeadStatus(input.id, input.status);
      return { success: true };
    }),
    generateContent: protectedProcedure.input(z.object({
      type: z.enum(["email", "social", "blog"]),
      topic: z.string(),
      targetAudience: z.string().optional(),
    })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a marketing expert for a blockchain authentication platform. Create compelling, professional content." },
          { role: "user", content: `Create ${input.type} content about: ${input.topic}. Target: ${input.targetAudience || "enterprise decision makers"}` },
        ],
      });
      return { content: response.choices[0].message.content };
    }),
  }),

  // ─── Admin Dashboard ─────────────────────────────────────────────────────
  admin: router({
    metrics: adminProcedure.query(async () => {
      return await db.getAdminDashboardMetrics();
    }),
    users: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    revenue: adminProcedure.input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return await db.getRevenueAnalytics(
        input?.startDate ? new Date(input.startDate) : undefined,
        input?.endDate ? new Date(input.endDate) : undefined,
      );
    }),
    fraudAlerts: adminProcedure.query(async () => {
      return await db.getOpenFraudAlerts();
    }),
    healthScores: adminProcedure.query(async () => {
      return await db.getAllHealthScores();
    }),
    activity: adminProcedure.input(z.object({ limit: z.number().optional().default(50) })).query(async ({ input }) => {
      return await db.getRecentActivity(input.limit);
    }),
    subscriptions: adminProcedure.query(async () => {
      return await db.getSubscriptionAnalytics();
    }),
  }),

  // ─── Blockchain (Thirdweb) ──────────────────────────────────────────────
  blockchain: router({
    status: publicProcedure.query(async () => {
      return await thirdweb.checkThirdwebConnection();
    }),
    uploadToIPFS: protectedProcedure.input(z.object({
      name: z.string(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      attributes: z.array(z.object({ trait_type: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
    })).mutation(async ({ input }) => {
      const uri = await thirdweb.uploadMetadataToIPFS({
        name: input.name,
        description: input.description,
        image: input.imageUrl,
        attributes: input.attributes,
      });
      return { ipfsUri: uri };
    }),
    mintCertificateNFT: protectedProcedure.input(z.object({
      productId: z.number(),
      certificateNumber: z.string(),
      walletAddress: z.string(),
      contractAddress: z.string(),
      privateKey: z.string(),
      chainId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const product = await db.getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      const cert = await db.getCertificateByNumber(input.certificateNumber);
      if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      const metadata = thirdweb.buildAuthCertificateMetadata({
        productName: product.name,
        productBrand: product.brand || undefined,
        productSerial: product.serialNumber || undefined,
        confidenceScore: 95,
        verificationDate: new Date().toISOString(),
        certificateNumber: input.certificateNumber,
        imageUrl: product.imageUrl || undefined,
        authenticatorId: ctx.user.id,
      });
      const result = await thirdweb.mintAuthenticationNFT({
        contractAddress: input.contractAddress,
        recipientAddress: input.walletAddress,
        metadata,
        privateKey: input.privateKey,
        chainId: input.chainId,
      });
      await db.logActivity({ userId: ctx.user.id, action: "nft_minted", entityType: "certificate", entityId: cert.id });
      return { transactionHash: result.transactionHash, metadataUri: result.metadataUri, chain: result.chain };
    }),
    mintNFT: protectedProcedure.input(z.object({
      name: z.string(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      walletAddress: z.string(),
      contractAddress: z.string(),
      privateKey: z.string(),
      chainId: z.number().optional(),
      attributes: z.array(z.object({ trait_type: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await thirdweb.mintAuthenticationNFT({
        contractAddress: input.contractAddress,
        recipientAddress: input.walletAddress,
        metadata: {
          name: input.name,
          description: input.description,
          image: input.imageUrl,
          attributes: input.attributes,
        },
        privateKey: input.privateKey,
        chainId: input.chainId,
      });
      await db.logActivity({ userId: ctx.user.id, action: "nft_minted", entityType: "nft", entityId: 0 });
      return { transactionHash: result.transactionHash, metadataUri: result.metadataUri, chain: result.chain };
    }),
    getNFTBalance: publicProcedure.input(z.object({
      contractAddress: z.string(),
      walletAddress: z.string(),
      chainId: z.number().optional(),
    })).query(async ({ input }) => {
      const balance = await thirdweb.getNFTBalance(input.contractAddress, input.walletAddress, input.chainId);
      return { balance };
    }),
    getContractSupply: publicProcedure.input(z.object({
      contractAddress: z.string(),
      chainId: z.number().optional(),
    })).query(async ({ input }) => {
      const supply = await thirdweb.getContractTotalSupply(input.contractAddress, input.chainId);
      return { totalSupply: supply };
    }),
    getWalletNFTs: publicProcedure.input(z.object({
      contractAddress: z.string(),
      walletAddress: z.string(),
      chainId: z.number().optional(),
    })).query(async ({ input }) => {
      const nfts = await thirdweb.getWalletNFTs(input.contractAddress, input.walletAddress, input.chainId);
      return { nfts };
    }),
    deployedContract: publicProcedure.query(() => {
      const address = process.env.VITE_AUTHICHAIN_CONTRACT_ADDRESS || "";
      return {
        address,
        chainId: 80002,
        chain: "Polygon Amoy",
        explorer: address ? `https://amoy.polygonscan.com/address/${address}` : "",
        deployed: !!address,
      };
    }),
  }),

  // ─── Dashboard Metrics ───────────────────────────────────────────────────
  dashboard: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      return await db.getDashboardMetrics(ctx.user.id);
    }),
  }),

  // ─── Notifications ──────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.input(z.object({
      limit: z.number().optional().default(50),
    }).optional()).query(async ({ ctx, input }) => {
      return await db.getUserNotifications(ctx.user.id, input?.limit ?? 50);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadNotificationCount(ctx.user.id) };
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.deleteNotification(input.id, ctx.user.id);
      return { success: true };
    }),
    // Create notification (for testing / admin use)
    create: protectedProcedure.input(z.object({
      title: z.string().min(1),
      message: z.string().min(1),
      type: z.enum(["authentication", "certificate", "payment", "subscription", "nft", "referral", "system", "alert", "supply_chain", "autopilot"]),
      actionUrl: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      return await db.createNotification({ ...input, userId: ctx.user.id, isRead: 0 });
    }),
  }),

  // ─── HubSpot CRM ──────────────────────────────────────────────────────
  hubspot: router({
    status: protectedProcedure.query(async () => {
      if (!hubspot.isHubSpotConfigured()) return { connected: false, contacts: 0, companies: 0, deals: 0, error: "HUBSPOT_SERVICE_KEY is not configured. Add it in Settings → Secrets." };
      return await hubspot.getCRMStats();
    }),
    contacts: router({
      list: protectedProcedure.query(async () => {
        return await hubspot.listContacts();
      }),
      search: protectedProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
        return await hubspot.searchContacts(input.query);
      }),
      create: protectedProcedure.input(z.object({
        email: z.string().email(),
        firstname: z.string().optional(),
        lastname: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
      })).mutation(async ({ input }) => {
        return await hubspot.createContact(input);
      }),
    }),
    companies: router({
      list: protectedProcedure.query(async () => {
        return await hubspot.listCompanies();
      }),
      create: protectedProcedure.input(z.object({
        name: z.string(),
        domain: z.string().optional(),
        industry: z.string().optional(),
        description: z.string().optional(),
      })).mutation(async ({ input }) => {
        return await hubspot.createCompany(input);
      }),
    }),
    deals: router({
      list: protectedProcedure.query(async () => {
        return await hubspot.listDeals();
      }),
      create: protectedProcedure.input(z.object({
        dealname: z.string(),
        amount: z.string().optional(),
        pipeline: z.string().optional(),
        dealstage: z.string().optional(),
        closedate: z.string().optional(),
      })).mutation(async ({ input }) => {
        return await hubspot.createDeal(input);
      }),
    }),
  }),

  // ─── AI Chat ───────────────────────────────────────────────────────────
  ai: router({
    chat: protectedProcedure.input(z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() })),
    })).mutation(async ({ input }) => {
      const systemPrompt = "You are AuthiChain AI, an expert assistant for product authentication, blockchain verification, supply chain management, and anti-counterfeiting. Help users understand authentication results, manage their products, and optimize their supply chain security.";
      const messages = [{ role: "system" as const, content: systemPrompt }, ...input.messages];
      const response = await invokeLLM({ messages });
      return { content: response.choices?.[0]?.message?.content || "I apologize, I could not generate a response." };
    }),
  }),
});

export type AppRouter = typeof appRouter;
