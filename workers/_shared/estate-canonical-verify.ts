/**
 * Sister-apex adapter for AuthiChain canonical attestation verify.
 *
 * Visual / gallery / redirect layers must not invent authenticity. This route
 * forwards a signed JWS to the canonical worker and fail-closes when the
 * worker does not return a positive verified decision.
 */
import {
  resolveCanonicalVerifyUrl,
  verifyWithCanonicalWorker,
} from "../../packages/verifier/src/canonical-worker-client.ts";

const DECISION_CONTRACT = "AuthiChain Verification Decision v1";
const NO_STORE = {
  "content-type": "application/json",
  "cache-control": "no-store",
} as const;

export type EstateCanonicalVerifyEnv = {
  AUTHICHAIN_CANONICAL_VERIFY_URL?: string;
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: NO_STORE });
}

/**
 * Handle POST /api/verify on sister apexes. Returns null for other methods/paths.
 */
export async function tryHandleEstateCanonicalVerify(
  request: Request,
  env?: EstateCanonicalVerifyEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/verify" && url.pathname !== "/api/verify/") {
    return null;
  }
  if (request.method !== "POST") {
    return json(
      {
        valid: false,
        decision: "indeterminate",
        decision_contract: DECISION_CONTRACT,
        error: "method_not_allowed",
      },
      405,
    );
  }

  let body: { jws?: unknown; expected_object_id?: unknown };
  try {
    body = (await request.json()) as {
      jws?: unknown;
      expected_object_id?: unknown;
    };
  } catch {
    return json(
      {
        valid: false,
        decision: "indeterminate",
        decision_contract: DECISION_CONTRACT,
        error: "invalid_json",
      },
      400,
    );
  }

  if (typeof body.jws !== "string" || !body.jws.trim()) {
    return json(
      {
        valid: false,
        decision: "indeterminate",
        decision_contract: DECISION_CONTRACT,
        cryptographic_status: "unknown",
        error: "jws is required",
      },
      400,
    );
  }

  try {
    const result = await verifyWithCanonicalWorker(
      resolveCanonicalVerifyUrl(env?.AUTHICHAIN_CANONICAL_VERIFY_URL),
      body.jws.trim(),
      typeof body.expected_object_id === "string"
        ? body.expected_object_id
        : undefined,
    );
    const canonicalPositive =
      result.httpStatus >= 200 &&
      result.httpStatus < 300 &&
      result.response.valid === true &&
      result.response.decision === "verified";
    const response = canonicalPositive
      ? result.response
      : {
          ...result.response,
          valid: false,
          decision_contract:
            result.response.decision_contract ?? DECISION_CONTRACT,
          ...(result.response.decision === "verified"
            ? { decision: "indeterminate" }
            : {}),
          reasons: [
            ...(Array.isArray(result.response.reasons)
              ? result.response.reasons
              : []),
            "canonical_response_not_positive",
          ],
        };
    const status = canonicalPositive
      ? 200
      : result.httpStatus >= 400
        ? result.httpStatus
        : 409;
    return json(response as Record<string, unknown>, status);
  } catch (error) {
    return json(
      {
        valid: false,
        decision: "indeterminate",
        decision_contract: DECISION_CONTRACT,
        error:
          error instanceof Error
            ? error.message
            : "canonical verification failed",
      },
      502,
    );
  }
}
