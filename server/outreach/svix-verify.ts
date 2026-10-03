// server/outreach/svix-verify.ts
//
// Verify a Resend webhook. Resend signs webhooks with Svix: HMAC-SHA256 over
// `${svix-id}.${svix-timestamp}.${raw body}`, keyed with the base64 bytes after
// the `whsec_` prefix of the endpoint's signing secret, sent as one or more
// space-separated `v1,<base64>` entries in `svix-signature`. Web Crypto only,
// so it runs on the Worker. The raw body must be verified before it is parsed.

const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function svixSignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string
): Promise<string> {
  const keyBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`)
  );
  return bytesToBase64(new Uint8Array(mac));
}

export type SvixCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "missing_headers" | "stale_timestamp" | "bad_signature";
    };

export async function verifySvix(opts: {
  secret: string;
  id: string | null | undefined;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  body: string;
  now?: number;
}): Promise<SvixCheck> {
  const { id, timestamp, signature } = opts;
  if (!id || !timestamp || !signature)
    return { ok: false, reason: "missing_headers" };
  const ts = Number(timestamp);
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }
  let expected: string;
  try {
    expected = await svixSignature(opts.secret, id, timestamp, opts.body);
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  const match = signature
    .split(" ")
    .map(part => part.split(",", 2))
    .some(
      ([version, sig]) =>
        version === "v1" && !!sig && constantTimeEqual(sig, expected)
    );
  return match ? { ok: true } : { ok: false, reason: "bad_signature" };
}
