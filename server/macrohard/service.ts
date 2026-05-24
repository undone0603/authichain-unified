const BASE_URL = process.env.MACROHARD_API_URL ?? "";
const API_KEY = process.env.MACROHARD_API_KEY ?? "";

export type MacrohardEventType = "product_authenticated" | "certificate_issued" | "nft_minted";

/**
 * Triggers a real-time event webhook to MACROHARD.
 * Fails silently to prevent blocking core application logic.
 */
export async function triggerMacrohardEvent(type: MacrohardEventType, data: any) {
  if (!BASE_URL || !API_KEY) {
    return { success: false, reason: "MACROHARD not configured" };
  }

  try {
    const res = await fetch(`${BASE_URL}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Macrohard-Key": API_KEY,
      },
      body: JSON.stringify({ type, data, timestamp: new Date().toISOString() }),
    });

    if (!res.ok) {
      console.warn(`[Macrohard Webhook] Failed with status ${res.status}`);
      return { success: false, status: res.status };
    }

    return { success: true };
  } catch (error) {
    console.error("[Macrohard Webhook] Error:", error);
    return { success: false, error };
  }
}
