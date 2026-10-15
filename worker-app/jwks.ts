import type { Hono } from "hono";
import { calculateJwkThumbprint } from "jose";

export type AttestationEnv = {
  AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64?: string;
  AUTHICHAIN_ATTESTATION_KEY_ID?: string;
  AUTHICHAIN_ATTESTATION_PUBLIC_JWK?: string;
  /**
   * JSON array of public Ed25519 JWKs that no longer sign but still verify
   * what they signed, each with an explicit `kid`. This is what makes key
   * rotation non-destructive. Removing a key from this list is how a
   * compromised key is distrusted: everything it signed becomes indeterminate.
   */
  AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS?: string;
};

export type VerificationKey = PublicOkp & {
  kid: string;
  key_status: "current" | "retired";
};

export type PublicOkp = {
  kty: string;
  crv?: string;
  x?: string;
  kid?: string;
  use?: string;
  alg?: string;
};

export type ResolvedAttestationKey = {
  kid: string;
  publicJwk: PublicOkp;
  privatePem: string | null;
};

const JWKS_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
};

const PROTOCOL_JWKS_HEADERS = {
  "Cache-Control": "private, no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
};

export function attestationPkcs8Pem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) return trimmed;
  // Docs/CI store base64(PEM). Also accept raw PKCS#8 DER base64.
  try {
    const decoded = atob(trimmed.replace(/\s+/g, ""));
    if (decoded.includes("BEGIN PRIVATE KEY")) return decoded.trim();
  } catch {
    /* not utf8 PEM */
  }
  const der = trimmed.replace(/\s+/g, "");
  const wrapped = der.match(/.{1,64}/g)?.join("\n") ?? der;
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
}

function readKeyMaterial(env?: AttestationEnv): {
  raw?: string;
  kid?: string;
  publicJwk?: string;
} {
  const proc =
    typeof process !== "undefined" ? process.env : undefined;
  return {
    raw: env?.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 || proc?.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64,
    kid: env?.AUTHICHAIN_ATTESTATION_KEY_ID || proc?.AUTHICHAIN_ATTESTATION_KEY_ID,
    publicJwk: env?.AUTHICHAIN_ATTESTATION_PUBLIC_JWK || proc?.AUTHICHAIN_ATTESTATION_PUBLIC_JWK,
  };
}

function parsePublicJwk(raw: string): PublicOkp | null {
  try {
    const jwk = JSON.parse(raw) as PublicOkp & { d?: unknown };
    if (jwk && jwk.kty === "OKP" && typeof jwk.x === "string") {
      const { d: _d, ...pub } = jwk;
      return pub;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function pemToPkcs8Der(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function publicJwkFromPem(pem: string): Promise<PublicOkp> {
  // Workers WebCrypto (and Node 22) accept Ed25519, not the JWS name EdDSA.
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8Der(pem),
    { name: "Ed25519" },
    true,
    ["sign"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const { d: _d, key_ops: _ops, ext: _ext, ...pub } = jwk as JsonWebKey;
  return pub as PublicOkp;
}

export async function resolveAttestationKey(
  env?: AttestationEnv,
): Promise<
  | { ok: true; key: ResolvedAttestationKey }
  | { ok: false; error: string; reason?: string; via?: string }
> {
  const { raw, kid: configuredKid, publicJwk } = readKeyMaterial(env);
  const fromSecret = publicJwk ? parsePublicJwk(publicJwk) : null;
  const privatePem = raw ? attestationPkcs8Pem(raw) : null;
  if (!fromSecret && !privatePem) {
    return { ok: false, error: "attestation key unavailable" };
  }
  try {
    const pub =
      fromSecret || (await publicJwkFromPem(privatePem as string));
    if (pub.kty !== "OKP" || typeof pub.x !== "string") {
      throw new Error("not an OKP public JWK");
    }
    const { d: _d, ...safe } = pub as PublicOkp & { d?: unknown };
    const kid =
      configuredKid || safe.kid || (await calculateJwkThumbprint(safe));
    return {
      ok: true,
      key: {
        kid,
        publicJwk: { ...safe, kid, use: "sig", alg: "EdDSA" },
        privatePem,
      },
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    return {
      ok: false,
      error: "attestation key unavailable",
      reason: "invalid",
      via: name,
    };
  }
}

/**
 * Retired verification keys. Fail closed per entry: an entry without a kid,
 * that is not an Ed25519 OKP key, or that carries private material (`d`) is
 * dropped, and unparsable JSON drops the whole list. Fewer keys only ever
 * means more attestations come back indeterminate, never fewer.
 */
function readRetiredKeys(env?: AttestationEnv): PublicOkp[] {
  const proc = typeof process !== "undefined" ? process.env : undefined;
  const raw =
    env?.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS ||
    proc?.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS;
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { keys?: unknown })?.keys)
      ? (parsed as { keys: unknown[] }).keys
      : [];
  const out: PublicOkp[] = [];
  for (const entry of list) {
    const jwk = entry as Record<string, unknown> | null;
    if (!jwk || typeof jwk !== "object") continue;
    if ("d" in jwk) continue;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519") continue;
    if (typeof jwk.x !== "string" || !jwk.x) continue;
    if (typeof jwk.kid !== "string" || !jwk.kid.trim()) continue;
    out.push({
      kty: "OKP",
      crv: "Ed25519",
      x: jwk.x,
      kid: jwk.kid.trim(),
      use: "sig",
      alg: "EdDSA",
    });
  }
  return out;
}

/**
 * Every key a verifier may accept: the current signing key first, then the
 * retired ones. A retired entry that reuses the current kid, or repeats an
 * earlier kid, is dropped, so one kid always names one key.
 */
export async function resolveVerificationKeys(
  env?: AttestationEnv,
): Promise<
  | { ok: true; keys: VerificationKey[] }
  | { ok: false; error: string; reason?: string; via?: string }
> {
  const current = await resolveAttestationKey(env);
  const retired = readRetiredKeys(env);
  if (!current.ok && retired.length === 0) return current;
  const keys: VerificationKey[] = [];
  const seen = new Set<string>();
  if (current.ok) {
    keys.push({ ...current.key.publicJwk, kid: current.key.kid, key_status: "current" });
    seen.add(current.key.kid);
  }
  for (const jwk of retired) {
    const kid = jwk.kid as string;
    if (seen.has(kid)) continue;
    seen.add(kid);
    keys.push({ ...jwk, kid, key_status: "retired" });
  }
  return { ok: true, keys };
}

/** Pick the verification key a compact JWS names in its protected header. */
export function selectVerificationKey(
  jws: string,
  keys: VerificationKey[],
): { ok: true; key: VerificationKey } | { ok: false; error: string } {
  const head = jws.split(".")[0] ?? "";
  let kid: unknown;
  try {
    const json = atob(head.replace(/-/g, "+").replace(/_/g, "/"));
    kid = (JSON.parse(json) as { kid?: unknown }).kid;
  } catch {
    return { ok: false, error: "invalid compact JWS header" };
  }
  if (typeof kid !== "string" || !kid) {
    return { ok: false, error: "attestation JWS kid is required" };
  }
  const key = keys.find(k => k.kid === kid);
  if (!key) {
    return { ok: false, error: "attestation JWS kid is not a known verification key" };
  }
  return { ok: true, key };
}

/** The public form of a verification key, as JWKS publishes it. */
export function publicJwkOf(key: VerificationKey): PublicOkp {
  const { key_status: _status, ...jwk } = key;
  return jwk;
}

async function jwksResponse(
  env: AttestationEnv,
  headers: Record<string, string>
): Promise<{
  body: Record<string, unknown>;
  status: 200 | 503;
  headers: Record<string, string>;
}> {
  const resolved = await resolveAttestationKey(env);
  if (!resolved.ok) {
    return {
      body: {
        error: resolved.error,
        ...(resolved.reason ? { reason: resolved.reason } : {}),
        ...(resolved.via ? { via: resolved.via } : {}),
      },
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    };
  }
  const all = await resolveVerificationKeys(env);
  const keys = all.ok ? all.keys.map(publicJwkOf) : [resolved.key.publicJwk];
  return {
    body: { keys },
    status: 200,
    headers,
  };
}

export function registerJwksRoute<
  E extends AttestationEnv,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  const mount = (path: string, headers: Record<string, string>) => {
    app.get(path, async c => {
      const out = await jwksResponse(c.env, headers);
      return c.json(out.body, out.status, out.headers);
    });
  };
  mount("/.well-known/jwks.json", JWKS_HEADERS);
  mount("/protocol/jwks.json", PROTOCOL_JWKS_HEADERS);
}
