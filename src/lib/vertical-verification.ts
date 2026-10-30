import {
  isCanonicalPositive,
  resolveCanonicalVerifyUrl,
  verifyWithCanonicalWorker,
  type CanonicalVerificationResponse,
} from "../../packages/verifier/src/canonical-worker-client";

export type VerticalVerification = {
  vertical: "strainchain" | "govchain" | "dpp" | "qron";
  httpStatus: number;
  response: CanonicalVerificationResponse;
};

export async function verifyVerticalAttestation(params: {
  vertical: VerticalVerification["vertical"];
  jws: string;
  expectedObjectId?: string;
  endpoint?: string;
}): Promise<VerticalVerification> {
  const endpoint = resolveCanonicalVerifyUrl(params.endpoint);
  const result = await verifyWithCanonicalWorker(
    endpoint,
    params.jws,
    params.expectedObjectId,
  );
  return { vertical: params.vertical, ...result };
}

/**
 * Pass the HTTP status when you have it: a "verified" body under an error
 * status is not positive (isCanonicalPositive). Without it only the body is
 * judged.
 */
export function verticalMayActOnVerified(
  response: CanonicalVerificationResponse,
  httpStatus?: number,
): boolean {
  if (httpStatus !== undefined) return isCanonicalPositive({ httpStatus, response });
  return response.decision === "verified" && response.valid === true;
}
