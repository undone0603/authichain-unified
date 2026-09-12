/**
 * Subscription Orchestrator
 *
 * Implements an idempotent state machine for merchant onboarding:
 * 1. PENDING (Provisioning started)
 * 2. PROVISIONED (Vendor account created)
 * 3. PAYMENT_METHOD_ATTACHED (Stripe Balance attached)
 * 4. SUBSCRIBED (Platform subscription active)
 */
import * as db from "../db";
import { 
  provisionVendorAccount, 
  attachBalancePaymentMethod, 
  subscribeVendorToPlatform,
  generateOnboardingLink
} from "./stripe-connect-service";

export type ProvisioningState = "PENDING" | "PROVISIONED" | "PAYMENT_METHOD_ATTACHED" | "SUBSCRIBED" | "FAILED";

export async function automateVendorSubscription(
  userId: number,
  vendorAccountId: string,
  email: string,
  displayName: string
) {
  // 1. Get/Create Client State
  let client = await db.getClientByUserId(userId);
  if (!client) {
    // Initial state: Provisioning logic happens in webhook before calling this.
    // Ensure state exists.
    client = await db.createClientState(userId, "PROVISIONED");
  }

  try {
    // 2. State-driven execution
    if (client.provisioningState === "PROVISIONED") {
      const pmId = await attachBalancePaymentMethod(vendorAccountId);
      await db.updateVendorState(userId, "PAYMENT_METHOD_ATTACHED", { pmId });
      client.provisioningState = "PAYMENT_METHOD_ATTACHED";
      client.metadata = { pmId };
    }

    if (client.provisioningState === "PAYMENT_METHOD_ATTACHED") {
      // Resolve plan (placeholder: logic to map to priceId)
      const priceId = process.env.STRIPE_PRICE_AUTHI_STARTER!; 
      await subscribeVendorToPlatform(vendorAccountId, client.metadata.pmId, priceId);
      await db.updateVendorState(userId, "SUBSCRIBED");
      
      // Post-subscription activation (generate link)
      const onboardingLink = await generateOnboardingLink(vendorAccountId);
      // Send email logic...
    }
    
    return { success: true };
  } catch (err) {
    console.error(`[SubscriptionOrchestrator] Failed for user ${userId}:`, err);
    await db.updateVendorState(userId, "FAILED", { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
