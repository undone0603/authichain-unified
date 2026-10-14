import { NextRequest, NextResponse } from "next/server";
import { handleLeadAutomation, logAutomation } from "@/lib/automation";

export const dynamic = "force-dynamic";

interface LeadData {
  email: string;
  name?: string;
  source?: string;
  page_url?: string;
  product_interest?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: LeadData = await req.json();
    if (!body.email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // A stored row is the only success. CRM and mail must not run when the write fails.
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey) {
        throw new Error("Supabase not configured");
      }
      const admin = createClient(supabaseUrl, serviceKey);

      const { error } = await admin.from("lead_captures").insert({
        email: body.email,
        name: body.name || null,
        source: body.source || "website",
        page_url: body.page_url || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        product_interest: body.product_interest || "qron",
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[lead-capture] DB error:", err);
      await logAutomation(
        "lead_capture.db_insert",
        "event",
        "failure",
        { email: body.email, source: body.source },
        msg
      );
      return NextResponse.json(
        { error: "Could not store the request" },
        { status: 500 }
      );
    }

    await handleLeadAutomation({
      email: body.email,
      name: body.name,
      source: body.source,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[lead-capture] Error:", err);
    await logAutomation("lead_capture", "event", "failure", null, msg);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
