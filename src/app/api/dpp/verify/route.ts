/**
 * GET/POST /api/dpp/verify — records the `verification` loop stage.
 *
 * Logic lives in src/lib/dpp-verify.ts so worker-app can mount the same
 * handler on authichain-edge-router.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyDpp } from "@/lib/dpp-verify";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function handle(dppId: string, visitId: string | null, source: string) {
  const result = await verifyDpp({
    dppId,
    visitId,
    source,
    supabase: getSupabase(),
  });
  if (!result.ok) {
    if (result.error === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          status: "not_found",
          dpp_id: result.dpp_id,
          proves: result.proves,
          doesNotProve: result.doesNotProve,
          event_recorded: false,
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: result.error,
        ...(result.detail ? { detail: result.detail } : {}),
      },
      { status: result.status },
    );
  }
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return handle(
    String(url.searchParams.get("dpp_id") || "").trim(),
    String(url.searchParams.get("visit_id") || "").trim() || null,
    String(url.searchParams.get("source") || "direct"),
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return handle(
      String(body.dpp_id || "").trim(),
      String(body.visit_id || "").trim() || null,
      String(body.source || "direct"),
    );
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
}
