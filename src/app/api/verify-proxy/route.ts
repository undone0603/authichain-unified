/**
 * GET /api/verify-proxy?id=<seal uuid>
 *
 * Free, public lookup behind the /verify lead-magnet page. It exists because
 * the page called this path while only the metered POST /api/verify (API key)
 * and the x402-paid POST /api/v1/agent-verify existed, so every visitor check
 * failed.
 *
 * What it answers: the same baseline as the paid agent endpoint, via
 * sealBaseline() — registry presence plus signature/validity. It never says
 * "verified": that word is reserved for protocol/verifier.mjs with an anchor
 * query (see src/lib/agent-verify.ts).
 *
 * What it deliberately does not return: product id, batch id, brand or QR
 * payload. That detail is the paid product; this route returns a verdict and
 * the reasons behind it, nothing else.
 *
 * Abuse controls: non-UUID ids are refused before any database call, and each
 * client IP is limited per minute.
 */
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";
// Relative, not "@/lib/…": tsconfig.worker.json maps "@/*" to client/src only.
import { sealBaseline } from "../../../lib/seal-baseline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PER_MINUTE = 20;

const NO_STORE = { "Cache-Control": "no-store" };

function respond(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";

  if (!UUID.test(id)) {
    return respond(
      {
        verdict: "invalid_id",
        error: "Seal IDs are UUIDs. Check the ID or scan the QR again.",
      },
      400
    );
  }

  const limit = await checkRateLimit(`verify-proxy:${clientIp(req)}`, PER_MINUTE, 1);
  if (!limit.ok) {
    return respond(
      { verdict: "rate_limited", error: "Too many checks. Wait a minute and retry." },
      429
    );
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return respond(
      { verdict: "registry_unavailable", error: "Registry unavailable. Try again shortly." },
      503
    );
  }

  const { data, error } = await createAdminClient(url, key)
    .from("auth_seals")
    .select("id,product_id,batch_id,brand,created_at,qr_payload")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return respond(
      { verdict: "registry_unavailable", error: "Registry unavailable. Try again shortly." },
      503
    );
  }

  const answer = sealBaseline((data as Record<string, unknown> | null) ?? null);
  const details = answer.details as { verdict?: string; reasons?: string[] };

  return respond({
    verdict: details.verdict ?? "unsigned",
    reasons: details.reasons ?? [],
    registered: answer.registered,
    verified: false,
  });
}
