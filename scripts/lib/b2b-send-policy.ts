/** Live QRON inboxes already emailed 2026-09-20. Do not send again. */
export const QRON_ALREADY_SENT = [
  "franchiseinfo@fastsigns.com",
  "inquiries@moo.com",
] as const;

/** Unpublished leftover drafts from older target lists. Do not flush. */
export const QRON_UNPUBLISHED_DRAFTS = [
  "product@moo.com",
  "innovation@fastsigns.com",
] as const;

/**
 * Channel-partner desks already Resend-sent (twice) on 2026-09-20.
 * Hard-block so the next MAX_LIVE_SENDS=2 pair is NEMC APEX, not Existo/ICS.
 */
export const PARTNER_ALREADY_SENT = [
  "contact@existosolutions.com",
  "info@icsconsultingservice.com",
] as const;

export function normalizeLeadEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAlreadyContacted(
  status: string | null | undefined,
): boolean {
  return status === "contacted";
}

export function shouldNotLiveResend(email: string): boolean {
  const normalized = normalizeLeadEmail(email);
  return (
    (QRON_ALREADY_SENT as readonly string[]).includes(normalized) ||
    (QRON_UNPUBLISHED_DRAFTS as readonly string[]).includes(normalized) ||
    (PARTNER_ALREADY_SENT as readonly string[]).includes(normalized)
  );
}

/** Case-insensitive contacted-row check. Empty / other-email rows do not block. */
export function existingLeadBlocksLiveSend(
  rows: ReadonlyArray<{ email?: string | null; status?: string | null }>,
  email: string,
): boolean {
  const normalized = normalizeLeadEmail(email);
  return rows.some(
    (row) =>
      normalizeLeadEmail(String(row.email ?? "")) === normalized &&
      isAlreadyContacted(row.status),
  );
}

/** Never write a lead backward from contacted to draft/queued. */
export function nextLeadWriteStatus(
  existing: string | null | undefined,
  intended: string,
): string {
  return isAlreadyContacted(existing) ? "contacted" : intended;
}
