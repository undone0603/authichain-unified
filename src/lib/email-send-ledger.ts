/**
 * Once-only send ledger for emails that carry an idempotency key (PM-338 c).
 *
 * Resend dedupes on its `Idempotency-Key` header, but the Gmail SMTP / OAuth
 * fallbacks cannot, and a Resend outage on the first delivery followed by a
 * working Resend on the retry would send twice through two providers. Both
 * send paths (server/email-service.ts, src/lib/email.ts) therefore claim the
 * key here before sending:
 *
 *   - "none"        no key given          -> send as before
 *   - "claimed"     first time            -> send; release() if every provider fails
 *   - "duplicate"   key already sent      -> skip, report duplicate
 *   - "unavailable" no service creds / DB -> Resend may still send (it has its
 *                                            own header); the Gmail fallbacks
 *                                            are skipped (fail closed)
 *
 * The key is stored as SHA-256 hex in public.email_send_ledger (migration
 * 20261009140000), so no event id or address lands in the table.
 */

export type EmailSendClaim = "none" | "claimed" | "duplicate" | "unavailable";

type Creds = { url: string; key: string };

function serviceCreds(): Creds | null {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const url = (
    env?.SUPABASE_URL ||
    env?.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");
  const key = env?.SUPABASE_SERVICE_ROLE_KEY || "";
  return url && key ? { url, key } : null;
}

export async function emailKeyHash(idempotencyKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(idempotencyKey)
  );
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function restHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

export async function claimEmailSend(
  idempotencyKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
  creds: Creds | null = serviceCreds()
): Promise<EmailSendClaim> {
  if (!idempotencyKey) return "none";
  if (!creds) return "unavailable";
  try {
    const res = await fetchImpl(`${creds.url}/rest/v1/email_send_ledger`, {
      method: "POST",
      headers: restHeaders(creds.key),
      body: JSON.stringify({ key_hash: await emailKeyHash(idempotencyKey) }),
    });
    if (res.ok) return "claimed";
    if (res.status === 409) return "duplicate";
    console.warn(`[email-send-ledger] claim failed (HTTP ${res.status})`);
    return "unavailable";
  } catch (err) {
    console.warn(
      `[email-send-ledger] claim failed (${err instanceof Error ? err.message : String(err)})`
    );
    return "unavailable";
  }
}

/** Undo a claim after every provider failed, so a later retry can send. */
export async function releaseEmailSend(
  idempotencyKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
  creds: Creds | null = serviceCreds()
): Promise<void> {
  if (!idempotencyKey || !creds) return;
  try {
    const hash = await emailKeyHash(idempotencyKey);
    await fetchImpl(
      `${creds.url}/rest/v1/email_send_ledger?key_hash=eq.${hash}`,
      { method: "DELETE", headers: restHeaders(creds.key) }
    );
  } catch {
    // Best effort: a stuck claim only blocks a re-send of this one key.
  }
}
