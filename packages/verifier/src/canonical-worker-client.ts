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
  const response = await res.json() as CanonicalVerificationResponse;
  return { httpStatus: res.status, response };
}
