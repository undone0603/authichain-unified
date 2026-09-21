import { NextResponse } from "next/server";
import { applyCycle } from "@/lib/dreamdash/cycle";
import { leadToRowPatch, rowToLead, type LeadCaptureRow } from "@/lib/dreamdash/map-row";
import { newlyDrafted, notifyDrafts } from "@/lib/dreamdash/notify-draft";
import { logAutomation } from "@/lib/automation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: rows, error } = await supabase.from("lead_captures").select("*");
    if (error) throw error;

    const current = ((rows ?? []) as LeadCaptureRow[]).map(rowToLead);
    const { leads, events, report } = applyCycle(current);

    const changed = leads.filter((next) => {
      const prev = current.find((l) => l.id === next.id);
      if (!prev) return true;
      return (
        prev.score !== next.score ||
        prev.stage !== next.stage ||
        prev.draftPending !== next.draftPending ||
        prev.lastTouch !== next.lastTouch
      );
    });

    for (const lead of changed) {
      const patch = leadToRowPatch(lead);
      const { error: upErr } = await supabase.from("lead_captures").update(patch).eq("id", lead.id);
      if (upErr) throw upErr;
    }

    for (const event of events) {
      await logAutomation(event.workflow, "manual", "success", {
        status: event.status,
        detail: event.detail,
        at: event.timestamp,
      });
    }
    await logAutomation("dreamdash-cycle", "manual", "success", report);

    const queued = newlyDrafted(current, leads);
    const notified = await notifyDrafts(queued, "cycle");

    return NextResponse.json({ leads, events, report, notified });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    await logAutomation("dreamdash-cycle", "manual", "failure", null, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
