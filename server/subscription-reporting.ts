/**
 * A legacy subscriptions row is an internal access record, not a payment
 * receipt. Even a provider ID is insufficient without live provider and
 * paid-invoice verification. This digest intentionally does neither.
 */
export function formatUnverifiedSubscriptionMetrics(input: {
  paymentRecordCount: number;
  internalActiveCount: number;
}): string {
  return [
    `Payment records created (not verified paid): ${input.paymentRecordCount}`,
    `Internal active subscription rows (not verified paid): ${input.internalActiveCount}`,
    "Verified paid subscriptions / renewals: not measured by this digest",
  ].join("\n");
}
