import { createHash, createHmac } from "crypto";

/** Deterministic JSON: object keys sorted, Dates as ISO strings, undefined dropped. */
export function canonicalize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export interface EvidenceBundle<T> {
  generatedAt: string;
  payload: T;
  /** sha256 of canonicalize(payload), hex. Always present. */
  digest: string;
  /** HMAC-SHA256 of the digest, hex. Present only when EVIDENCE_SIGNING_KEY is set. */
  signature: string | null;
  signatureAlgorithm: "HMAC-SHA256" | null;
}

/**
 * Wraps a payload with a digest (tamper-evidence) and, when a server key is
 * configured, an HMAC signature (authenticity: only AuthiChain can produce it).
 * Verify by recomputing canonicalize(payload) -> sha256 -> compare / HMAC.
 */
export function buildEvidenceBundle<T>(
  payload: T,
  opts: { now?: Date; signingKey?: string } = {}
): EvidenceBundle<T> {
  const key = opts.signingKey ?? process.env.EVIDENCE_SIGNING_KEY;
  const digest = createHash("sha256").update(canonicalize(payload)).digest("hex");
  return {
    generatedAt: (opts.now ?? new Date()).toISOString(),
    payload,
    digest,
    signature: key ? createHmac("sha256", key).update(digest).digest("hex") : null,
    signatureAlgorithm: key ? "HMAC-SHA256" : null,
  };
}
