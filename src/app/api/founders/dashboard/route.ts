import { NextRequest, NextResponse } from "next/server";
import { computeDashboard } from "@/lib/dreamdash/metrics";
import { resolveFoundersAccess } from "@/lib/dreamdash/founders-access";
import { rowToLead, type LeadCaptureRow } from "@/lib/dreamdash/map-row";
import type { HeartbeatEvent } from "@/lib/dreamdash/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await resolveFoundersAccess(request);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { data: rows, error } = await access.supabase
      .from("lead_captures")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const leads = ((rows ?? []) as LeadCaptureRow[]).map(rowToLead);

    let events: HeartbeatEvent[] = [];
    const { data: logs } = await access.supabase
      .from("automation_logs")
      .select("id, workflow_name, status, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(24);
    if (logs) {
      events = logs.map((log) => ({
        id: String(log.id),
        workflow: String(log.workflow_name ?? "workflow"),
        status: log.status === "failure" ? "skipped" : "ok",
        timestamp: String(log.created_at ?? new Date().toISOString()),
        detail: typeof log.payload === "string" ? log.payload.slice(0, 180) : String(log.status ?? ""),
      }));
    }

    const dash = computeDashboard(leads, events);
    return NextResponse.json({ leads, events, dash, actor: access.actor });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
