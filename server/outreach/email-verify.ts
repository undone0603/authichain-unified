// server/outreach/email-verify.ts
// Free, open-source email verification via a self-hosted Reacher backend
// (github.com/reacherhq/check-if-email-exists — `docker run -p 8080:8080 reacherhq/backend`).
// Plus B2B email-pattern inference. A "safe" Reacher result proves the mailbox
// accepted the recipient. It does not prove the person published that address.
// Callers must keep source `pattern_guess`. Do not stamp `reacher_verified`:
// that source passes the send-guard.

export type Reachability = "safe" | "risky" | "invalid" | "unknown";

export interface EmailVerification {
  email: string;
  reachable: Reachability;
  isCatchAll: boolean;
  deliverable: boolean; // safe AND not catch-all — the only state we treat as verified
}

const reacherUrl = (): string => process.env.REACHER_URL ?? "http://localhost:8080";

const clean = (s: string): string => (s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const cleanDomain = (domain: string): string =>
  (domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");

/** Common B2B email patterns for a person at a domain, ranked by prevalence. */
export function inferEmailCandidates(firstName: string, lastName: string, domain: string): string[] {
  const f = clean(firstName);
  const l = clean(lastName);
  const d = cleanDomain(domain);
  if (!f || !d) return [];
  const fi = f[0];
  const li = l ? l[0] : "";
  const candidates = l
    ? [
        `${f}.${l}@${d}`,   // first.last  (most common in B2B)
        `${fi}${l}@${d}`,   // flast
        `${f}${l}@${d}`,    // firstlast
        `${f}@${d}`,        // first
        `${f}_${l}@${d}`,   // first_last
        `${fi}.${l}@${d}`,  // f.last
        `${l}.${f}@${d}`,   // last.first
        `${f}${li}@${d}`,   // firstl
      ]
    : [`${f}@${d}`];
  return Array.from(new Set(candidates));
}

/** Verify one address against the self-hosted Reacher backend. Network failure => 'unknown'. */
export async function verifyEmail(email: string): Promise<EmailVerification> {
  try {
    const res = await fetch(`${reacherUrl()}/v1/check_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: email }),
    });
    if (!res.ok) return { email, reachable: "unknown", isCatchAll: false, deliverable: false };
    const j = (await res.json()) as { is_reachable?: Reachability; smtp?: { is_catch_all?: boolean } };
    const reachable: Reachability = j.is_reachable ?? "unknown";
    const isCatchAll = Boolean(j.smtp?.is_catch_all);
    return { email, reachable, isCatchAll, deliverable: reachable === "safe" && !isCatchAll };
  } catch {
    return { email, reachable: "unknown", isCatchAll: false, deliverable: false };
  }
}

/**
 * Infer likely addresses and return the first deliverable one.
 * Deliverable is not a trusted send source. Returns null when none are
 * deliverable, including catch-all domains.
 */
export async function findVerifiedEmail(
  firstName: string,
  lastName: string,
  domain: string,
): Promise<EmailVerification | null> {
  for (const candidate of inferEmailCandidates(firstName, lastName, domain)) {
    const v = await verifyEmail(candidate);
    if (v.deliverable) return v;
  }
  return null;
}
