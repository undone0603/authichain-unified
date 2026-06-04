import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { syncMetrcTransfers, anchorPackageToTruthLayer } from "../metrc-service";
import { getDb } from "../db";
import { activityLog, whiteLabelClients } from "../../drizzle/schema";
import { eq, count, sql } from "drizzle-orm";

export const metrcRouter = router({
  /**
   * Sync active transfers from METRC for a vendor
   */
  sync: protectedProcedure
    .input(z.object({
      licenseNumber: z.string(),
      vendorKey: z.string().optional(),
      userKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Logic would typically pull keys from the white_label_clients table if not provided
      const result = await syncMetrcTransfers({
        licenseNumber: input.licenseNumber,
        vendorKey: input.vendorKey || process.env.METRC_VENDOR_KEY || "",
        userKey: input.userKey || process.env.METRC_USER_KEY || "",
      });
      return { success: true, itemsSynced: result.length };
    }),

  /**
   * Anchor a specific METRC package to the Bitcoin Truth Layer
   */
  anchor: protectedProcedure
    .input(z.object({
      packageTag: z.string(),
      manifestId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await anchorPackageToTruthLayer(input.packageTag, input.manifestId);
    }),

  /**
   * Get sync status for the state-wide truth layer
   */
  stats: publicProcedure.query(async () => {
    const d = await getDb();
    if (!d) {
      return { activeLicenses: 0, manifestsReconciled: 0, taxIntegrityScore: 0, network: "METRC Michigan (LARA)" };
    }
    const [licenseRow] = await d.select({ total: count() }).from(whiteLabelClients)
      .where(eq(whiteLabelClients.status, "active"));
    const [manifestRow] = await d.select({ total: count() }).from(activityLog)
      .where(eq(activityLog.action, "metrc_manifest_synced"));
    const [verifiedRow] = await d.select({ total: count() }).from(activityLog)
      .where(eq(activityLog.action, "metrc_manifest_synced"));
    const [failedRow] = await d.select({ total: count() }).from(activityLog)
      .where(eq(activityLog.action, "metrc_manifest_failed"));
    const verified = verifiedRow?.total ?? 0;
    const failed = failedRow?.total ?? 0;
    const total = verified + failed;
    const taxIntegrityScore = total > 0 ? Math.round((verified / total) * 1000) / 10 : 100;
    return {
      activeLicenses: licenseRow?.total ?? 0,
      manifestsReconciled: manifestRow?.total ?? 0,
      taxIntegrityScore,
      network: "METRC Michigan (LARA)"
    };
  }),
});
