/**
 * Resend `Idempotency-Key` for an email triggered by a Stripe webhook
 * (PM-330 item 3).
 *
 * Stripe retries a delivery (and the Dashboard can resend it) with the same
 * event id. Keying the send on event id + template means Resend answers a
 * repeat within its 24h window with the first result instead of mailing the
 * customer again. Different templates for one event still send once each.
 *
 * Resend caps keys at 256 characters. Event ids and template names are short;
 * the slice is a guard, not an expected path.
 */
export function stripeEmailIdempotencyKey(
  eventId: string,
  template: string
): string {
  return `stripe-${eventId}-${template}`.slice(0, 256);
}
