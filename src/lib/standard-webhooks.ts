import { createHmac, timingSafeEqual } from "node:crypto";

/** Standard Webhooks default: reject events signed more than 5 minutes off. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/**
 * Same scheme as worker-app/resend-inbound.ts. Signed content is
 * `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 keyed with the base64 secret
 * after its `whsec_` prefix. The header holds one or more space-separated
 * `v1,<base64>` entries; any match passes.
 */
export function verifyWebhookSignature(
  secret: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (
    !Number.isFinite(ts) ||
    Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  return signature.split(" ").some(entry => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const provided = Buffer.from(value, "base64");
    return (
      provided.length === expected.length && timingSafeEqual(provided, expected)
    );
  });
}
