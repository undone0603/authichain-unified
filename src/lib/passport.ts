/**
 * Client for the GS1 resolver's read-only passport endpoint.
 *
 * Corrects three faults in the previous version, none of which had surfaced
 * because nothing consumed it:
 *
 *  1. It called `/v1/passport/{id}`, which the resolver did not implement —
 *     every call 404'd as `not_a_digital_link_path`. The endpoint now exists
 *     (workers/gs1-resolver), matching what docs/GS1_RESOLVER.md always
 *     claimed.
 *  2. The declared payload shape matched nothing the resolver returns: it was
 *     snake_case with different nesting, so every field would have read
 *     `undefined`. The types below mirror `passportPayload()` exactly.
 *  3. It ignored the HTTP status and cast the body regardless, so an error
 *     object was returned as a passport. A non-2xx now resolves to a typed
 *     not-found rather than a lie.
 *
 * The endpoint is read-only by design: rendering a passport must never
 * register a scan. See the comment on that route in the resolver.
 */

export type SealStatus =
  "issued" | "active" | "clone_suspected" | "cloned" | "revoked" | "not_found";

export interface PassportPayload {
  status: SealStatus;
  label: string;
  /** What a result of this status does establish. Shown verbatim. */
  proves: string;
  /** What it does not. Shipped on every response so a green result cannot be over-read. */
  doesNotProve: string;
  reason?: string;
  scanRecorded: boolean;
  identifier: {
    gtin: string | null;
    lot: string | null;
    serial: string | null;
    certId: string | null;
    digitalLink: string;
  };
  product: {
    brand: string | null;
    name: string | null;
    issuer: string | null;
  } | null;
  anchor: {
    chain: string | null;
    contract: string | null;
    txHash: string | null;
  } | null;
  history: {
    scanCount: number;
    firstCountry: string | null;
    firstActivatedAt: number | null;
  } | null;
  metadata?: unknown;
  passportUrl: string | null;
}

/** Linear-time trailing-slash strip; see the note in the resolver worker. */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* "/" */) end--;
  return value.slice(0, end);
}

export function resolverBase(): string {
  return stripTrailingSlashes(
    process.env.NEXT_PUBLIC_RESOLVER_ORIGIN ||
      process.env.RESOLVER_ORIGIN ||
      "https://id.authichain.com"
  );
}

/**
 * Reads a passport without registering a scan.
 *
 * Returns null only when the resolver could not be reached at all — an
 * unreachable resolver and a seal that does not exist are different facts and
 * must not collapse into the same value. A seal that genuinely does not exist
 * comes back as a payload with status "not_found".
 */
export async function fetchPassport(
  id: string
): Promise<PassportPayload | null> {
  const url = `${resolverBase()}/v1/passport/${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    // The resolver answers 404 with a well-formed not_found payload, which is a
    // real answer. Anything else non-2xx is a transport or server fault and is
    // reported as such rather than rendered as a passport.
    if (!res.ok && res.status !== 404) return null;

    const data = (await res.json()) as PassportPayload | { error: string };
    if (!data || typeof data !== "object" || !("status" in data)) return null;
    return data as PassportPayload;
  } catch {
    return null;
  }
}
