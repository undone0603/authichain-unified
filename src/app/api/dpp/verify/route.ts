/**
 * GET/POST /api/dpp/verify — records the `verification` loop stage.
 *
 * DPP publication remains a resolution fact. When a signed attestation is
 * supplied, the response also carries the actual canonical worker decision;
 * this prevents a published passport from being presented as proof of the
 * physical item.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWithCanonicalWorker, type CanonicalVerificationResponse } from "../../../../../packages/verifier/src/canonical-worker-client";
import { verifyDpp } from "@/lib/dpp-verify";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function canonicalVerification(jws: string | null, expectedObjectId?: string): Promise<CanonicalVerificationResponse | null> {
  if (!jws) return null;
  const endpoint = process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
  if (!endpoint) throw new Error("AUTHICHAIN_CANONICAL_VERIFY_URL not configured");
  const result = await verifyWithCanonicalWorker(endpoint, jws, expectedObjectId);
  return result.response;
}

async function handle(dppId: string, visitId: string | null, source: string, jws: string | null = null, expectedObjectId?: string) {
  const result = await verifyDpp({ dppId, visitId, source, supabase: getSupabase() });
  if (!result.ok) {
    if (result.error === "not_found") {
      return NextResponse.json({ ok: false, status: "not_found", dpp_id: result.dpp_id, proves: result.proves, doesNotProve: result.doesNotProve, event_recorded: false }, { status: 404 });
    }
    return NextResponse.json({ error: result.error, ...(result.detail ? { detail: result.detail } : {}) }, { status: result.status });
  }
  try {
    const protocolVerification = await canonicalVerification(jws, expectedObjectId);
    return NextResponse.json({ ...result, ...(protocolVerification ? { protocol_verification: protocolVerification } : {}) });
  } catch (error) {
    return NextResponse.json({
      ...result,
      protocol_verification: {
        valid: false,
        decision: "indeterminate",
        reasons: ["canonical_verification_unavailable"],
        error: error instanceof Error ? error.message : "canonical verification failed",
      },
    }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return handle(
    String(url.searchParams.get("dpp_id") || "").trim(),
    String(url.searchParams.get("visit_id") || "").trim() || null,
    String(url.searchParams.get("source") || "direct"),
    String(url.searchParams.get("jws") || "").trim() || null,
    String(url.searchParams.get("expected_object_id") || "").trim() || undefined,
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return handle(
      String(body.dpp_id || "").trim(),
      String(body.visit_id || "").trim() || null,
      String(body.source || "direct"),
      typeof body.jws === "string" && body.jws.trim() ? body.jws.trim() : null,
      typeof body.expected_object_id === "string" ? body.expected_object_id.trim() || undefined : undefined,
    );
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
}
