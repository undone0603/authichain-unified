// server/outreach/recipient-rules.ts
// Pure recipient-provenance rules shared by every outreach sender. No Node or
// network imports, so both the Node scripts (via send-guard.ts) and Cloudflare
// Workers (authichain-outreach-engine) apply the same rules.
//
// The core defense against blasting fabricated / pattern-guessed addresses
// (e.g. scraped "bernard.arnault@lvmh.com") is PROVENANCE, not deliverability:
// a guessed address passes an MX check because the domain is real. So we only
// send to recipients whose source is trusted.

export type VerificationSource =
  | "apollo_verified"
  | "reacher_verified" // deliverable + non-catch-all per self-hosted Reacher (free OSS)
  | "inbound_optin"
  | "confirmed_reply"
  /**
   * The counterparty published this address itself for exactly this purpose —
   * e.g. the point-of-contact printed on a SAM.gov solicitation. That is a
   * different thing from a guess that happens to look plausible: the owner
   * chose to publish it, so it is neither fabricated nor scraped from an
   * unrelated context.
   */
  | "published_contact"
  | "pattern_guess"
  | "scraped"
  | "unknown";

export const TRUSTED_SOURCES: ReadonlySet<VerificationSource> = new Set([
  "apollo_verified",
  "reacher_verified",
  "inbound_optin",
  "confirmed_reply",
  "published_contact",
]);

// Generic/role inboxes — reject for cold end-buyer segments so we don't hit
// support queues (the info@ auto-responder problem). Channel-partner desks
// are the exception: those companies publish contact@ / info@ / hello@ as
// the partnership inbox. Callers must pass `allowRoleInbox` explicitly;
// trusted provenance alone is not enough.
const ROLE_LOCALPARTS = new Set([
  "info",
  "support",
  "help",
  "contact",
  "sales",
  "admin",
  "hello",
  "billing",
  "noreply",
  "no-reply",
  "team",
  "office",
]);

export function isRoleInboxEmail(email: string): boolean {
  const local = (email || "").trim().toLowerCase().split("@")[0] ?? "";
  return ROLE_LOCALPARTS.has(local);
}

export type AssessRecipientOptions = {
  /**
   * Permit a role inbox when the source is already trusted. Only the
   * channel-partner path sets this — govchain / strainchain / qron / all
   * must keep role inboxes rejected.
   */
  allowRoleInbox?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RecipientAssessment {
  email: string;
  source: VerificationSource;
  validFormat: boolean;
  trustedSource: boolean;
  isRoleInbox: boolean;
  status: "allow" | "reject";
  reasons: string[];
}

/** Pure provenance + format assessment (no network). */
export function assessRecipient(
  email: string,
  source: VerificationSource,
  opts: AssessRecipientOptions = {}
): RecipientAssessment {
  const reasons: string[] = [];
  const normalized = (email || "").trim().toLowerCase();
  const validFormat = EMAIL_RE.test(normalized);
  if (!validFormat) reasons.push("invalid_format");

  const isRoleInbox = isRoleInboxEmail(normalized);
  const roleInboxBlocked = isRoleInbox && opts.allowRoleInbox !== true;
  if (roleInboxBlocked) reasons.push("role_inbox");

  const trustedSource = TRUSTED_SOURCES.has(source);
  if (!trustedSource) reasons.push(`untrusted_source:${source}`);

  const status: "allow" | "reject" =
    validFormat && trustedSource && !roleInboxBlocked ? "allow" : "reject";

  return {
    email: normalized,
    source,
    validFormat,
    trustedSource,
    isRoleInbox,
    status,
    reasons,
  };
}

export function canSend(a: RecipientAssessment): boolean {
  return a.status === "allow";
}
