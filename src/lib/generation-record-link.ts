/**
 * Carry a generation record in a URL fragment.
 * The fragment is not sent to the server. CompressionStream is WebCrypto-era
 * Web Platform, so this runs in a browser or a Worker. No node:crypto.
 */
import type { ProtocolRecord } from "./generation-seal";

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(token: string): Uint8Array<ArrayBuffer> {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function asRecord(value: unknown): ProtocolRecord | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as ProtocolRecord;
  if (!parsed.proof?.proofValue || !parsed.credentialSubject || !parsed.issuer) return null;
  return parsed;
}

export async function encodeRecord(record: ProtocolRecord): Promise<string> {
  const stream = new Blob([JSON.stringify(record)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToB64url(bytes);
}

export async function decodeRecord(token: string): Promise<ProtocolRecord | null> {
  try {
    const raw = b64urlToBytes(token);
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const parsed = JSON.parse(await new Response(stream).text()) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

/** Fragment a check page can read without this browser's storage. */
export async function recordFragment(record: ProtocolRecord): Promise<string> {
  return `#r=${await encodeRecord(record)}`;
}
