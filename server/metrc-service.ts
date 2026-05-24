/**
 * StrainChain METRC Bridge Service
 * Facilitates real-time synchronization between state seed-to-sale data 
 * and the AuthiChain Bitcoin L1 Truth Layer.
 */
import { ENV } from "./_core/env";
import * as db from "./db";

interface MetrcAuth {
  vendorKey: string;
  userKey: string;
  licenseNumber: string;
  userId: number;
}

/**
 * Core METRC Transfer Manifest Data
 */
export interface MetrcTransfer {
  id: number;
  manifestNumber: string;
  shipperLicenseNumber: string;
  recipientLicenseNumber: string;
  wholesalePrice: number;
  deliveryArrivalEstimatedDateTime: string;
  status: 'Pending' | 'Shipped' | 'Received' | 'Voided';
}

/**
 * Fetches active wholesale transfers for a given license.
 * Cascading fallback: MI Primary -> MI Backup
 */
export async function syncMetrcTransfers(auth: MetrcAuth) {
  const { vendorKey, userKey, licenseNumber } = auth;
  const authHeader = `Basic ${Buffer.from(`${vendorKey}:${userKey}`).toString('base64')}`;

  const endpoints = [
    "https://api-mi.metrc.com",
    "https://api-mi-backup.metrc.com" // Simulated fallback
  ];

  let lastError: Error | null = null;

  for (const baseUrl of endpoints) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[METRC] Sync attempt ${attempt} via ${baseUrl}...`);
        const response = await fetch(`${baseUrl}/transfers/v1/incoming?licenseNumber=${licenseNumber}`, {
          headers: { 'Authorization': authHeader },
          signal: AbortSignal.timeout(20000)
        });

        if (response.ok) {
          const transfers: MetrcTransfer[] = await response.json();
          // Process transfers...
          for (const transfer of transfers) {
            if (transfer.status === 'Shipped' || transfer.status === 'Received') {
              await db.logActivity({
                userId: auth.userId, action: 'metrc_manifest_synced',
                entityType: 'manifest', entityId: transfer.id,
                details: { 
                  manifestNumber: transfer.manifestNumber,
                  value: transfer.wholesalePrice,
                  taxDue: transfer.wholesalePrice * 0.24 
                }
              });
            }
          }
          return transfers;
        }
        
        console.warn(`[METRC] ${baseUrl} failed with ${response.status}`);
        await new Promise(r => setTimeout(r, attempt * 1000));

      } catch (err: any) {
        console.warn(`[METRC] ${baseUrl} exception: ${err.message}`);
        lastError = err;
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  console.error("[METRC] All state API endpoints failed.");
  return [];
}

/**
 * Anchors a METRC package to a Bitcoin Inscription via the qron-ordinal-worker.
 * Triggers social proof broadcast on success.
 */
export async function anchorPackageToTruthLayer(packageTag: string, manifestId: string) {
  const inscriptionUrl = process.env.ORDINAL_WORKER_URL || "https://qron.space/api/ordinals/inscribe";

  const res = await fetch(inscriptionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.INTERNAL_API_SECRET
        ? { "x-internal-secret": process.env.INTERNAL_API_SECRET }
        : {}),
    },
    body: JSON.stringify({ packageTag, manifestId }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[METRC] Inscription worker rejected ${packageTag}: ${res.status} ${errText.slice(0, 200)}`);
    throw new Error(`Inscription failed: ${res.status}`);
  }

  const data = await res.json().catch(() => ({} as any));
  const txId: string = data.txId ?? data.inscriptionId ?? "";

  try {
    const { broadcastSocialProof } = await import("./social-service");
    await broadcastSocialProof({
      type: "inscription",
      brandName: "Michigan Processor",
      productName: `Package ${packageTag}`,
      imageUrl: "https://authichain.com/images/bitcoin-proof-badge.png",
      verifyUrl: `https://govchain.us/verify/${packageTag}`,
    });
  } catch (socialErr) {
    console.warn("[Social Bridge] Trigger failed during anchoring:", socialErr);
  }

  return {
    success: true,
    txId,
    truthLayerUrl: `https://govchain.us/verify/${packageTag}`,
  };
}
