/**
 * One email per recipient, across runs and across scripts.
 *
 * Resend shows inquiries@moo.com emailed five times and xyra@scry.io twice in
 * September 2026, and franchiseinfo@fastsigns.com retried after it bounced.
 * The only dedupe was a `leads.status = 'contacted'` check inside one script
 * plus hand-maintained lists (QRON_ALREADY_SENT, PARTNER_ALREADY_SENT) added
 * after each duplicate had already gone out. A flush, another channel, or a
 * rewritten lead row could each miss it.
 *
 * This checks the durable records every live send already leaves behind:
 *
 *   - guardrail_suppression_list: opt-outs, bounces, and (from now on) every
 *     address we have emailed, written by recordContact() after a send.
 *   - guardrail_events: `record` events with reason "sent" carry the address
 *     in metadata.email, going back to before this check existed.
 *   - leads: status "contacted".
 *
 * Fails closed: if history cannot be read, the answer is "do not send".
 */

type Admin = { from: (table: string) => any };

export interface PriorContact {
  blocked: boolean;
  reason?: string;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function priorContact(
  admin: Admin,
  email: string
): Promise<PriorContact> {
  const address = normalize(email);
  try {
    const suppressed = await admin
      .from("guardrail_suppression_list")
      .select("reason")
      .eq("email", address)
      .maybeSingle();
    if (suppressed.error) throw suppressed.error;
    if (suppressed.data) {
      return { blocked: true, reason: `suppressed: ${suppressed.data.reason}` };
    }

    const sent = await admin
      .from("guardrail_events")
      .select("created_at")
      .eq("action", "record")
      .eq("allowed", true)
      .eq("reason", "sent")
      .ilike("metadata->>email", escapeIlike(address))
      .limit(1);
    if (sent.error) throw sent.error;
    if (sent.data?.length) {
      return {
        blocked: true,
        reason: `already_emailed: ${sent.data[0].created_at ?? "date unknown"}`,
      };
    }

    const lead = await admin
      .from("leads")
      .select("status")
      .ilike("email", escapeIlike(address))
      .eq("status", "contacted")
      .limit(1);
    if (lead.error) throw lead.error;
    if (lead.data?.length) {
      return { blocked: true, reason: "already_emailed: lead marked contacted" };
    }

    return { blocked: false };
  } catch (err: any) {
    return {
      blocked: true,
      reason: `send_history_unavailable: ${err?.message ?? String(err)}`,
    };
  }
}

/** Called after a successful send so no later run, flush or script emails the address again. */
export async function recordContact(
  admin: Admin,
  email: string,
  channel: string
): Promise<void> {
  const { error } = await admin.from("guardrail_suppression_list").upsert(
    {
      email: normalize(email),
      reason: `contacted ${new Date().toISOString().slice(0, 10)} via ${channel}`,
      source: channel,
    },
    { onConflict: "email", ignoreDuplicates: true }
  );
  if (error) {
    // The guardrail_events "sent" record still blocks a repeat, so this is
    // loud rather than fatal.
    console.error(
      `::warning::Could not record contact for ${email}: ${error.message}`
    );
  }
}
