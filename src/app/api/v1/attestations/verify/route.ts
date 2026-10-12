import { NextRequest, NextResponse } from "next/server";
import { verifyWithCanonicalWorker } from "@authichain/verifier";
import { checkAndIncrementUsage, ApiUsageLimitError } from "@/lib/api-usage";

export const dynamic = "force-dynamic";

/**
 * Paid/metered Next adapter for the canonical attestation worker.
 *
 * This route must not invent a local authenticity decision. It meters usage,
 * then returns the worker's AuthiChain Verification Decision v1 response as-is.
 */
export async function POST(req: NextRequest) {
  try {
    // TEMPORARY: Mocked userId until Phase 1 auth is fully operational.
    // Metering only — never used as a trust input.
    const userId = 1;
    await checkAndIncrementUsage(userId);

    const body = await req.json();
    if (!body || typeof body.jws !== "string" || !body.jws.trim()) {
      return NextResponse.json(
        { valid: false, error: "jws is required" },
        { status: 400 },
      );
    }

    const endpoint = process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
    if (!endpoint) {
      return NextResponse.json(
        {
          valid: false,
          decision: "indeterminate",
          decision_contract: "AuthiChain Verification Decision v1",
          error: "AUTHICHAIN_CANONICAL_VERIFY_URL not configured",
        },
        { status: 503 },
      );
    }

    const result = await verifyWithCanonicalWorker(
      endpoint,
      body.jws.trim(),
      typeof body.expected_object_id === "string"
        ? body.expected_object_id
        : undefined,
    );

    return NextResponse.json(result.response, { status: result.httpStatus });
  } catch (error) {
    if (error instanceof ApiUsageLimitError) {
      return NextResponse.json(
        { valid: false, error: error.message },
        { status: 402 },
      );
    }
    return NextResponse.json(
      {
        valid: false,
        decision: "indeterminate",
        decision_contract: "AuthiChain Verification Decision v1",
        error:
          error instanceof Error
            ? error.message
            : "canonical verification failed",
      },
      { status: 502 },
    );
  }
}
