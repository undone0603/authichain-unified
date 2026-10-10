/**
 * Client for the GS1 resolver's read-only passport endpoint.
 *
 * The passport remains a resolution/evidence surface. Protocol truth comes from
 * the canonical attestation worker, exposed below as verifyPassportAttestation().
 */

import {
  verifyWithCanonicalWorker,
  type CanonicalVerificationResponse,
} from "../../packages/verifier/src/canonical-worker-client";

export type SealStatus =
  "issued" | "active" | "clone_suspected" | "cloned" | "revoked" | "not_found";

export interface PassportPayload {
  status: SealStatus;
  label: string;
  proves: string;
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
  product: { brand: string | null; name: string | null; issuer: string | null } | null;
  anchor: { chain: string | null; contract: string | null; txHash: string | null } | null;
  fingerprint: {
    digest: string;
    source: "issuer_supplied";
    verified: false;
    caveat: string;
  } | null;
  history: {
    scanCount: number;
    firstCountry: string | null;
    firstActivatedAt: number | null;
  } | null;
  metadata?: unknown;
  passportUrl: string | null;
  verification?: CanonicalVerificationResponse;
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end--;
  return value.slice(0, end);
}

export function resolverBase(): string {
  return stripTrailingSlashes(
    process.env.NEXT_PUBLIC_RESOLVER_ORIGIN ||
      process.env.RESOLVER_ORIGIN ||
      "https://id.authichain.com"
  );
}

export async function fetchPassport(id: string): Promise<PassportPayload | null> {
  const url = `${resolverBase()}/v1/passport/${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok && res.status !== 404) return null;
    const data = (await res.json()) as PassportPayload | { error: string };
    if (!data || typeof data !== "object" || !("status" in data)) return null;
    return data as PassportPayload;
  } catch {
    return null;
  }
}

/**
 * Resolve a DPP's signed attestation through the canonical worker and return
 * the actual protocol response. A passport renderer must use this result for
 * authenticity decisions; local DPP metadata is not a substitute.
 */
export async function verifyPassportAttestation(params: {
  jws: string;
  expectedObjectId?: string;
  endpoint?: string;
}): Promise<{ httpStatus: number; response: CanonicalVerificationResponse }> {
  const endpoint = params.endpoint ?? process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
  if (!endpoint) throw new Error("AUTHICHAIN_CANONICAL_VERIFY_URL not configured");
  return verifyWithCanonicalWorker(endpoint, params.jws, params.expectedObjectId);
}
