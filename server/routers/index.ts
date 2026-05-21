import { router } from '../_core/trpc';
import { metrcRouter } from './metrc';
import { productsRouter } from './products';
import { schedulerRouter } from './scheduler';
import { servicesRouter } from '../services/router';
import { aiRouter } from '../ai/router';
import { authRouter } from '../auth/router';
import { autopilotRouter } from '../autopilot/router';
import { paymentsRouter } from '../payments/router';
import { subscriptionsRouter } from '../subscriptions/router';
import { blockchainRouter } from '../blockchain/router';
import { nftRouter } from '../nft/router';
import { authenticateRouter } from '../authenticate/router';
import { qrcodeRouter } from '../qrcode/router';
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
import { certificatesRouter } from '../certificates/router';
import { govchainRouter } from '../govchain/router';
import { salesRouter } from '../sales/router';

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
  subscriptions: subscriptionsRouter,
  blockchain: blockchainRouter,
  nft: nftRouter,
  authenticate: authenticateRouter,
  qrcode: qrcodeRouter,
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
