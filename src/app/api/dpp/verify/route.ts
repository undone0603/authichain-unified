/**
 * GET/POST /api/dpp/verify — records the `verification` loop stage.
 *
 * Verifies that a published DPP actually resolves, and records the event only
 * when it does. Mirrors the gs1-resolver contract: a DPP that is absent or
 * unpublished is reported as such and is never upgraded to "verified", and the
 * response states what the result does and does not establish.
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

const CLAIMS = {
  verified: {
    proves: "This passport is published and resolves to a registered product record.",
    doesNotProve:
      "Does not prove the physical item in hand matches it, nor the accuracy of the data the merchant supplied.",
  },
  not_found: {
    proves: "Nothing. No published passport exists for this identifier.",
    doesNotProve:
      "Absence here is not proof of counterfeit — the product may simply never have been published.",
  },
} as const;

async function verify(dppId: string, visitId: string | null, source: string) {
  if (!dppId) {
    return NextResponse.json({ error: "dpp_id required" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, brand, status, metadata")
    .eq("id", dppId)
    .maybeSingle();

  const isPublished =
    !!product && product.status === "published" && !!(product.metadata as { dpp?: boolean })?.dpp;

  if (!isPublished) {
    return NextResponse.json(
      {
        ok: false,
        status: "not_found",
        dpp_id: dppId,
        ...CLAIMS.not_found,
        event_recorded: false,
      },
      { status: 404 },
    );
  }

  let recorded = false;
  if (visitId) {
    const result = await recordDppLoopEventOnce(supabase, {
      visitId,
      stage: "verification",
      source,
      dedupeKey: `verify:${dppId}`,
      metadata: {
        dpp_id: dppId,
        product_name: product.name,
        verified_at: new Date().toISOString(),
      },
    });
    recorded = result.recorded;
  }

  return NextResponse.json({
    ok: true,
    status: "verified",
    dpp_id: dppId,
    product: { name: product.name, brand: product.brand },
    ...CLAIMS.verified,
    event_recorded: recorded,
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return verify(
    String(url.searchParams.get("dpp_id") || "").trim(),
    String(url.searchParams.get("visit_id") || "").trim() || null,
    String(url.searchParams.get("source") || "direct"),
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return verify(
      String(body.dpp_id || "").trim(),
      String(body.visit_id || "").trim() || null,
      String(body.source || "direct"),
    );
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
}
