// server/outreach/unsubscribe-link.ts
//
// Signed one-click opt-out links for cold email. No Node imports: the same
// module signs links in scripts (Node, via guardedSend) and verifies them on
// the edge router (worker-app/unsubscribe-routes.ts), so the two can never
// disagree about the token format.
//
// Why this exists. Until now a script send without UNSUBSCRIBE_URL carried only
// `mailto:<reply-to>?subject=unsubscribe`, and nothing deployed read those
// replies into the suppression list the send gate checks
// (guardrail_suppression_list). A signed link lets the recipient opt out in one
// click, and the edge writes that list directly.
//
// Token: first 32 hex chars of HMAC-SHA256(OUTREACH_UNSUBSCRIBE_SECRET,
// "authichain-unsubscribe:v1:" + normalized address). The prefix keeps the MAC
// from being reusable for anything else signed with the same secret.

export const UNSUBSCRIBE_PATH = "/api/outreach/unsubscribe";
export const UNSUBSCRIBE_CHECK_PATH = "/api/outreach/unsubscribe/check";
export const DEFAULT_UNSUBSCRIBE_ORIGIN = "https://authichain.com";
/**
 * The only address the check endpoint accepts. `.invalid` is reserved
 * (RFC 2606), so it can never belong to a recipient.
 */
export const UNSUBSCRIBE_CHECK_EMAIL = "optout-check@authichain.invalid";

const TOKEN_PREFIX = "authichain-unsubscribe:v1:";
const TOKEN_HEX_LENGTH = 32;

export function normalizeOptOutEmail(email: string): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

async function hmacHex(secret: string, text: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(mac)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function unsubscribeToken(
  secret: string,
  email: string
): Promise<string> {
  if (!secret) throw new Error("unsubscribe secret is required");
  const mac = await hmacHex(secret, TOKEN_PREFIX + normalizeOptOutEmail(email));
  return mac.slice(0, TOKEN_HEX_LENGTH);
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function verifyUnsubscribeToken(
  secret: string,
  email: string,
  token: string
): Promise<boolean> {
  if (!secret || !email || !token) return false;
  const expected = await unsubscribeToken(secret, email);
  return constantTimeEqual(String(token).toLowerCase(), expected);
}

export async function signedUnsubscribeUrl(opts: {
  secret: string;
  email: string;
  origin?: string;
}): Promise<string> {
  const origin = (opts.origin || DEFAULT_UNSUBSCRIBE_ORIGIN).replace(
    /\/+$/,
    ""
  );
  const email = normalizeOptOutEmail(opts.email);
  const t = await unsubscribeToken(opts.secret, email);
  return `${origin}${UNSUBSCRIBE_PATH}?e=${encodeURIComponent(email)}&t=${t}`;
}

/** URL the pre-send check calls: proves the edge holds the same secret, writes nothing. */
export async function unsubscribeCheckUrl(opts: {
  secret: string;
  origin?: string;
}): Promise<string> {
  const origin = (opts.origin || DEFAULT_UNSUBSCRIBE_ORIGIN).replace(
    /\/+$/,
    ""
  );
  const t = await unsubscribeToken(opts.secret, UNSUBSCRIBE_CHECK_EMAIL);
  return `${origin}${UNSUBSCRIBE_CHECK_PATH}?e=${encodeURIComponent(UNSUBSCRIBE_CHECK_EMAIL)}&t=${t}`;
}
