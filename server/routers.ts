import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./auth/router";
import { productsRouter } from "./products/router";
import { authenticateRouter } from "./authenticate/router";
import { certificatesRouter } from "./certificates/router";
import { qrcodeRouter } from "./qrcode/router";
import { nftRouter } from "./nft/router";
import { subscriptionsRouter } from "./subscriptions/router";
import { paymentsRouter } from "./payments/router";
import { autopilotRouter } from "./autopilot/router";
import { emailCampaignsRouter } from "./email-campaigns/router";
import { emailDraftsRouter } from "./email-drafts/router";
import { supplyChainRouter } from "./supply-chain/router";
import { notificationsRouter } from "./notifications/router";
import { adminRouter } from "./admin/router";
import { marketingRouter } from "./marketing/router";
import { abTestingRouter } from "./ab-testing/router";
import { whiteLabelRouter } from "./white-label/router";
import { dashboardRouter } from "./dashboard/router";
import { blockchainRouter } from "./blockchain/router";
import { hubspotRouter } from "./hubspot/router";
import { aiRouter } from "./ai/router";
import { referralRouter } from "./referral/router";
import { affiliateRouter } from "./affiliate/router";
import { bonusesRouter } from "./bonuses/router";
import { marketplaceRouter } from "./marketplace/router";
import { heygenRouter } from "./heygen/router";
import { macrohardRouter } from "./macrohard/router";
import { schedulerRouter } from "./routers/scheduler";
import { characterRouter } from "./character/router";
import { missionsRouter, tasksRouter } from "./missions/router";
import { govchainRouter } from "./govchain/router";
import { salesRouter } from "./sales/router";
import { servicesRouter } from "./services/router";
import { stakingRouter } from "./staking/router";
import { devTeamRouter } from "./agents/dev-team/router";
import { analyticsRouter } from "./analytics/router";
import { feedbackRouter } from "./feedback/router";
import { personalizationRouter } from "./personalization/router";
import { stripeConnectRouter } from "./stripe-connect-router";
import { metrcRouter } from "./routers/metrc";
import { qronRouter } from "./qron/router";
import { executiveRouter } from "./executive/router";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  products: productsRouter,
  authenticate: authenticateRouter,
  certificates: certificatesRouter,
  qrcode: qrcodeRouter,
  nft: nftRouter,
  subscription: subscriptionsRouter,
  payments: paymentsRouter,
  autopilot: autopilotRouter,
  emailCampaigns: emailCampaignsRouter,
  emailDrafts: emailDraftsRouter,
  supplyChain: supplyChainRouter,
  notifications: notificationsRouter,
  admin: adminRouter,
  marketing: marketingRouter,
  abTesting: abTestingRouter,
  whiteLabel: whiteLabelRouter,
  dashboard: dashboardRouter,
  blockchain: blockchainRouter,
  hubspot: hubspotRouter,
  ai: aiRouter,
  referral: referralRouter,
  affiliate: affiliateRouter,
  bonuses: bonusesRouter,
  marketplace: marketplaceRouter,
  heygen: heygenRouter,
  macrohard: macrohardRouter,
  scheduler: schedulerRouter,
  character: characterRouter,
  missions: missionsRouter,
  tasks: tasksRouter,
  govchain: govchainRouter,
  sales: salesRouter,
  services: servicesRouter,
  staking: stakingRouter,
  devTeam: devTeamRouter,
  analytics: analyticsRouter,
  feedback: feedbackRouter,
  personalization: personalizationRouter,
  stripeConnect: stripeConnectRouter,
  metrc: metrcRouter,
  qron: qronRouter,
  executive: executiveRouter,
});

export type AppRouter = typeof appRouter;
