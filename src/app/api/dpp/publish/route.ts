/**
 * POST /api/dpp/publish — records the `dpp_published` loop stage.
 *
 * Logic lives in src/lib/dpp-publish.ts so worker-app can mount the same
 * handler on authichain-edge-router.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishDpp } from "@/lib/dpp-publish";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await publishDpp({ body, supabase: getSupabase() });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.detail ? { detail: result.detail } : {}),
        },
        { status: result.status },
      );
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[dpp/publish] Error:", error);
    return NextResponse.json(
      { error: "publish_failed", detail: err?.message },
      { status: 500 },
    );
  }
}
