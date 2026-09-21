import { NextRequest, NextResponse } from "next/server";
import { applyAdvance, applyCapture, applySamImport, stamp } from "@/lib/dreamdash/cycle";
import { leadToRowPatch, rowToLead, type LeadCaptureRow } from "@/lib/dreamdash/map-row";
import { notifyDraft } from "@/lib/dreamdash/notify-draft";
import type { ActivityKind, CaptureInput, Lead } from "@/lib/dreamdash/types";
import { DOMAINS } from "@/lib/dreamdash/types";
import { logAutomation } from "@/lib/automation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function loadLeads(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.from("lead_captures").select("*");
  if (error) throw error;
  return ((data ?? []) as LeadCaptureRow[]).map(rowToLead);
}

async function persistNew(supabase: Awaited<ReturnType<typeof createClient>>, lead: Lead) {
  const patch = leadToRowPatch(lead);
  const { data, error } = await supabase
    .from("lead_captures")
    .insert({ email: lead.email, name: lead.name, ...patch })
    .select()
    .single();
  if (error) throw error;
  return rowToLead(data as LeadCaptureRow);
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { action?: string; capture?: CaptureInput };

    if (body.action === "import-sam") {
      const current = await loadLeads(supabase);
      const { added } = applySamImport(current);
      const saved: Lead[] = [];
      for (const lead of added) saved.push(await persistNew(supabase, lead));
      await logAutomation("govchain-opp-to-leads", "manual", "success", { added: saved.length });
      return NextResponse.json({ added: saved.length, leads: saved });
    }

    const input = body.capture;
    if (!input?.email || !input.company) {
      return NextResponse.json({ error: "email and company required" }, { status: 400 });
    }
    if (!(DOMAINS as readonly string[]).includes(input.domain)) {
      return NextResponse.json({ error: "invalid domain" }, { status: 400 });
    }

    const current = await loadLeads(supabase);
    const { merged, lead } = applyCapture(current, input);
    if (merged) {
      const patch = leadToRowPatch(lead);
      const { error } = await supabase.from("lead_captures").update(patch).eq("id", lead.id);
      if (error) throw error;
      await logAutomation("lead-capture-sync", "manual", "success", { merged: true, email: lead.email });
      if (lead.draftPending) await notifyDraft(lead, "capture");
      return NextResponse.json({ merged: true, lead });
    }

    const saved = await persistNew(supabase, lead);
    await logAutomation("lead-capture-sync", "manual", "success", { merged: false, email: saved.email });
    if (saved.draftPending) await notifyDraft(saved, "capture");
    return NextResponse.json({ merged: false, lead: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
      id?: string;
      action?: string;
      notes?: string;
      kind?: ActivityKind;
      detail?: string;
    };
    if (!body.id || !body.action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }

    const { data, error } = await supabase.from("lead_captures").select("*").eq("id", body.id).single();
    if (error) throw error;
    let lead = rowToLead(data as LeadCaptureRow);

    if (body.action === "advance") {
      const next = applyAdvance(lead);
      if (!next) return NextResponse.json({ error: "cannot advance" }, { status: 400 });
      lead = next;
    } else if (body.action === "send") {
      lead = stamp(lead, "sent", "Draft marked sent", {
        draftPending: false,
        stage: lead.stage === "new" ? "contacted" : lead.stage,
      });
    } else if (body.action === "followup") {
      lead = stamp(lead, "followup", "Stale follow-up queued", { draftPending: true });
    } else if (body.action === "lost") {
      lead = stamp(lead, "note", "Marked lost", { lost: true, draftPending: false });
    } else if (body.action === "reopen") {
      lead = stamp(lead, "note", "Reopened", { lost: false });
    } else if (body.action === "notes") {
      lead = stamp(lead, "note", body.notes ? "Notes updated" : "Notes cleared", {
        notes: (body.notes ?? "").trim(),
      });
    } else if (body.action === "activity") {
      const kind = body.kind ?? "note";
      lead = stamp(lead, kind, body.detail || kind);
    } else {
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }

    const patch = leadToRowPatch(lead);
    const { error: upErr } = await supabase.from("lead_captures").update(patch).eq("id", lead.id);
    if (upErr) throw upErr;

    if (body.action === "followup" && lead.draftPending) {
      await logAutomation("send-followups", "manual", "success", { id: lead.id, company: lead.company });
      await notifyDraft(lead, "followup");
    } else if (body.action === "send") {
      await logAutomation("dreamdash-draft-sent", "manual", "success", { id: lead.id, company: lead.company });
    }

    return NextResponse.json({ lead });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
