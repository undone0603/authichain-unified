import { NextRequest, NextResponse } from "next/server";
import { verifyWithCanonicalWorker } from "@authichain/verifier";
import { checkAndIncrementUsage, ApiUsageLimitError } from "@/lib/api-usage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = 1;
    await checkAndIncrementUsage(userId);

    const body = await req.json();
    if (!body || typeof body.jws !== "string" || !body.jws.trim()) {
      return NextResponse.json({ valid: false, error: "jws is required" }, { status: 400 });
    }

    const endpoint = process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
    if (!endpoint) {
      return NextResponse.json(
        { valid: false, error: "AUTHICHAIN_CANONICAL_VERIFY_URL not configured" },
        { status: 503 },
      );
    }

    const result = await verifyWithCanonicalWorker(
      endpoint,
      body.jws.trim(),
      typeof body.expected_object_id === "string" ? body.expected_object_id : undefined,
    );

    return NextResponse.json(result.response, { status: result.httpStatus });
  } catch (error) {
    if (error instanceof ApiUsageLimitError) {
      return NextResponse.json({ valid: false, error: error.message }, { status: 402 });
    }
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "canonical verification failed",
      },
      { status: 502 },
    );
  }
}
