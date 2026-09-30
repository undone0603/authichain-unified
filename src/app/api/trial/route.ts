import { NextResponse } from "next/server";

/**
 * /api/trial — retired 2026-09-30 (Z's decision in the project thread).
 *
 * This endpoint advertised a "Pro Trial" converting at $49 and a "Business
 * Trial" converting at $129. Neither plan is in the catalogue
 * (src/lib/plans.ts), and the POST reported a trial as "active" without
 * creating anything. Nothing on the site called it; the live "Try for free"
 * button uses /api/trial/start. It now answers 410 and points to the real
 * catalogue instead of offering prices that cannot be bought.
 */
const GONE = {
  success: false,
  error: "trial_offers_retired",
  message:
    "These trial offers are no longer available. See current plans at /pricing.",
  pricing_url: "https://qron.space/pricing",
  plans_api: "/api/subscribe",
};

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE, { status: 410 });
}
