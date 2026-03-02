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
});

export type AppRouter = typeof appRouter;
