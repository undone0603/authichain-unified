import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildRevenueProof } from "@/lib/revenue-proof";
import type { LoopEventRow } from "@/lib/dpp-loop";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: events, error: eventError } = await supabase
      .from("funnel_events")
      .select("prospect_id, event_type, timestamp, metadata")
      .order("timestamp", { ascending: false })
      .limit(5000);
    if (eventError) throw eventError;

    const { data: logs } = await supabase
      .from("automation_logs")
      .select("status")
      .limit(500);

    const decisions = ((events ?? []) as LoopEventRow[]).map(row => ({
      decision:
        typeof row.metadata?.decision === "string"
          ? row.metadata.decision
          : null,
    }));

    const proof = buildRevenueProof(
      (events ?? []) as LoopEventRow[],
      logs ?? [],
      decisions
    );
    return NextResponse.json(proof);
  } catch (err) {
    const message = err instanceof Error ? err.message : "load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
