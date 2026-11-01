/**
 * Instantly v2 uses event_type/lead_email (not event/email). Normalize the
 * legacy aliases without treating vendor engagement as verified human consent.
 * https://help.instantly.ai/en/articles/6261906-webhooks
 */
export type ReplyReview = { status: "review" | "reject"; reason: string; sourceId?: string };

export function normalizeInstantlyEvent(payload: Record<string, unknown>) {
  const raw = payload.event_type ?? payload.event;
  const aliases: Record<string, string> = {
    email_replied: "reply_received",
    email_clicked: "link_clicked",
    email_link_clicked: "link_clicked",
  };
  const eventType = typeof raw === "string" ? (aliases[raw] ?? raw) : "";
  const rawEmail = payload.lead_email ?? payload.email;
  const email = typeof rawEmail === "string" && rawEmail.includes("@")
    ? rawEmail.trim().toLowerCase() : null;
  return { eventType, email };
}

/** A stable best-effort dedupe key, never a lead+event-only key that loses later replies. */
export function getInstantlyEventKey(payload: Record<string, unknown>): string | null {
  const explicit = payload.webhook_id ?? payload.event_id;
  if (typeof explicit === "string" && explicit.trim()) return "instantly:" + explicit.trim();
  const { eventType, email } = normalizeInstantlyEvent(payload);
  const timestamp = payload.timestamp;
  if (!eventType || !email || typeof timestamp !== "string" || !timestamp.trim()) return null;
  const campaign = typeof payload.campaign_id === "string" ? payload.campaign_id : "";
  const message = typeof payload.email_id === "string" ? payload.email_id : "";
  return ["instantly", eventType, email, campaign, timestamp, message].join(":");
}

export function assessInstantlyReply(payload: Record<string, unknown>): ReplyReview {
  const { eventType } = normalizeInstantlyEvent(payload);
  if (["auto_reply_received", "email_bounced", "lead_out_of_office"].includes(eventType)) {
    return { status: "reject", reason: "automated_or_bounced" };
  }
  if (eventType !== "reply_received") return { status: "reject", reason: "not_reply" };
  const sourceId = [payload.reply_id, payload.message_id, payload.email_id]
    .find(v => typeof v === "string" && v.trim().length > 0);
  if (typeof sourceId !== "string") return { status: "reject", reason: "missing_source_id" };
  if (payload.is_auto_reply === true || payload.is_bounce === true) {
    return { status: "reject", reason: "automated_or_bounced" };
  }
  const replyText = [payload.reply_text, payload.reply_text_snippet, payload.reply_body, payload.text]
    .find(v => typeof v === "string" && v.trim().length >= 5);
  if (typeof replyText !== "string") return { status: "reject", reason: "missing_reply_content" };
  const subject = typeof payload.reply_subject === "string" ? payload.reply_subject
    : typeof payload.subject === "string" ? payload.subject : "";
  const blob = subject + "\n" + replyText;
  if (/\b(out of office|automatic (?:reply|response)|auto.?reply|away from (?:my )?office|delivery (?:failed|failure)|undeliverable|mail delivery subsystem|message blocked|mailbox unavailable)\b/i.test(blob)) {
    return { status: "reject", reason: "automatic_or_delivery_failure" };
  }
  // Authenticated vendor delivery is NOT proof of a human reply or opt-in.
  return { status: "review", reason: "candidate_requires_human_verification", sourceId };
}
