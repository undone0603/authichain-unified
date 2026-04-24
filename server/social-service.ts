/**
 * AuthiChain Social Proof Bridge
 * Automatically broadcasts high-value verification and inscription events.
 * Connects to Make.com / Buffer via webhook to support multi-platform posting (X, LinkedIn, IG).
 */
import { ENV } from "./_core/env";
import * as db from "./db";

interface SocialBroadcastRequest {
  type: 'inscription' | 'purchase' | 'verification';
  brandName: string;
  productName: string;
  imageUrl: string;
  verifyUrl: string;
}

/**
 * Dispatches a social media broadcast.
 */
export async function broadcastSocialProof(data: SocialBroadcastRequest) {
  const { makeWebhookUrl } = ENV;
  
  if (!makeWebhookUrl) {
    console.warn("[Social Bridge] Skipping broadcast: MAKE_WEBHOOK_URL not configured");
    return;
  }

  console.log(`📣 Broadcasting social proof for ${data.brandName}...`);

  const message = data.type === 'inscription' 
    ? `New Inscription: ${data.brandName}'s "${data.productName}" is now live on the Bitcoin L1 Truth Layer. 🛡️`
    : `${data.brandName} just secured their supply chain with AuthiChain. Verification live. 📦`;

  try {
    const response = await fetch(makeWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        formattedMessage: message,
        platform: "AuthiChain Unified",
        timestamp: new Date().toISOString()
      })
    });

    if (response.ok) {
      await db.logActivity({
        userId: 1, // System
        action: 'social_proof_broadcasted',
        entityType: 'broadcast',
        details: { type: data.type, brand: data.brandName }
      });
      return { success: true };
    }

    throw new Error(`Webhook responded with ${response.status}`);

  } catch (error: any) {
    console.error("[Social Bridge] Broadcast failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Helper: Broadcast a Michigan CRA "Audit Win"
 */
export async function broadcastRegulatoryWin(agency: string, manifestId: string) {
    return await broadcastSocialProof({
      type: 'verification',
      brandName: agency,
      productName: `Manifest ${manifestId}`,
      imageUrl: "https://authichain.com/images/regulatory-badge.png",
      verifyUrl: `https://govchain.us/verify/${manifestId}`
    });
}
