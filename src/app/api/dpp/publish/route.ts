/**
 * POST /api/dpp/publish — records the `dpp_published` loop stage.
 *
 * The merchant publishes their first Digital Product Passport. This is the
 * stage the loop was missing between `merchant_activated` and `verification`.
 *
 * The event is derived from an actual persisted DPP row, never from the
 * request having been received: if the insert fails, no `dpp_published` event
 * is written and the caller gets an error.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordDppLoopEventOnce } from "@/lib/dpp-loop";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key",
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const visitId = String(body.visit_id || "").trim();
    const name = String(body.name || "").trim();

    if (!visitId) {
      return NextResponse.json({ error: "visit_id required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Anchor on a real activation. Publishing before activating means the loop
    // is being driven out of order, which is a bug worth surfacing.
    const { data: activated } = await supabase
      .from("funnel_events")
      .select("id, metadata")
      .eq("prospect_id", visitId)
      .eq("event_type", "dpp_loop:merchant_activated")
      .limit(1);

    if (!Array.isArray(activated) || activated.length === 0) {
      return NextResponse.json(
        { error: "not_activated", detail: "No merchant_activated event for this visit." },
        { status: 409 },
      );
    }

    const profileId =
      (activated[0]?.metadata as { profile_id?: string } | undefined)?.profile_id ?? null;

    const dppPayload = {
      name,
      brand: String(body.brand || "").trim() || null,
      category: String(body.category || "").trim() || null,
      serial_number: String(body.serial_number || "").trim() || null,
      status: "published",
      metadata: {
        dpp: true,
        offer: "dpp_readiness_2026",
        visit_id: visitId,
        gtin: String(body.gtin || "").trim() || null,
        markets: body.markets ?? null,
        published_at: new Date().toISOString(),
      },
    };

    const { data: inserted, error } = await supabase
      .from("products")
      .insert(dppPayload)
      .select("id")
      .single();

    if (error || !inserted?.id) {
      console.error("[dpp/publish] insert failed:", error);
      return NextResponse.json(
        { error: "publish_failed", detail: error?.message ?? "no row returned" },
        { status: 500 },
      );
    }

    const dppId = inserted.id as string;

    const { recorded } = await recordDppLoopEventOnce(supabase, {
      visitId,
      stage: "dpp_published",
      source: String(body.source || "direct"),
      profileId,
      dedupeKey: `dpp:${dppId}`,
      metadata: {
        dpp_id: dppId,
        product_name: name,
        gtin: dppPayload.metadata.gtin,
        published_at: dppPayload.metadata.published_at,
      },
    });

    return NextResponse.json({
      ok: true,
      dpp_id: dppId,
      visit_id: visitId,
      event_recorded: recorded,
      verify_url: `/api/dpp/verify?dpp_id=${encodeURIComponent(dppId)}&visit_id=${encodeURIComponent(visitId)}`,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[dpp/publish] Error:", error);
    return NextResponse.json(
      { error: "publish_failed", detail: err?.message },
      { status: 500 },
    );
  }
}
