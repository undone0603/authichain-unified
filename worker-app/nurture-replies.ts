/**
 * Port of src/app/api/cron/nurture-replies onto the edge router.
 *
 * GROUP B / HELD. This module is callable over HTTP with CRON_SECRET.
 * It is not in CLEARED_JOBS and must not ride the hourly dispatcher.
 * Default mode is dry-run: plan sequences and list due sends, write nothing,
 * send nothing. Live send requires ?send=1 AND env NURTURE_SEND_ENABLED=true.
 *
 * Fixes vs the Next route: after a sequence is created the reply leaves
 * status=new (was re-queued every tick). nurturePaused on the lead is
 * checked at queue and at send.
 */
import type { Context, Hono } from "hono";
import { selectTemplate } from "../src/lib/email-templates";

export const NURTURE_CRON_PATH = "/api/cron/nurture-replies";
export const NURTURE_SCHEDULE = "0 */2 * * *";
export const NURTURE_HELD = true;

export const NURTURE_DELAYS_MS = {
  positive_followup: 2 * 60 * 60 * 1000,
  objection_budget: 4 * 60 * 60 * 1000,
  objection_timeline: 6 * 60 * 60 * 1000,
  objection_competitor: 3 * 60 * 60 * 1000,
  objection_decision_maker: 5 * 60 * 60 * 1000,
  reminder: 7 * 24 * 60 * 60 * 1000,
} as const;

export type NurtureMode = "dry-run" | "send";

export type QueuePlan =
  | { action: "skip"; reason: string }
  | {
      action: "queue";
      templateType: keyof typeof NURTURE_DELAYS_MS | string;
      delayMs: number;
    };

export function planQueueFromReply(reply: {
  leadId: number | null;
  sentiment: string | null;
  objectionType?: string | null;
  nurturePaused?: boolean | null;
}): QueuePlan {
  if (!reply.leadId) return { action: "skip", reason: "unmatched" };
  if (reply.nurturePaused) return { action: "skip", reason: "nurture_paused" };
  const sentiment = reply.sentiment || "neutral";
  if (sentiment === "neutral" || sentiment === "negative") {
    return { action: "skip", reason: "manual_review" };
  }
  if (sentiment === "positive") {
    return {
      action: "queue",
      templateType: "positive_followup",
      delayMs: NURTURE_DELAYS_MS.positive_followup,
    };
  }
  if (sentiment === "objection") {
    switch (reply.objectionType) {
      case "budget":
        return {
          action: "queue",
          templateType: "objection_budget",
          delayMs: NURTURE_DELAYS_MS.objection_budget,
        };
      case "timeline":
        return {
          action: "queue",
          templateType: "objection_timeline",
          delayMs: NURTURE_DELAYS_MS.objection_timeline,
        };
      case "competitor":
        return {
          action: "queue",
          templateType: "objection_competitor",
          delayMs: NURTURE_DELAYS_MS.objection_competitor,
        };
      case "decision_maker":
        return {
          action: "queue",
          templateType: "objection_decision_maker",
          delayMs: NURTURE_DELAYS_MS.objection_decision_maker,
        };
      default:
        return {
          action: "queue",
          templateType: "objection_budget",
          delayMs: NURTURE_DELAYS_MS.objection_budget,
        };
    }
  }
  return { action: "skip", reason: "manual_review" };
}

export function resolveNurtureMode(
  url: URL,
  sendEnabled: boolean
): { mode: NurtureMode; blockedReason?: string } {
  const wantSend = url.searchParams.get("send") === "1";
  if (!wantSend) return { mode: "dry-run" };
  if (!sendEnabled) {
    return {
      mode: "dry-run",
      blockedReason: "NURTURE_SEND_ENABLED is not true; send stays held",
    };
  }
  return { mode: "send" };
}

export type NurtureEnv = {
  CRON_SECRET?: string;
  RESEND_API_KEY?: string;
  NURTURE_SEND_ENABLED?: string;
  NURTURE_EMAIL_FROM?: string;
  CALENDLY_URL?: string;
  PILOT_PRICE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type NurtureContext = Context<{ Bindings: NurtureEnv }>;

function envValue(c: NurtureContext, name: keyof NurtureEnv): string | undefined {
  return c.env?.[name] || process.env[name] || undefined;
}

export type SendResult = { ok: true; provider: string } | { ok: false; error: string };

export async function sendNurtureEmail(
  apiKey: string,
  args: { to: string; from: string; replyTo: string; subject: string; text: string }
): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      reply_to: args.replyTo,
      subject: args.subject,
      text: args.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `resend ${res.status} ${detail.slice(0, 180)}` };
  }
  return { ok: true, provider: "resend" };
}

type Admin = {
  from(table: string): any;
};

export async function runNurtureTick(opts: {
  admin: Admin;
  now?: Date;
  mode: NurtureMode;
  sendEmail?: typeof sendNurtureEmail;
  resendApiKey?: string;
  fromAddress?: string;
  calendlyUrl?: string;
  pilotPrice?: string;
}): Promise<{
  mode: NurtureMode;
  queued: number;
  sent: number;
  bounced: number;
  skipped: number;
  planned: Array<Record<string, unknown>>;
}> {
  const now = opts.now ?? new Date();
  const planned: Array<Record<string, unknown>> = [];
  let queued = 0;
  let sent = 0;
  let bounced = 0;
  let skipped = 0;

  const { data: newReplies, error: newErr } = await opts.admin
    .from("inbound_replies")
    .select(
      "id, lead_id, lead_email, sentiment, objection_type, objection_details, status"
    )
    .eq("status", "new");
  if (newErr) throw new Error(newErr.message);

  for (const reply of newReplies ?? []) {
    let nurturePaused = false;
    if (reply.lead_id) {
      const { data: lead } = await opts.admin
        .from("leads")
        .select("id, nurturePaused")
        .eq("id", reply.lead_id)
        .maybeSingle();
      nurturePaused = Boolean(lead?.nurturePaused);
    }
    const plan = planQueueFromReply({
      leadId: reply.lead_id ?? null,
      sentiment: reply.sentiment ?? null,
      objectionType: reply.objection_type ?? null,
      nurturePaused,
    });
    if (plan.action === "skip") {
      skipped += 1;
      planned.push({ replyId: reply.id, ...plan });
      continue;
    }
    const scheduledAt = new Date(now.getTime() + plan.delayMs).toISOString();
    planned.push({
      replyId: reply.id,
      leadId: reply.lead_id,
      templateType: plan.templateType,
      nextScheduledAt: scheduledAt,
      action: opts.mode === "send" ? "queue" : "would_queue",
    });
    if (opts.mode !== "send") continue;

    const { error: insertErr } = await opts.admin.from("reply_sequences").insert({
      lead_id: reply.lead_id,
      reply_id: reply.id,
      template_type: plan.templateType,
      sequence_number: 1,
      status: "pending",
      next_scheduled_at: scheduledAt,
      metadata: { scheduledDelay: plan.delayMs, createdAt: now.toISOString() },
    });
    if (insertErr) throw new Error(insertErr.message);
    const { error: updErr } = await opts.admin
      .from("inbound_replies")
      .update({ status: "nurture_queued", updated_at: now.toISOString() })
      .eq("id", reply.id);
    if (updErr) throw new Error(updErr.message);
    queued += 1;
  }

  const { data: due, error: dueErr } = await opts.admin
    .from("reply_sequences")
    .select(
      "id, lead_id, reply_id, template_type, status, next_scheduled_at, metadata"
    )
    .eq("status", "pending")
    .lte("next_scheduled_at", now.toISOString());
  if (dueErr) throw new Error(dueErr.message);

  for (const sequence of due ?? []) {
    const { data: reply } = await opts.admin
      .from("inbound_replies")
      .select(
        "id, lead_id, lead_email, sentiment, objection_type, objection_details"
      )
      .eq("id", sequence.reply_id)
      .maybeSingle();
    const { data: lead } = await opts.admin
      .from("leads")
      .select("id, name, company, nurturePaused")
      .eq("id", sequence.lead_id)
      .maybeSingle();
    if (!reply || !lead) {
      skipped += 1;
      planned.push({ sequenceId: sequence.id, action: "skip", reason: "missing_join" });
      continue;
    }
    if (lead.nurturePaused) {
      skipped += 1;
      planned.push({ sequenceId: sequence.id, action: "skip", reason: "nurture_paused" });
      if (opts.mode === "send") {
        await opts.admin
          .from("reply_sequences")
          .update({ status: "paused", updated_at: now.toISOString() })
          .eq("id", sequence.id);
      }
      continue;
    }

    const templateFn = selectTemplate(
      reply.sentiment || "neutral",
      reply.objection_type
    );
    const email = templateFn({
      leadName: lead.name || "there",
      leadCompany: lead.company || undefined,
      objectionDetails: reply.objection_details || undefined,
      calendlyUrl: opts.calendlyUrl,
      pilotPrice: opts.pilotPrice,
    });
    planned.push({
      sequenceId: sequence.id,
      to: reply.lead_email,
      subject: email.subject,
      action: opts.mode === "send" ? "send" : "would_send",
    });
    if (opts.mode !== "send") continue;

    const send = opts.sendEmail ?? sendNurtureEmail;
    const apiKey = opts.resendApiKey || "";
    if (!apiKey) {
      bounced += 1;
      await opts.admin
        .from("reply_sequences")
        .update({
          status: "bounced",
          metadata: { ...(sequence.metadata || {}), error: "RESEND_API_KEY missing" },
          updated_at: now.toISOString(),
        })
        .eq("id", sequence.id);
      continue;
    }
    const result = await send(apiKey, {
      to: reply.lead_email,
      from: opts.fromAddress || "proposals@authichain.com",
      replyTo: "proposals@reply.authichain.com",
      subject: email.subject,
      text: email.body,
    });
    if (result.ok) {
      sent += 1;
      await opts.admin
        .from("reply_sequences")
        .update({
          status: "sent",
          sent_at: now.toISOString(),
          next_scheduled_at: null,
          email_subject: email.subject,
          email_body: email.body,
          metadata: {
            ...(sequence.metadata || {}),
            sentAt: now.toISOString(),
            provider: result.provider,
          },
          updated_at: now.toISOString(),
        })
        .eq("id", sequence.id);
    } else {
      bounced += 1;
      await opts.admin
        .from("reply_sequences")
        .update({
          status: "bounced",
          metadata: { ...(sequence.metadata || {}), error: result.error },
          updated_at: now.toISOString(),
        })
        .eq("id", sequence.id);
    }
  }

  return { mode: opts.mode, queued, sent, bounced, skipped, planned };
}

async function supabaseAdmin(c: NurtureContext) {
  const url =
    envValue(c, "SUPABASE_URL") || envValue(c, "NEXT_PUBLIC_SUPABASE_URL");
  const key = envValue(c, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}

async function handleNurture(c: NurtureContext) {
  const { isCronAuthorized } = await import("../src/lib/cron-auth");
  if (!isCronAuthorized(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const url = new URL(c.req.url);
  const sendEnabled = envValue(c, "NURTURE_SEND_ENABLED") === "true";
  const resolved = resolveNurtureMode(url, sendEnabled);
  const admin = await supabaseAdmin(c);
  if (!admin) return c.json({ error: "Supabase not configured" }, 503);

  try {
    const result = await runNurtureTick({
      admin,
      mode: resolved.mode,
      resendApiKey: envValue(c, "RESEND_API_KEY"),
      fromAddress: envValue(c, "NURTURE_EMAIL_FROM") || "proposals@authichain.com",
      calendlyUrl: envValue(c, "CALENDLY_URL"),
      pilotPrice: envValue(c, "PILOT_PRICE"),
    });
    return c.json({
      success: true,
      held: NURTURE_HELD,
      schedule: NURTURE_SCHEDULE,
      dispatcher: "not_in_CLEARED_JOBS",
      blockedReason: resolved.blockedReason ?? null,
      ...result,
    });
  } catch (err) {
    console.error(
      "[nurture-replies]",
      err instanceof Error ? err.message : err
    );
    return c.json(
      {
        error: "Cron job failed",
        details: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
}

export function registerNurtureReplies(app: Hono<any>) {
  app.get(NURTURE_CRON_PATH, c => handleNurture(c));
  app.post(NURTURE_CRON_PATH, c => handleNurture(c));
}
