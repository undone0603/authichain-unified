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

export function attestationPkcs8Pem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) return trimmed;
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

export function registerJwksRoute<
  E extends AttestationEnv,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  app.get("/.well-known/jwks.json", async c => {
    const { raw, kid: configuredKid } = readKeyMaterial(c.env);
    if (!raw) {
      return c.json({ error: "attestation key unavailable" }, 503);
    }
    try {
      const key = await importPKCS8(attestationPkcs8Pem(raw), "EdDSA");
      const jwk = await exportJWK(key);
      const { d: _d, ...publicJwk } = jwk;
      const kid = configuredKid || (await calculateJwkThumbprint(publicJwk));
      return c.json({
        keys: [{ ...publicJwk, kid, use: "sig", alg: "EdDSA" }],
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "attestation key unavailable",
        },
        503
      );
    }
  });
}
