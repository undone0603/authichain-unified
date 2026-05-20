import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { calculateHarmony } from "../sales/harmony-service";

export const dashboardRouter = router({
  metrics: protectedProcedure.query(async ({ ctx }) => {
    return await db.getDashboardMetrics(ctx.user.id);
  }),
  harmony: publicProcedure.query(async () => {
    return await calculateHarmony();
  }),
  pulse: publicProcedure.query(async () => {
    const activity = await db.getRecentActivity(10);
    return activity.map(a => {
      let text = "Network Activity Detected";
      if (a.action === "strainchain_auto_anchor") {
        text = `Bitcoin L1 Anchor: Package #${(a.details as any)?.packageTag?.substring(0, 8)}...`;
      } else if (a.action === "roi_calculated") {
        text = `MedTech ROI Analysis: $${((a.details as any)?.savings || 250000).toLocaleString()} Savings...`;
      } else if (a.action === "govchain_passport_issued") {
        text = `Sovereign Passport Issued: #${(a.details as any)?.documentId}...`;
      } else if (a.action === "nft_minted") {
        text = `Authenticity Token Minted: ${(a.details as any)?.name}...`;
      } else if (a.action === "product_authenticated") {
        text = `High-Fidelity Scan Verified: Confidence ${(a.details as any)?.confidence}%...`;
      } else if (a.action === "qron_staked") {
        text = `Validator Stake Active: ${(a.details as any)?.amount} $QRON Locked...`;
      }
      return { id: a.id, text, time: a.createdAt };
    });
  }),
});
