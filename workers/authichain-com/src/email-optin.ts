/**
 * Optional email opt-in for the free checks (PM P2, Advisor YES 2026-10-23 9:08 PM ET).
 *
 * - Optional: the free checks never call this; it is a separate POST.
 * - Consent must be explicitly "yes" (box starts unchecked in the UI).
 * - Stores only email, consent timestamp, status, and a SHA-256 hash of the
 *   confirmation token in AuthiChain's D1 (authichain-db), not QRON-v2.
 * - Unconfirmed rows older than 30 days are purged on every write.
 * - Double opt-in email: NOT SENT YET. authichain-com has no $0 email-sending
 *   binding today (see PR body). Rows stay "pending" until that is approved,
 *   and are purged after 30 days. GET /api/email-optin/confirm is ready.
 */

export const EMAIL_OPTIN_PATH = "/api/email-optin";
export const EMAIL_OPTIN_CONFIRM_PATH = "/api/email-optin/confirm";

/** [RESEARCH TO CHECK — placeholder wording, no claims] */
export const EMAIL_OPTIN_CONSENT_TEXT =
  "[PLACEHOLDER — Research to check] Optional: email me AuthiChain product updates, at most once a month. I can unsubscribe any time. We will first send one email asking you to confirm.";
export const EMAIL_OPTIN_PRIVACY_LINE =
  'We store only your email, when you agreed, and whether you confirmed. Unconfirmed emails are deleted after 30 days. See the <a href="/privacy">privacy policy</a>.';

export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}

export const PURGE_SQL =
  "DELETE FROM email_optins WHERE status = 'pending' AND consent_at < datetime('now','-30 days')";
const UPSERT_SQL =
  "INSERT INTO email_optins (email, consent_at, status, token_hash) VALUES (?1, ?2, 'pending', ?3) " +
  "ON CONFLICT(email) DO UPDATE SET consent_at = excluded.consent_at, token_hash = excluded.token_hash WHERE email_optins.status = 'pending'";
const CONFIRM_SQL =
  "UPDATE email_optins SET status = 'confirmed', token_hash = NULL WHERE token_hash = ?1 AND status = 'pending' AND consent_at >= datetime('now','-30 days')";

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;

export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v);
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Returns null when the path is not ours. Datetimes are SQLite UTC text. */
export async function tryHandleEmailOptin(
  request: Request,
  db: D1Like | undefined,
  now: Date = new Date()
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === EMAIL_OPTIN_CONFIRM_PATH) {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    const token = url.searchParams.get("token") || "";
    if (!db || !/^[a-f0-9]{64}$/.test(token)) return json({ ok: false }, 400);
    await db.prepare(CONFIRM_SQL).bind(await sha256Hex(token)).run();
    // Same reply whether or not a row matched: no email enumeration.
    return new Response("<!doctype html><title>AuthiChain</title><p>Thanks. If this link was valid, your email is confirmed.</p>", {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (url.pathname !== EMAIL_OPTIN_PATH) return null;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: Record<string, unknown> = {};
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) body = (await request.json()) as Record<string, unknown>;
    else body = Object.fromEntries((await request.formData()).entries());
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) return json({ ok: false, error: "invalid_email" }, 400);
  if (body.consent !== "yes" && body.consent !== true && body.consent !== "on")
    return json({ ok: false, error: "consent_required" }, 400);
  if (!db) return json({ ok: false, error: "unavailable" }, 503);
  const raw = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const consentAt = now.toISOString().replace("T", " ").slice(0, 19);
  await db.prepare(PURGE_SQL).bind().run();
  await db.prepare(UPSERT_SQL).bind(email, consentAt, await sha256Hex(raw)).run();
  // Double opt-in send intentionally absent until a $0 sender is approved.
  return json({ ok: true, status: "pending" }, 202);
}

/** Small optional block for free-check pages. Separate form: the check never depends on it. */
export function emailOptinBlock(id: string): string {
  return `<form class="email-optin" id="${id}" action="${EMAIL_OPTIN_PATH}" method="post">
  <label for="${id}-email">Email (optional)</label>
  <input type="email" id="${id}-email" name="email" maxlength="254" autocomplete="email">
  <label class="small"><input type="checkbox" name="consent" value="yes"> ${EMAIL_OPTIN_CONSENT_TEXT}</label>
  <p class="small">${EMAIL_OPTIN_PRIVACY_LINE}</p>
  <button type="submit">Save my email</button>
</form>`;
}
