import { NextRequest, NextResponse } from "next/server";
import { applyCycle } from "@/lib/dreamdash/cycle";
import { resolveFoundersAccess } from "@/lib/dreamdash/founders-access";
import { leadToRowPatch, rowToLead, type LeadCaptureRow } from "@/lib/dreamdash/map-row";
import { newlyDrafted, notifyDrafts } from "@/lib/dreamdash/notify-draft";
import { logAutomation } from "@/lib/automation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const access = await resolveFoundersAccess(request);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { data: rows, error } = await access.supabase.from("lead_captures").select("*");
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
      const { error: upErr } = await access.supabase.from("lead_captures").update(patch).eq("id", lead.id);
      if (upErr) throw upErr;
    }

    const trigger = access.actor === "agentz" ? "agentz" : "manual";
    for (const event of events) {
      await logAutomation(event.workflow, trigger, "success", {
        status: event.status,
        detail: event.detail,
        at: event.timestamp,
        actor: access.actor,
      });
    }
    await logAutomation("dreamdash-cycle", trigger, "success", { ...report, actor: access.actor });

    const queued = newlyDrafted(current, leads);
    const notified = await notifyDrafts(queued, "cycle");

    return NextResponse.json({ leads, events, report, notified, actor: access.actor });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    await logAutomation("dreamdash-cycle", "manual", "failure", null, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
