/**
 * StrainChain METRC Auto-Anchoring Job
 * Automatically syncs state data and anchors it to the AuthiChain Truth Layer.
 */
import { syncMetrcTransfers, anchorPackageToTruthLayer } from "../metrc-service";
import { getWhiteLabelClients, logActivity, type Db } from "./db-helpers";

export async function runStrainChainSync(db: Db) {
  console.log("[StrainChain Job] Starting METRC sync...");

  // 1. Get all white-label clients
  const clients = await getWhiteLabelClients(db);
  let anchoredCount = 0;

  for (const client of clients) {
    // We assume METRC config is stored in the features JSON field
    const features = client.features as any;
    const metrcConfig = features?.metrc;

    if (!metrcConfig || !metrcConfig.licenseNumber) {
      continue;
    }

    console.log(`[StrainChain Job] Syncing for client: ${client.companyName} (${metrcConfig.licenseNumber})`);

    try {
      // server/metrc-service.ts's syncMetrcTransfers was migrated (Task 2b-5)
      // to take an explicit db instead of calling the singleton itself --
      // this job already threads its own db, so just pass it through.
      const transfers = await syncMetrcTransfers(db, {
        licenseNumber: metrcConfig.licenseNumber,
        vendorKey: metrcConfig.vendorKey || process.env.METRC_VENDOR_KEY || "",
        userKey: metrcConfig.userKey || process.env.METRC_USER_KEY || "",
      });

      for (const transfer of transfers) {
        // We only anchor 'Shipped' or 'Received' manifests that haven't been anchored yet
        // In a real scenario, we'd check against a 'synced_manifests' table
        if (transfer.status === 'Shipped' || transfer.status === 'Received') {

          // Generate a package tag for the purpose of the prototype
          // In production, this would be extracted from manifest line items
          const packageTag = `1A400031266B0${transfer.id}`;

          const anchorResult = await anchorPackageToTruthLayer(db, packageTag, String(transfer.id));

          if (anchorResult.success) {
            anchoredCount++;
            await logActivity(db, {
              userId: client.userId,
              action: 'strainchain_auto_anchor',
              entityType: 'manifest',
              entityId: transfer.id,
              details: {
                manifestNumber: transfer.manifestNumber,
                packageTag,
                txId: anchorResult.txId
              }
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`[StrainChain Job] Failed for client ${client.id}:`, err.message);
    }
  }

  return {
    itemsProcessed: anchoredCount,
    details: {
      status: "success",
      totalAnchored: anchoredCount,
      timestamp: new Date().toISOString()
    }
  };
}
