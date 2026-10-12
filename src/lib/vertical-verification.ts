import {
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
  const endpoint = params.endpoint ?? process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
  if (!endpoint) throw new Error("AUTHICHAIN_CANONICAL_VERIFY_URL not configured");
  const result = await verifyWithCanonicalWorker(endpoint, params.jws, params.expectedObjectId);
  return { vertical: params.vertical, ...result };
}

export function verticalMayActOnVerified(response: CanonicalVerificationResponse): boolean {
  return response.decision === "verified" && response.valid === true;
}
