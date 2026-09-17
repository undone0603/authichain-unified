import type { Hono } from "hono";
import {
  calculateJwkThumbprint,
  exportJWK,
  importPKCS8,
} from "jose";

export type AttestationEnv = {
  AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64?: string;
  AUTHICHAIN_ATTESTATION_KEY_ID?: string;
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

function readKeyMaterial(env: AttestationEnv): {
  raw?: string;
  kid?: string;
} {
  const proc =
    typeof process !== "undefined" ? process.env : undefined;
  return {
    raw: env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 || proc?.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64,
    kid: env.AUTHICHAIN_ATTESTATION_KEY_ID || proc?.AUTHICHAIN_ATTESTATION_KEY_ID,
  };
}

async function jwksResponse(
  env: AttestationEnv,
  headers: Record<string, string>
): Promise<{
  body: Record<string, unknown>;
  status: 200 | 503;
  headers: Record<string, string>;
}> {
  const { raw, kid: configuredKid } = readKeyMaterial(env);
  if (!raw) {
    return {
      body: { error: "attestation key unavailable" },
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    };
  }
  try {
    const key = await importPKCS8(attestationPkcs8Pem(raw), "EdDSA");
    const jwk = await exportJWK(key);
    const { d: _d, ...publicJwk } = jwk;
    const kid = configuredKid || (await calculateJwkThumbprint(publicJwk));
    return {
      body: { keys: [{ ...publicJwk, kid, use: "sig", alg: "EdDSA" }] },
      status: 200,
      headers,
    };
  } catch {
    return {
      body: { error: "attestation key unavailable" },
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    };
  }
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
