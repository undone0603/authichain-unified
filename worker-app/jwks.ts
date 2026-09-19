import type { Hono } from "hono";
import { calculateJwkThumbprint } from "jose";

export type AttestationEnv = {
  AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64?: string;
  AUTHICHAIN_ATTESTATION_KEY_ID?: string;
  AUTHICHAIN_ATTESTATION_PUBLIC_JWK?: string;
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
  return {
    body: { keys: [resolved.key.publicJwk] },
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
