import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/trial/start
 *
 * Retired. A card trial is not a public offer. The free catalogue plan is
 * the five-generation grant at qron.space/generate.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "trial_offers_retired",
      message:
        "A free trial is not a public offer. The free plan is five generations.",
      pricing_url: "https://qron.space/generate",
    },
    { status: 410 }
  );
}
