/**
 * Stripe retries 5xx and stops on 400. A paid DPP fulfillment failure must
 * stay retryable. Signature failures stay ordinary Errors and stay HTTP 400.
 */

const RETRYABLE_MESSAGE = /^(?:continuity_|DPP provision failed)/;

export function markRetryableFulfillment(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  const wrapped = new Error(message);
  wrapped.name = "RetryableFulfillmentError";
  return wrapped;
}

export function isRetryableFulfillment(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { name?: unknown; message?: unknown };
  if (record.name === "RetryableFulfillmentError") return true;
  return (
    typeof record.message === "string" && RETRYABLE_MESSAGE.test(record.message)
  );
}
