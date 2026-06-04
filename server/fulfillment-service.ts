/**
 * AuthiChain Physical Fulfillment Bridge
 * Bridges Bitcoin L1 inscriptions to physical scannable security seals.
 * Integrates with high-security printing partners (e.g. Avery, Printful, or Custom).
 */
import * as db from "./db";

interface FulfillmentRequest {
  orderId: number;
  customerName: string;
  shippingAddress: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  artworkUrl: string; // The QRON image to be printed
  quantity: number;
}

/**
 * Dispatches a print-and-ship request to the fulfillment partner.
 */
export async function processPhysicalFulfillment(request: FulfillmentRequest) {
  console.log(`📦 Initializing physical fulfillment for Order #${request.orderId}...`);

  // Mock API call to printing partner
  try {
    // In a real scenario, this would be a POST to https://api.printing-partner.com/v1/orders
    const mockResponse = {
      success: true,
      jobId: `PRINT-${Date.now()}`,
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      trackingNumber: `1Z-${Math.random().toString(36).substring(2, 11).toUpperCase()}`
    };

    if (mockResponse.success) {
      // 1. Update the service order in DB
      await db.updateServiceOrderStatus(request.orderId, "delivered", {
        deliveryUrl: `https://tracking.carrier.com?q=${mockResponse.trackingNumber}`,
        deliveredAt: new Date()
      });

      // 2. Log Activity
      await db.logActivity({
        userId: 1, // System
        action: 'physical_fulfillment_dispatched',
        entityType: 'order',
        entityId: request.orderId,
        details: { 
          jobId: mockResponse.jobId,
          trackingNumber: mockResponse.trackingNumber,
          quantity: request.quantity
        }
      });

      // 3. Create System Notification for the customer
      // (Implementation assumes we have a userId linked to the order)
      const order = await db.getServiceOrderById(request.orderId);
      if (order?.userId) {
        const { createSystemNotification } = await import("./db");
        await createSystemNotification(
          order.userId,
          "Security Seals Dispatched 📦",
          `Your 1,000 scannable security seals for Order #${request.orderId} are on the way. Tracking: ${mockResponse.trackingNumber}`,
          "alert",
          "/services"
        );
      }

      return { success: true, trackingNumber: mockResponse.trackingNumber };
    }
    
    return { success: false, error: "Printing partner API failure" };

  } catch (error: any) {
    console.error("[Fulfillment Bridge] Process failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Webhook Trigger for Fulfillment
 * Called by Stripe webhook handler when a physical product is purchased.
 *
 * Gated behind FULFILLMENT_MOCK_ENABLED — the printing partner integration in
 * processPhysicalFulfillment is a stub that mints a fake tracking number and
 * marks the order delivered immediately, and the Stripe checkout doesn't
 * collect shipping addresses, so without this gate a real customer payment
 * would phantom-deliver to a hardcoded address. Flip the flag on only when
 * real address collection + a real partner API are wired.
 */
export async function triggerFulfillmentFromPayment(sessionId: string) {
  const order = await db.getServiceOrderBySessionId(sessionId);
  if (!order) return;

  const physicalServices = ["brand_story_pack", "automation_setup"];
  if (!order.serviceType || !physicalServices.includes(order.serviceType)) return;

  if (process.env.FULFILLMENT_MOCK_ENABLED !== "true") {
    console.log(
      `[Fulfillment] Skipped for order #${order.id} (${order.serviceType}) — ` +
      `FULFILLMENT_MOCK_ENABLED not set. Order remains in 'paid' status for human fulfillment.`,
    );
    return;
  }

  return await processPhysicalFulfillment({
    orderId: order.id,
    customerName: (order.details as any)?.customerName || "AuthiChain Customer",
    shippingAddress: {
      line1: "123 Main St",
      city: "Detroit",
      state: "MI",
      zip: "48226",
      country: "US",
    },
    artworkUrl: (order.details as any)?.deliveryUrl || "",
    quantity: 1000,
  });
}
