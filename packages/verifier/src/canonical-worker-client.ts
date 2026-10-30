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

/** How long a consumer waits for the canonical worker before failing closed. */
export const CANONICAL_VERIFY_TIMEOUT_MS = 10_000;

/**
 * Call the canonical worker. Throws when it cannot be reached in time or does
 * not answer in the decision vocabulary; callers map a throw to
 * `indeterminate`, so an outage or a proxy error page is never a decision.
 */
export async function verifyWithCanonicalWorker(
  endpoint: string,
  jws: string,
  expectedObjectId?: string,
  options: { timeoutMs?: number } = {},
): Promise<{ httpStatus: number; response: CanonicalVerificationResponse }> {
  const body: Record<string, string> = { jws };
  if (expectedObjectId) body.expected_object_id = expectedObjectId;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? CANONICAL_VERIFY_TIMEOUT_MS),
  });
  const response = (await res.json()) as CanonicalVerificationResponse;
  if (
    !response ||
    typeof response !== "object" ||
    typeof response.valid !== "boolean" ||
    typeof response.decision !== "string"
  ) {
    throw new Error("canonical verify returned a response outside the decision contract");
  }
  return { httpStatus: res.status, response };
}

/**
 * The one positive rule every consumer applies: a 2xx from the canonical
 * worker carrying valid=true AND decision=verified. A body that says verified
 * under an error status, or valid=true with any other decision, is not
 * positive.
 */
export function isCanonicalPositive(result: {
  httpStatus: number;
  response: CanonicalVerificationResponse;
}): boolean {
  return (
    result.httpStatus >= 200 &&
    result.httpStatus < 300 &&
    result.response.valid === true &&
    result.response.decision === "verified"
  );
}
