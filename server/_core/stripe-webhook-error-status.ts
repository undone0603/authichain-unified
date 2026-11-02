/** Map Stripe webhook failures without acknowledging incomplete payments. */
import { isRetryableFulfillment } from "../../src/lib/retryable-fulfillment";

export function stripeWebhookFailureStatus(error: unknown): 400 | 500 {
  if (
    (error as { name?: unknown } | null)?.name ===
      "StripeEventClaimUnavailableError" ||
    isRetryableFulfillment(error)
  ) {
    return 500;
  }
  return 400;
}
