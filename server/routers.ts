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
import { servicesRouter } from "./routers/services";
import { schedulerRouter } from "./routers/scheduler";
import { missionsRouter, tasksRouter } from "./missions/router";
import { characterRouter } from "./character/router";
import { stakingRouter } from "./staking/router";
import { govchainRouter } from "./govchain/router";
import { salesRouter } from "./sales/router";
import { autonomousRouter } from "./autonomous/router";
import { payoutsRouter } from "./payouts/router";
import { qronRouter } from "./qron/router";
import { founderRouter } from "./founder/router";
import { metrcRouter } from "./routers/metrc";
import { analyticsRouter } from "./analytics/router";
import { feedbackRouter } from "./feedback/router";
import { personalizationRouter } from "./personalization/router";
import { devTeamRouter } from "./agents/dev-team/router";
import { pipelineRouter } from "./routers/pipeline";
import { outcomesRouter } from "./routers/outcomes";

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
  services: servicesRouter,
  scheduler: schedulerRouter,
  missions: missionsRouter,
  tasks: tasksRouter,
  character: characterRouter,
  staking: stakingRouter,
  govchain: govchainRouter,
  sales: salesRouter,
  autonomous: autonomousRouter,
  payouts: payoutsRouter,
  qron: qronRouter,
  founder: founderRouter,
  // Restored: these routers were only mounted in the dead server/routers/index.ts
  // duplicate, leaving them unreachable from the live API.
  metrc: metrcRouter,
  analytics: analyticsRouter,
  feedback: feedbackRouter,
  personalization: personalizationRouter,
  // Restored: orphaned routers that the BuildLoop / Missions pages reach for
  // via `(trpc as any)` because they were never mounted on the live API.
  devTeam: devTeamRouter,
  pipeline: pipelineRouter,
  outcomes: outcomesRouter,
});

export type AppRouter = typeof appRouter;
