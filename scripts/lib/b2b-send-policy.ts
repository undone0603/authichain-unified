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

export function isAlreadyContacted(
  status: string | null | undefined,
): boolean {
  return status === "contacted";
}

export function shouldNotLiveResend(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (
    (QRON_ALREADY_SENT as readonly string[]).includes(normalized) ||
    (QRON_UNPUBLISHED_DRAFTS as readonly string[]).includes(normalized)
  );
}
