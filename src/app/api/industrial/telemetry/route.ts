import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth-api";
import {
  processIndustrialEvent,
  IndustrialTheater,
} from "@/lib/industrial/telemetry";
import { summarizeTelemetry } from "@/lib/industrial/telemetry-counts";
import { logAutomation } from "@/lib/automation";
import { supabaseAdmin as admin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/industrial/telemetry
 * Counts stored telemetry_events rows. It does not invent device readings.
 */
export async function GET() {
  const { data, error } = await admin
    .from("telemetry_events")
    .select("source,theater,state_hash,anchored_tx_hash");
  if (error || !Array.isArray(data)) {
    return NextResponse.json(
      { error: "telemetry_query_failed", verified: false },
      { status: 500 }
    );
  }
  const body = await summarizeTelemetry(data, {
    rpcUrl: process.env.POLYGON_RPC_URL ?? null,
  });
  return NextResponse.json(body);
}

/**
 * POST /api/industrial/telemetry
 * Records an industrial event. It does not anchor and it does not verify a passport.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Industrial Node
    const apiKey = req.headers.get("X-API-Key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Authentication missing" },
        { status: 401 }
      );
    }

    const userId = await verifyApiKey(apiKey);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid Industrial Key" },
        { status: 401 }
      );
    }

    // 2. Parse and Validate Payload
    const body = await req.json();
    const { theater, payload, productId } = body;

    if (!["theater_1", "theater_3"].includes(theater)) {
      return NextResponse.json(
        { error: "Invalid Industrial Theater" },
        { status: 400 }
      );
    }

    // 3. Process Industrial State
    const { parsedState, stateHash, timestamp } = await processIndustrialEvent(
      theater as IndustrialTheater,
      payload
    );

    const { data: event, error: dbError } = await admin
      .from("telemetry_events")
      .insert({
        user_id: userId,
        theater,
        product_id: productId || null,
        raw_payload: payload,
        parsed_state: parsedState,
        state_hash: stateHash,
        anchored_tx_hash: null,
        timestamp: timestamp,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      eventId: event.id,
      stateHash,
      anchored: false,
      verified: false,
      message:
        "This ingest does not anchor a passport and does not verify one.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Industrial/Telemetry] Ingestion error:", err);
    await logAutomation("industrial_telemetry", "event", "failure", null, msg);
    return NextResponse.json(
      {
        error: "Ingestion pipeline failure",
        detail: msg,
      },
      { status: 500 }
    );
  }
}
