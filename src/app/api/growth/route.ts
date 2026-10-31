/**
 * Growth loop event ingest — POST /api/growth
 *
 * Receives the payload built by src/lib/growth/emit.ts and appends it to
 * public.growth_loop_events. Contract and kill criteria:
 * docs/growth/2026-09-28-first-dollar-loops.md
 *
 * Validation is re-done here rather than trusted from the client: this endpoint
 * is public (anonymous visitors fire generate_view), so a bad or spoofed event
 * must not reach the table that every kill decision is read from.
 *
 * Mirrors the service-role rail used by /api/funnel.
 */
import { NextRequest, NextResponse } from "next/server";
import { isGrowthEvent, loopForEvent, type GrowthSku } from "@/lib/growth/emit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const SKUS: readonly GrowthSku[] = ["starter", "dpp_readiness", "strainchain_passport"];
const EMAIL_HASH_RE = /^[0-9a-f]{64}$/;

interface Body {
  event?: unknown;
  loop?: unknown;
  sku?: unknown;
  email_hash?: unknown;
  founder?: unknown;
  occurred_at?: unknown;
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Invalid JSON body");
  }

  const { event, sku, loop, founder, occurred_at: occurredAt, email_hash: emailHash } = body;

  if (typeof event !== "string" || !isGrowthEvent(event)) {
    return bad("Unknown or missing event");
  }
  if (typeof sku !== "string" || !SKUS.includes(sku as GrowthSku)) {
    return bad(`sku must be one of: ${SKUS.join(", ")}`);
  }

  // The loop is derivable from (event, sku); recompute it and require agreement
  // so a client cannot file an event against the wrong loop's kill criteria.
  const derived = loopForEvent(event, sku as GrowthSku);
  if (!derived) return bad(`Event ${event} is not declared for sku ${sku}`);
  if (typeof loop === "string" && loop !== derived) {
    return bad(`loop ${loop} does not match ${derived} for ${event}/${sku}`);
  }

  if (typeof founder !== "boolean") return bad("founder must be a boolean");

  if (emailHash != null && (typeof emailHash !== "string" || !EMAIL_HASH_RE.test(emailHash))) {
    return bad("email_hash must be a SHA-256 hex digest");
  }

  // Reject a raw address outright: emit.ts hashes before sending, so an
  // unhashed value here means a miswired call site leaking PII.
  if (typeof emailHash === "string" && emailHash.includes("@")) {
    return bad("email_hash must be hashed, not a raw address");
  }

  let occurred: string;
  if (occurredAt == null) {
    occurred = new Date().toISOString();
  } else if (typeof occurredAt === "string" && !Number.isNaN(Date.parse(occurredAt))) {
    occurred = new Date(occurredAt).toISOString();
  } else {
    return bad("occurred_at must be an ISO-8601 timestamp");
  }

  try {
    // getSupabaseAdmin() is lazy on purpose: constructing the client at module
    // scope breaks `next build` wherever the env vars are absent.
    const { error } = await getSupabaseAdmin().from("growth_loop_events").insert({
      event,
      loop: derived,
      sku,
      email_hash: typeof emailHash === "string" ? emailHash : null,
      founder,
      occurred_at: occurred,
    });

    if (error) {
      console.error("[growth] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
    }

    return NextResponse.json({ success: true, event, loop: derived, sku, founder }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[growth] error:", message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Growth loop event ingest",
    contract: "docs/growth/2026-09-28-first-dollar-loops.md",
    usage: {
      method: "POST",
      endpoint: "/api/growth",
      body: {
        event: "one of the GrowthEvent names in src/lib/growth/loops.ts",
        sku: SKUS,
        loop: "optional; derived from event+sku and must agree if sent",
        email_hash: "optional SHA-256 hex; raw addresses are rejected",
        founder: "boolean, required",
        occurred_at: "optional ISO-8601; defaults to now",
      },
    },
  });
}
