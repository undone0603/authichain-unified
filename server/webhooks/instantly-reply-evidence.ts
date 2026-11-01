/**
 * Classify an Instantly reply notification for human review. A webhook event
 * alone is not authenticated proof that a person replied or opted in, and
 * must never advance a CRM lead or trigger outreach automatically.
 */
export type ReplyReview = { status: "review" | "reject"; reason: string; sourceId?: string };

export function assessInstantlyReply(payload: Record<string, unknown>): ReplyReview {
  if (payload.event !== "email_replied") return { status: "reject", reason: "not_reply" };
  const sourceId = [payload.reply_id, payload.message_id, payload.email_id]
    .find(v => typeof v === "string" && v.trim().length > 0);
  if (typeof sourceId !== "string") return { status: "reject", reason: "missing_source_id" };
  if (payload.is_auto_reply === true || payload.is_bounce === true) {
    return { status: "reject", reason: "automated_or_bounced" };
  }
  const text = [payload.reply_text, payload.reply_body, payload.text]
    .find(v => typeof v === "string" && v.trim().length >= 5);
  if (typeof text !== "string") return { status: "reject", reason: "missing_reply_content" };
  const subject = typeof payload.subject === "string" ? payload.subject : "";
  const blob = `${subject}\n${text}`;
  if (/\b(out of office|automatic (?:reply|response)|auto.?reply|away from (?:my )?office|delivery (?:failed|failure)|undeliverable|mail delivery subsystem|message blocked|mailbox unavailable)\b/i.test(blob)) {
    return { status: "reject", reason: "automatic_or_delivery_failure" };
  }
  // Even a signed event with content is only a candidate. A separate verified
  // inbound/opt-in evidence record is needed before marking a warm reply.
  return { status: "review", reason: "candidate_requires_human_verification", sourceId };
}
