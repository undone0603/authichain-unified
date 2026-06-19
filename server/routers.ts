import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// Import routers from subfolders
import { referralRouter } from "./referral/router";
import { affiliateRouter } from "./affiliate/router";
import { bonusesRouter } from "./bonuses/router";
import { marketplaceRouter } from "./marketplace/router";
import { emailDraftsRouter } from "./email-drafts/router";
import { subscriptionsRouter } from "./subscriptions/router";
import { missionsRouter, tasksRouter } from "./missions/router";
import { adminRouter } from "./admin/router";
import { notificationsRouter } from "./notifications/router";
import { aiRouter } from "./ai/router";
import { autopilotRouter } from "./autopilot/router";
import { blockchainRouter } from "./blockchain/router";
import { marketingRouter } from "./marketing/router";
import { nftRouter } from "./nft/router";
import { personalizationRouter } from "./personalization/router";
import { stakingRouter } from "./staking/router";
import { supplyChainRouter } from "./supply-chain/router";
import { whiteLabelRouter } from "./white-label/router";
import { stripeConnectRouter } from "./stripe-connect-router";
import { hubspotRouter } from "./hubspot/router";
import { emailCampaignsRouter } from "./email-campaigns/router";
import { dashboardRouter } from "./dashboard/router";
import { characterRouter } from "./character/router";
import { analyticsRouter } from "./analytics/router";
import { feedbackRouter } from "./feedback/router";
import { paymentsRouter } from "./payments/router";
import { heygenRouter } from "./heygen/router";
import { agentXpRouter } from "./agent-xp/router";
import { abTestingRouter } from "./ab-testing/router";
import { macrohardRouter } from "./macrohard/router";
import { govchainRouter } from "./govchain/router";
import { salesRouter } from "./sales/router";
import { autonomousRouter } from "./autonomous/router";
import { payoutsRouter } from "./payouts/router";
import { qronRouter } from "./qron/router";
import { founderRouter } from "./founder/router";
import { devTeamRouter } from "./agents/dev-team/router";

// Import routers from routers/ folder
import { metrcRouter } from "./routers/metrc";
import { productsRouter as industrialProductsRouter } from "./routers/products";
import { schedulerRouter } from "./routers/scheduler";
import { servicesRouter } from "./services/router";
import { pipelineRouter } from "./routers/pipeline";
import { outcomesRouter } from "./routers/outcomes";

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

  // ─── Products (Merged Industrial + Standard) ──────────────────────────
  products: router({
    // Standard Methods
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserProducts } = await import("./db");
      return await getUserProducts(ctx.user.id);
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const { getProductById } = await import("./db");
      const product = await getProductById(input.id);
      if (!product || product.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      return product;
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      brand: z.string().optional(),
      manufacturer: z.string().optional(),
      modelNumber: z.string().optional(),
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
    // Industrial Pipeline Methods
    generateAssets: industrialProductsRouter.generateAssets,
    retryFailedTasks: industrialProductsRouter.retryFailedTasks,
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
        const certNumber = `AC-${Date.now()}-${require('crypto').randomBytes(4).toString('hex').toUpperCase()().toString(36).substring(2, 8).toUpperCase()}`;
        await createCertificate({
          productId: input.productId, authenticationId: authResult.id, userId: ctx.user.id,
          certificateNumber: certNumber, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      }
      if (sub) await updateSubscriptionUsage(ctx.user.id, (sub.usedQuota || 0) + 1);
      await recordUsage({ userId: ctx.user.id, subscriptionId: sub?.id, type: "authentication", quantity: 1 });
      await logActivity({ userId: ctx.user.id, action: "product_authenticated", entityType: "authentication", entityId: authResult.id });
      // Award XP to user's agent for verification
      try {
        const { rewardAgentForVerification } = await import("./character-service");
        await rewardAgentForVerification(ctx.user.id, aiResult.result === "authentic");
      } catch (agentErr) { console.warn("[Agent XP] No agent or error:", agentErr); }

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
  }),

  // ─── QR Codes ────────────────────────────────────────────────────────────
  qrcode: router({
    generate: protectedProcedure.input(z.object({
      productId: z.number(),
      size: z.number().optional().default(300),
      batchId: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const QRCode = (await import("qrcode")).default;
      const { getProductById, createQrCode } = await import("./db");
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      const verifyUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || "https://authichain.com"}/verify/${product.id}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: input.size, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
      await createQrCode({ productId: input.productId, userId: ctx.user.id, qrData: verifyUrl, qrImageUrl: qrDataUrl, metadata: input.batchId ? { batchId: input.batchId } : undefined });
      return { qrCodeDataUrl: qrDataUrl, verifyUrl };
    }),
    listForProduct: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ ctx, input }) => {
      const { getProductById, getProductQrCodes } = await import("./db");
      const product = await getProductById(input.productId);
      if (!product || product.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      return await getProductQrCodes(input.productId);
    }),
    scanHistory: protectedProcedure.input(z.object({ productId: z.number() })).query(async ({ ctx, input }) => {
      const { getProductById, getRecentScanEvents } = await import("./db");
      const product = await getProductById(input.productId);
      if (!product || product.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      return await getRecentScanEvents(input.productId);
    }),
    scan: publicProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      const { getProductById, getProductQrCodes, incrementScanCount } = await import("./db");
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      const qrCodes = await getProductQrCodes(input.productId);
      if (qrCodes.length > 0) await incrementScanCount(qrCodes[0].id);
      return { product, scanCount: (qrCodes[0]?.scanCount || 0) + 1 };
    }),
  }),

  // ─── Direct Mapped Routers ───────────────────────────────────────────────
  admin: router({
    ...adminRouter._def.procedures,
    createSovereignDeal: adminProcedure.input(z.object({
      manufacturerName: z.string(),
      dealType: z.enum(["MADE_IN_USA", "GOV_CONTRACT", "INFRASTRUCTURE"]),
      value: z.number(),
      description: z.string(),
      productId: z.number().optional(),
    })).mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const { createProduct, logActivity } = await import("./db");
      const deal = await createProduct({
        name: `${input.manufacturerName} - ${input.dealType}`,
        brand: input.manufacturerName,
        category: "SOVEREIGN_DEAL",
        description: input.description,
        userId: ctx.user.id,
        metadata: { ...input, sealedAt: new Date().toISOString() }
      });
      await logActivity({ userId: ctx.user.id, action: "sovereign_deal_created", entityType: "deal", entityId: deal.id });
      return { success: true, dealId: deal.id, status: "SEALED" };
    }),
  }),
  notifications: notificationsRouter,
  ai: aiRouter,
  autopilot: autopilotRouter,
  blockchain: blockchainRouter,
  marketing: marketingRouter,
  nft: nftRouter,
  personalization: personalizationRouter,
  staking: stakingRouter,
  supplyChain: supplyChainRouter,
  whiteLabel: whiteLabelRouter,
  scheduler: schedulerRouter,
  metrc: metrcRouter,
  referral: referralRouter,
  affiliate: affiliateRouter,
  bonuses: bonusesRouter,
  marketplace: marketplaceRouter,
  missions: missionsRouter,
  tasks: tasksRouter,
  stripeConnect: stripeConnectRouter,
  subscriptions: subscriptionsRouter,
  subscription: subscriptionsRouter, // Alias
  emailDrafts: emailDraftsRouter,
  emailCampaigns: emailCampaignsRouter,
  hubspot: hubspotRouter,
  dashboard: dashboardRouter,
  character: characterRouter,
  govchain: govchainRouter,
  sales: salesRouter,
  services: servicesRouter,
  devTeam: devTeamRouter,
  analytics: analyticsRouter,
  feedback: feedbackRouter,
  payments: paymentsRouter,
  heygen: heygenRouter,
  agentXp: agentXpRouter,
  abTesting: abTestingRouter,
  macrohard: macrohardRouter,
  autonomous: autonomousRouter,
  payouts: payoutsRouter,
  qron: qronRouter,
  founder: founderRouter,
  // Orphaned routers that the BuildLoop / Missions pages reach for
  // via `(trpc as any)` because they were never mounted on the live API.
  pipeline: pipelineRouter,
  outcomes: outcomesRouter,
});

export type AppRouter = typeof appRouter;
