/**
 * DPP stall / exception cron.
 *
 * Reports paid-loop stalls (payment_succeeded onward). Bounce and checkout
 * abandon are funnel counts, not founder exceptions. Visits that have earned
 * retention (activation + dated usage at/after the 7-day horizon) get a
 * `dpp_loop:retained` write.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` via `isCronAuthorized`.
 */

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runDppExceptionsReport } from "@/lib/dpp-loop";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store",
          "CDN-Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const report = await runDppExceptionsReport(supabaseAdmin);
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
      },
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
