import type { Hono } from "hono";
import { importPKCS8 } from "jose";
import {
  publicJwkFromPrivateKey,
  signAttestation,
  validateAttestation,
  verifyAttestationJws,
} from "../packages/verifier/src/index";
import { resolveAttestationKey, type AttestationEnv } from "./jwks";

const NO_STORE = { "Cache-Control": "private, no-store" };

async function loadPrivateKey(env?: AttestationEnv) {
  const resolved = await resolveAttestationKey(env);
  if (!resolved.ok || !resolved.key.privatePem) {
    throw new Error("attestation signing key unavailable");
  }
  const privateKey = await importPKCS8(resolved.key.privatePem, "EdDSA");
  return {
    privateKey,
    kid: resolved.key.kid,
    publicJwk: resolved.key.publicJwk,
  };
}

const ATTESTATION_INDEX = {
  ok: true,
  contract: "AuthiChain Attestation Contract",
  version: "0.1",
  methods: {
    POST: "sign a v0.1 attestation",
    PUT: "verify a compact JWS",
    "POST /verify": "verify a compact JWS",
  },
  jwks: "/.well-known/jwks.json",
  canonical: "/api/v1/attestation",
};

export function registerAttestationApi<
  E extends AttestationEnv,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  const rewrite = (
    c: { req: { url: string; raw: Request }; env: E },
    path: string
  ) => {
    const url = new URL(c.req.url);
    url.pathname = path;
    return app.fetch(new Request(url.toString(), c.req.raw), c.env);
  };

  app.get("/api/v1/attestation", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));
  app.get("/api/attest", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));
  app.get("/api/attestations", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));

  app.post("/api/attest", c => rewrite(c, "/api/v1/attestation"));
  app.put("/api/attest", c => rewrite(c, "/api/v1/attestation"));
  app.post("/api/attestations", c => rewrite(c, "/api/v1/attestation"));
  app.put("/api/attestations", c => rewrite(c, "/api/v1/attestation"));
  app.post("/api/attest/verify", c => rewrite(c, "/api/v1/attestation/verify"));
  app.post("/api/attestations/verify", c =>
    rewrite(c, "/api/v1/attestation/verify")
  );

  app.post("/api/v1/attestation", async c => {
    try {
      const body = await c.req.json();
      const attestation = validateAttestation(body);
      const { privateKey, kid } = await loadPrivateKey(c.env);
      const jws = await signAttestation(attestation, privateKey, kid);
      return c.json(
        {
          contract: "AuthiChain Attestation Contract",
          version: "0.1",
          attestation,
          jws,
          kid,
        },
        200,
        NO_STORE
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "invalid attestation";
      const status = message.includes("unavailable") ? 503 : 400;
      return c.json({ error: message }, status, NO_STORE);
    }
  });

  app.put("/api/v1/attestation", async c => {
    try {
      const body = await c.req.json();
      const jws = body?.jws;
      if (typeof jws !== "string") throw new Error("jws is required");
      const { publicJwk } = await loadPrivateKey(c.env);
      const attestation = await verifyAttestationJws(jws, publicJwk);
      return c.json(
        {
          valid: true,
          contract: "AuthiChain Attestation Contract",
          version: "0.1",
          attestation,
        },
        200,
        NO_STORE
      );
    } catch (error) {
      return c.json(
        {
          valid: false,
          error: error instanceof Error ? error.message : "invalid signature",
        },
        400,
        NO_STORE
      );
    }
  });

  app.post("/api/v1/attestation/verify", async c => {
    try {
      const body = await c.req.json();
      const jws = body?.jws;
      if (typeof jws !== "string") throw new Error("jws is required");
      const resolved = await resolveAttestationKey(c.env);
      if (!resolved.ok) {
        return c.json({ valid: false, error: resolved.error }, 503, NO_STORE);
      }
      const attestation = await verifyAttestationJws(
        jws,
        resolved.key.publicJwk
      );
      return c.json({ valid: true, attestation }, 200, NO_STORE);
    } catch (error) {
      return c.json(
        {
          valid: false,
          error: error instanceof Error ? error.message : "invalid signature",
        },
        400,
        NO_STORE
      );
    }
  });
}
