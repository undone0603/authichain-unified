import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

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
      const { getUserProducts } = await import("./db");
      return await getUserProducts(ctx.user.id);
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getProductById } = await import("./db");
      return await getProductById(input.id);
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
      const { createProduct, logActivity } = await import("./db");
      const result = await createProduct({ ...input, userId: ctx.user.id });
      await logActivity({ userId: ctx.user.id, action: "product_created", entityType: "product", entityId: result.id });
      return result;
    }),
  }),

  // ─── AI Authentication ───────────────────────────────────────────────────
  authenticate: router({
    analyze: protectedProcedure.input(z.object({
      productId: z.number(),
      imageUrl: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const { invokeLLM } = await import("./_core/llm");
      const { createAuthentication, getProductById, getUserSubscription, updateSubscriptionUsage, recordUsage, createCertificate, logActivity } = await import("./db");
      const sub = await getUserSubscription(ctx.user.id);
      if (sub && (sub.usedQuota ?? 0) >= sub.monthlyQuota) throw new TRPCError({ code: "FORBIDDEN", message: "Monthly quota exceeded. Please upgrade your plan." });
      const product = await getProductById(input.productId);
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
      const authResult = await createAuthentication({
        productId: input.productId, userId: ctx.user.id, aiAnalysis: aiResult,
        confidenceScore: aiResult.confidence, result: aiResult.result, imageUrl: input.imageUrl,
      });
      // Auto-generate certificate for authentic products
      if (aiResult.result === "authentic" && aiResult.confidence >= 80) {
        const certNumber = `AC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await createCertificate({
          productId: input.productId, authenticationId: authResult.id, userId: ctx.user.id,
          certificateNumber: certNumber, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      }
      if (sub) await updateSubscriptionUsage(ctx.user.id, (sub.usedQuota || 0) + 1);
      await recordUsage({ userId: ctx.user.id, subscriptionId: sub?.id, type: "authentication", quantity: 1 });
      await logActivity({ userId: ctx.user.id, action: "product_authenticated", entityType: "authentication", entityId: authResult.id });
      return aiResult;
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      const { getUserAuthentications } = await import("./db");
      return await getUserAuthentications(ctx.user.id);
    }),
  }),

  // ─── Certificates ────────────────────────────────────────────────────────
  certificates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserCertificates } = await import("./db");
      return await getUserCertificates(ctx.user.id);
    }),
    verify: publicProcedure.input(z.object({ certificateNumber: z.string() })).query(async ({ input }) => {
      const { getCertificateByNumber, getProductById } = await import("./db");
      const cert = await getCertificateByNumber(input.certificateNumber);
      if (!cert) return { valid: false, message: "Certificate not found" };
      if (cert.status === "revoked") return { valid: false, message: "Certificate has been revoked" };
      if (cert.expiresAt && cert.expiresAt < new Date()) return { valid: false, message: "Certificate has expired" };
      const product = await getProductById(cert.productId);
      return { valid: true, certificate: cert, product };
    }),
    makePublic: protectedProcedure.input(z.object({ authenticationId: z.number() })).mutation(async ({ input }) => {
      const { updateAuthenticationSharing } = await import("./db");
      const crypto = await import("crypto");
      const shareToken = crypto.randomBytes(32).toString("hex");
      await updateAuthenticationSharing(input.authenticationId, true, shareToken);
      return { shareToken, shareUrl: `/certificate/${shareToken}` };
    }),
    getPublic: publicProcedure.input(z.object({ shareToken: z.string() })).query(async ({ input }) => {
      const { getAuthenticationByShareToken, getProductById, incrementShareCount } = await import("./db");
      const auth = await getAuthenticationByShareToken(input.shareToken);
      if (!auth || !auth.isPublic) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      const product = await getProductById(auth.productId);
      await incrementShareCount(auth.id);
      return { authentication: auth, product };
    }),
  }),

  // ─── QR Codes ────────────────────────────────────────────────────────────
  qrcode: router({
    generate: protectedProcedure.input(z.object({
      productId: z.number(),
      size: z.number().optional().default(300),
    })).mutation(async ({ ctx, input }) => {
      const QRCode = (await import("qrcode")).default;
      const { getProductById, createQrCode } = await import("./db");
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      const verifyUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || "https://authichain.com"}/verify/${product.id}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: input.size, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
      await createQrCode({ productId: input.productId, userId: ctx.user.id, qrData: verifyUrl, qrImageUrl: qrDataUrl });
      return { qrCodeDataUrl: qrDataUrl, verifyUrl };
    }),
    scan: publicProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      const { getProductById, getProductQrCodes, incrementScanCount } = await import("./db");
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      const qrCodes = await getProductQrCodes(input.productId);
      if (qrCodes.length > 0) await incrementScanCount(qrCodes[0].id);
      return { product, scanCount: (qrCodes[0]?.scanCount || 0) + 1 };
    }),
    listForProduct: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      const { getProductQrCodes } = await import("./db");
      return await getProductQrCodes(input.productId);
    }),
  }),

  // ─── NFT Marketplace ─────────────────────────────────────────────────────
  nft: router({
    list: publicProcedure.input(z.object({
      collectionId: z.number().optional(),
      status: z.string().optional(),
      limit: z.number().optional().default(50),
    })).query(async ({ input }) => {
      const { listNfts } = await import("./db");
      return await listNfts(input);
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const { getNftById } = await import("./db");
      return await getNftById(input.id);
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
      const { createNft, logActivity } = await import("./db");
      const result = await createNft({ ...input, ownerId: ctx.user.id, creatorId: ctx.user.id, status: "listed" });
      await logActivity({ userId: ctx.user.id, action: "nft_created", entityType: "nft", entityId: result.id });
      return result;
    }),
    collections: router({
      list: publicProcedure.query(async () => {
        const { listCollections } = await import("./db");
        return await listCollections();
      }),
      getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
        const { getCollectionBySlug } = await import("./db");
        return await getCollectionBySlug(input.slug);
      }),
      create: protectedProcedure.input(z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        category: z.string().optional(),
      })).mutation(async ({ ctx, input }) => {
        const { createCollection } = await import("./db");
        return await createCollection({ ...input, userId: ctx.user.id });
      }),
    }),
    auctions: router({
      list: publicProcedure.query(async () => {
        const { getActiveAuctions } = await import("./db");
        return await getActiveAuctions();
      }),
      getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
        const { getAuctionById, getAuctionBids } = await import("./db");
        const auction = await getAuctionById(input.id);
        const bids = await getAuctionBids(input.id);
        return { auction, bids };
      }),
      create: protectedProcedure.input(z.object({
        nftId: z.number(),
        startPrice: z.string(),
        reservePrice: z.string().optional(),
        endsAt: z.string(),
      })).mutation(async ({ ctx, input }) => {
        const { createAuction } = await import("./db");
        return await createAuction({ ...input, sellerId: ctx.user.id, endsAt: new Date(input.endsAt) });
      }),
      bid: protectedProcedure.input(z.object({
        auctionId: z.number(),
        amount: z.string(),
      })).mutation(async ({ ctx, input }) => {
        const { getAuctionById, placeBid } = await import("./db");
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: "NOT_FOUND" });
        if (auction.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Auction not active" });
        if (auction.currentBid && parseFloat(input.amount) <= parseFloat(auction.currentBid)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bid must be higher than current bid" });
        }
        await placeBid(input.auctionId, ctx.user.id, input.amount);
        return { success: true };
      }),
    }),
  }),

  // ─── Subscriptions ───────────────────────────────────────────────────────
  subscription: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSubscription } = await import("./db");
      return await getUserSubscription(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      plan: z.enum(["starter", "professional", "enterprise"]),
      billingCycle: z.enum(["monthly", "annual"]).optional().default("monthly"),
    })).mutation(async ({ ctx, input }) => {
      const { createSubscription, logActivity } = await import("./db");
      const quotas = { starter: 100, professional: 1000, enterprise: 10000 };
      const result = await createSubscription({
        userId: ctx.user.id, plan: input.plan, monthlyQuota: quotas[input.plan],
        usedQuota: 0, billingCycle: input.billingCycle, status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (input.billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000),
      });
      await logActivity({ userId: ctx.user.id, action: "subscription_created", entityType: "subscription", entityId: result.id });
      return result;
    }),
    invoices: protectedProcedure.query(async ({ ctx }) => {
      const { getUserInvoices } = await import("./db");
      return await getUserInvoices(ctx.user.id);
    }),
    usage: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSubscription } = await import("./db");
      const sub = await getUserSubscription(ctx.user.id);
      if (!sub) return { plan: null, used: 0, limit: 0, percentage: 0 };
      return { plan: sub.plan, used: sub.usedQuota || 0, limit: sub.monthlyQuota, percentage: Math.round(((sub.usedQuota || 0) / sub.monthlyQuota) * 100) };
    }),
  }),

  // ─── Payments ────────────────────────────────────────────────────────────
  payments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserPayments } = await import("./db");
      return await getUserPayments(ctx.user.id);
    }),
    createStripe: protectedProcedure.input(z.object({
      amount: z.string(),
      currency: z.string().optional().default("USD"),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { createPayment } = await import("./db");
      return await createPayment({ userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "stripe", status: "pending", metadata: input.metadata });
    }),
    createCrypto: protectedProcedure.input(z.object({
      amount: z.string(),
      currency: z.string().optional().default("BTC"),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { createPayment } = await import("./db");
      return await createPayment({ userId: ctx.user.id, amount: input.amount, currency: input.currency, method: "crypto", status: "pending", metadata: input.metadata });
    }),
    createEscrow: protectedProcedure.input(z.object({
      amount: z.string(),
      releaseDate: z.string(),
      metadata: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { createPayment } = await import("./db");
      return await createPayment({
        userId: ctx.user.id, amount: input.amount, method: "escrow", status: "escrowed",
        escrowReleaseDate: new Date(input.releaseDate), metadata: input.metadata,
      });
    }),
  }),

  // ─── Autopilot ───────────────────────────────────────────────────────────
  autopilot: router({
    getStatus: protectedProcedure.query(async () => {
      const { getAutopilotConfig, getRecentDecisions } = await import("./db");
      const config = await getAutopilotConfig();
      const decisions = await getRecentDecisions(5);
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
      const { getAutopilotConfig, upsertAutopilotConfig } = await import("./db");
      const config = await getAutopilotConfig();
      await upsertAutopilotConfig({
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
      const { upsertAutopilotConfig } = await import("./db");
      await upsertAutopilotConfig({ mode: input.mode, updatedBy: ctx.user.id });
      return { success: true };
    }),
    getDecisions: protectedProcedure.input(z.object({ limit: z.number().optional().default(20) })).query(async ({ input }) => {
      const { getRecentDecisions } = await import("./db");
      return await getRecentDecisions(input.limit);
    }),
    overrideDecision: protectedProcedure.input(z.object({
      decisionId: z.number(),
      reason: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { autopilotDecisions } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(autopilotDecisions).set({ status: "overridden", overriddenBy: ctx.user.id, overrideReason: input.reason }).where(eq(autopilotDecisions.id, input.decisionId));
      return { success: true };
    }),
    executeAction: protectedProcedure.input(z.object({
      type: z.string(),
      action: z.string(),
      reasoning: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { createAutopilotDecision, logActivity } = await import("./db");
      const { invokeLLM } = await import("./_core/llm");
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
      const decision = await createAutopilotDecision({
        type: input.type, action: input.action, reasoning: input.reasoning,
        confidence: evaluation.confidence, status: evaluation.proceed ? "executed" : "pending",
        result: evaluation,
      });
      await logActivity({ userId: ctx.user.id, action: "autopilot_decision", entityType: "autopilot_decision", entityId: decision.id });
      return { decision, evaluation };
    }),
  }),

  // ─── Email Campaigns ─────────────────────────────────────────────────────
  emailCampaigns: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserEmailCampaigns } = await import("./db");
      return await getUserEmailCampaigns(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
      type: z.enum(["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]),
      scheduledAt: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { createEmailCampaign } = await import("./db");
      return await createEmailCampaign({
        ...input, userId: ctx.user.id, status: input.scheduledAt ? "scheduled" : "draft",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      });
    }),
    generateContent: protectedProcedure.input(z.object({
      type: z.enum(["nurture", "onboarding", "trial_conversion", "announcement", "outreach"]),
      topic: z.string(),
      targetAudience: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");
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
      const { getPendingDrafts } = await import("./db");
      return await getPendingDrafts();
    }),
    create: protectedProcedure.input(z.object({
      prospectName: z.string().optional(),
      prospectEmail: z.string().email(),
      prospectCompany: z.string().optional(),
      industry: z.string().optional(),
      subject: z.string().min(1),
      body: z.string().min(1),
    })).mutation(async ({ input }) => {
      const { createEmailDraft } = await import("./db");
      return await createEmailDraft({ ...input, status: "pending", generatedBy: "ai_manager" });
    }),
    approve: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const { updateDraftStatus } = await import("./db");
      await updateDraftStatus(input.id, "approved", ctx.user.id);
      return { success: true };
    }),
    reject: protectedProcedure.input(z.object({ id: z.number(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const { updateDraftStatus } = await import("./db");
      await updateDraftStatus(input.id, "rejected", ctx.user.id);
      return { success: true };
    }),
    bulkApprove: protectedProcedure.input(z.object({ ids: z.array(z.number()) })).mutation(async ({ ctx, input }) => {
      const { updateDraftStatus } = await import("./db");
      for (const id of input.ids) await updateDraftStatus(id, "approved", ctx.user.id);
      return { success: true, count: input.ids.length };
    }),
  }),

  // ─── Supply Chain ────────────────────────────────────────────────────────
  supplyChain: router({
    getEvents: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      const { getProductSupplyChain } = await import("./db");
      return await getProductSupplyChain(input.productId);
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
      const { createSupplyChainEvent, logActivity } = await import("./db");
      const result = await createSupplyChainEvent(input);
      await logActivity({ userId: ctx.user.id, action: "supply_chain_event", entityType: "supply_chain", entityId: result.id });
      return result;
    }),
  }),

  // ─── Referrals ───────────────────────────────────────────────────────────
  referrals: router({
    myReferrals: protectedProcedure.query(async ({ ctx }) => {
      const { getUserReferrals } = await import("./db");
      return await getUserReferrals(ctx.user.id);
    }),
    generateCode: protectedProcedure.mutation(async ({ ctx }) => {
      const { createReferral } = await import("./db");
      const code = `AC-${ctx.user.id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return await createReferral({ referrerId: ctx.user.id, referralCode: code, status: "pending" });
    }),
    validate: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
      const { getReferralByCode } = await import("./db");
      const referral = await getReferralByCode(input.code);
      return { valid: !!referral, referral };
    }),
  }),

  // ─── Affiliates ──────────────────────────────────────────────────────────
  affiliates: router({
    myProfile: protectedProcedure.query(async ({ ctx }) => {
      const { getAffiliateByUserId } = await import("./db");
      return await getAffiliateByUserId(ctx.user.id);
    }),
    join: protectedProcedure.mutation(async ({ ctx }) => {
      const { createAffiliate } = await import("./db");
      const code = `AFF-${ctx.user.id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return await createAffiliate({ userId: ctx.user.id, affiliateCode: code, status: "active", commissionRate: "10.00" });
    }),
    commissions: protectedProcedure.query(async ({ ctx }) => {
      const { getAffiliateByUserId, getAffiliateCommissions } = await import("./db");
      const affiliate = await getAffiliateByUserId(ctx.user.id);
      if (!affiliate) return [];
      return await getAffiliateCommissions(affiliate.id);
    }),
  }),

  // ─── A/B Testing ─────────────────────────────────────────────────────────
  abTesting: router({
    list: protectedProcedure.query(async () => {
      const { getAllAbTests } = await import("./db");
      return await getAllAbTests();
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.string(),
      variants: z.any(),
    })).mutation(async ({ input }) => {
      const { createAbTest } = await import("./db");
      return await createAbTest({ ...input, status: "draft" });
    }),
  }),

  // ─── White Label ─────────────────────────────────────────────────────────
  whiteLabel: router({
    list: adminProcedure.query(async () => {
      const { getWhiteLabelClients } = await import("./db");
      return await getWhiteLabelClients();
    }),
    create: adminProcedure.input(z.object({
      companyName: z.string().min(1),
      domain: z.string().optional(),
      logoUrl: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      apiCallLimit: z.number().optional().default(10000),
    })).mutation(async ({ ctx, input }) => {
      const { createWhiteLabelClient } = await import("./db");
      const crypto = await import("crypto");
      const apiKey = `wl_${crypto.randomBytes(24).toString("hex")}`;
      const apiSecret = crypto.randomBytes(32).toString("hex");
      return await createWhiteLabelClient({ ...input, userId: ctx.user.id, apiKey, apiSecret });
    }),
    validateApiKey: publicProcedure.input(z.object({ apiKey: z.string() })).query(async ({ input }) => {
      const { getWhiteLabelByApiKey } = await import("./db");
      const client = await getWhiteLabelByApiKey(input.apiKey);
      return { valid: !!client && client.status === "active", client: client ? { companyName: client.companyName, domain: client.domain } : null };
    }),
  }),

  // ─── Leads & Marketing ───────────────────────────────────────────────────
  marketing: router({
    leads: adminProcedure.query(async () => {
      const { getAllLeads } = await import("./db");
      return await getAllLeads();
    }),
    createLead: publicProcedure.input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      company: z.string().optional(),
      source: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { createLead } = await import("./db");
      return await createLead(input);
    }),
    updateLeadScore: adminProcedure.input(z.object({ id: z.number(), score: z.number() })).mutation(async ({ input }) => {
      const { updateLeadScore } = await import("./db");
      await updateLeadScore(input.id, input.score);
      return { success: true };
    }),
    updateLeadStatus: adminProcedure.input(z.object({ id: z.number(), status: z.string() })).mutation(async ({ input }) => {
      const { updateLeadStatus } = await import("./db");
      await updateLeadStatus(input.id, input.status);
      return { success: true };
    }),
    generateContent: protectedProcedure.input(z.object({
      type: z.enum(["email", "social", "blog"]),
      topic: z.string(),
      targetAudience: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");
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
      const { getAdminDashboardMetrics } = await import("./db");
      return await getAdminDashboardMetrics();
    }),
    users: adminProcedure.query(async () => {
      const { getAllUsers } = await import("./db");
      return await getAllUsers();
    }),
    revenue: adminProcedure.input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const { getRevenueAnalytics } = await import("./db");
      return await getRevenueAnalytics(
        input?.startDate ? new Date(input.startDate) : undefined,
        input?.endDate ? new Date(input.endDate) : undefined,
      );
    }),
    fraudAlerts: adminProcedure.query(async () => {
      const { getOpenFraudAlerts } = await import("./db");
      return await getOpenFraudAlerts();
    }),
    healthScores: adminProcedure.query(async () => {
      const { getAllHealthScores } = await import("./db");
      return await getAllHealthScores();
    }),
    activity: adminProcedure.input(z.object({ limit: z.number().optional().default(50) })).query(async ({ input }) => {
      const { getRecentActivity } = await import("./db");
      return await getRecentActivity(input.limit);
    }),
    subscriptions: adminProcedure.query(async () => {
      const { getSubscriptionAnalytics } = await import("./db");
      return await getSubscriptionAnalytics();
    }),
  }),

  // ─── Dashboard Metrics ───────────────────────────────────────────────────
  dashboard: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      const { getDashboardMetrics } = await import("./db");
      return await getDashboardMetrics(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
