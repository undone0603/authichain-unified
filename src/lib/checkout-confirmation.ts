/**
 * A checkout session reference is not proof of payment. This helper only
 * constructs a URL to the existing, server-validated activation flow; it
 * intentionally never returns a paid/fulfilled state.
 */
const STRIPE_CHECKOUT_SESSION_ID = /^cs_(?:live|test)_[A-Za-z0-9]{1,200}$/;
const VISIT_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function checkoutActivationHref(
  sessionId: string,
  visitId = ""
): string | null {
  if (!STRIPE_CHECKOUT_SESSION_ID.test(sessionId)) return null;
  const query = new URLSearchParams({ session_id: sessionId });
  if (VISIT_ID.test(visitId)) query.set("visit_id", visitId);
  return `/dpp/activate?${query.toString()}`;
}
