export type CanonicalVerificationResponse = {
  valid: boolean;
  decision: string;
  decision_contract?: string;
  status?: string;
  claim_status?: string;
  cryptographic_status?: string;
  issuer_status?: string;
  overall_valid?: boolean;
  reasons?: string[];
  [key: string]: unknown;
};

/** Public AuthiChain attestation verify endpoint (not a secret). */
export const DEFAULT_CANONICAL_VERIFY_URL =
  "https://authichain.com/api/v1/attestation/verify";

/**
 * Resolve the canonical verify URL.
 * Prefer an explicit argument, then AUTHICHAIN_CANONICAL_VERIFY_URL, then the
 * public production verify route. Empty string overrides are ignored.
 */
export function resolveCanonicalVerifyUrl(explicit?: string | null): string {
  const fromArg = typeof explicit === "string" ? explicit.trim() : "";
  if (fromArg) return fromArg;
  const fromEnv =
    typeof process !== "undefined" && process.env
      ? String(process.env.AUTHICHAIN_CANONICAL_VERIFY_URL || "").trim()
      : "";
  if (fromEnv) return fromEnv;
  return DEFAULT_CANONICAL_VERIFY_URL;
}

export async function verifyWithCanonicalWorker(
  endpoint: string,
  jws: string,
  expectedObjectId?: string,
): Promise<{ httpStatus: number; response: CanonicalVerificationResponse }> {
  const body: Record<string, string> = { jws };
  if (expectedObjectId) body.expected_object_id = expectedObjectId;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = (await res.json()) as CanonicalVerificationResponse;
  return { httpStatus: res.status, response };
}
