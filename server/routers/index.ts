import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from '../_core/cookies';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import * as db from '../db';
import { metrcRouter } from './metrc';
import { productsRouter } from './products';
import { schedulerRouter } from './scheduler';
import { servicesRouter } from '../services/router';
import { aiRouter } from '../ai/router';
import { autopilotRouter } from '../autopilot/router';
import { paymentsRouter } from '../payments/router';
import { subscriptionsRouter } from '../subscriptions/router';
import { blockchainRouter } from '../blockchain/router';
import { nftRouter } from '../nft/router';
import { authenticateRouter } from '../authenticate/router';
import { qronRouter } from '../qron/router';
import { dashboardRouter } from '../dashboard/router';
import { analyticsRouter } from '../analytics/router';
import { notificationsRouter } from '../notifications/router';
import { feedbackRouter } from '../feedback/router';
import { referralRouter } from '../referral/router';
import { affiliateRouter } from '../affiliate/router';
import { bonusesRouter } from '../bonuses/router';
import { heygenRouter } from '../heygen/router';
import { hubspotRouter } from '../hubspot/router';
import { personalizationRouter } from '../personalization/router';
import { abTestingRouter } from '../ab-testing/router';
import { characterRouter } from '../character/router';
import { macrohardRouter } from '../macrohard/router';
import { whiteLabelRouter } from '../white-label/router';
import { adminRouter } from '../admin/router';
import { marketplaceRouter } from '../marketplace/router';
import { marketingRouter } from '../marketing/router';
import { missionsRouter } from '../missions/router';
import { emailDraftsRouter } from '../email-drafts/router';
import { emailCampaignsRouter } from '../email-campaigns/router';
import { stakingRouter } from '../staking/router';
import { supplyChainRouter } from '../supply-chain/router';
import { govchainRouter } from '../govchain/router';
import { salesRouter } from '../sales/router';

// Auth + certificate routers were consolidated into the live server/routers.ts
// file; defined inline here so this (legacy duplicate) module still type-checks
// and exposes the same mounts.
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

const certificatesRouter = router({
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
});

/**
 * Root tRPC router — merges all 39 sub-routers.
 * Imported by server/_core/app.ts as appRouter.
 */
export const appRouter = router({
  metrc: metrcRouter,
  products: productsRouter,
  scheduler: schedulerRouter,
  services: servicesRouter,
  ai: aiRouter,
  auth: authRouter,
  autopilot: autopilotRouter,
  payments: paymentsRouter,
  subscription: subscriptionsRouter,
  blockchain: blockchainRouter,
  nft: nftRouter,
  authenticate: authenticateRouter,
  qron: qronRouter,
  dashboard: dashboardRouter,
  analytics: analyticsRouter,
  notifications: notificationsRouter,
  feedback: feedbackRouter,
  referral: referralRouter,
  affiliate: affiliateRouter,
  bonuses: bonusesRouter,
  heygen: heygenRouter,
  hubspot: hubspotRouter,
  personalization: personalizationRouter,
  abTesting: abTestingRouter,
  character: characterRouter,
  macrohard: macrohardRouter,
  whiteLabel: whiteLabelRouter,
  admin: adminRouter,
  marketplace: marketplaceRouter,
  marketing: marketingRouter,
  missions: missionsRouter,
  emailDrafts: emailDraftsRouter,
  emailCampaigns: emailCampaignsRouter,
  staking: stakingRouter,
  supplyChain: supplyChainRouter,
  certificates: certificatesRouter,
  govchain: govchainRouter,
  sales: salesRouter,
});




export type AppRouter = typeof appRouter;

