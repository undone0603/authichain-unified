/**
 * DPP stall / exception cron.
 *
 * Reports paid-loop stalls (payment_succeeded onward). Bounce and checkout
 * abandon are funnel counts, not founder exceptions.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` via `isCronAuthorized`.
 */

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { fetchAllLoopEvents, summarizeDppLoop } from "@/lib/dpp-loop";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await fetchAllLoopEvents(supabaseAdmin);
    const summary = summarizeDppLoop(rows);
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      visits: summary.visits,
      demoVisits: summary.demoVisits,
      funnel: summary.funnel,
      exceptionCount: summary.exceptions.length,
      exceptions: summary.exceptions,
    });
  } catch (err) {
    console.error("[cron/dpp-exceptions] failed:", err);
    return NextResponse.json(
      {
        error: "DPP exception cron failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
