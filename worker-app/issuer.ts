import { timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import { createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import {
  signAttestation,
  type AuthiChainAttestationV01,
} from "../packages/verifier/src/index";
import {
  resolveAttestationKey,
  type AttestationEnv,
} from "./jwks";

export type IssuerEnv = AttestationEnv & {
  CRON_SECRET?: string;
};

const ISSUER_HEADERS = {
  "Cache-Control": "private, no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST",
};

const JWKS_URL = "https://authichain.com/protocol/jwks.json";
const ISSUER_ID = "https://authichain.com";
const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const OIDC_AUDIENCE = "https://authichain.com";
const ALLOWED_REPOS = new Set(["undone0603/authichain-unified"]);
const GITHUB_ACTIONS_JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

const NO_STORE = { "Cache-Control": "private, no-store" };

function readCronSecret(env?: IssuerEnv): string | undefined {
  const proc = typeof process !== "undefined" ? process.env : undefined;
  return env?.CRON_SECRET || proc?.CRON_SECRET;
}

function timingSafeTokenEquals(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      const padded = Buffer.alloc(b.length);
      a.copy(padded, 0, 0, Math.min(a.length, b.length));
      cryptoTimingSafeEqual(padded, b);
      return false;
    }
    return cryptoTimingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) return null;
  return parts[1];
}

export function isAllowedGithubOidcPayload(
  payload: Record<string, unknown>,
): boolean {
  return (
    typeof payload.repository === "string" &&
    ALLOWED_REPOS.has(payload.repository)
  );
}

export async function authorizeIssuerRequest(
  authorization: string | undefined,
  env?: IssuerEnv,
): Promise<{ ok: true; via: "cron" | "github-oidc" } | { ok: false; error: string }> {
  const token = bearerToken(authorization);
  if (!token) return { ok: false, error: "missing bearer token" };

  const cron = readCronSecret(env);
  if (cron && timingSafeTokenEquals(token, cron)) {
    return { ok: true, via: "cron" };
  }

  try {
    const { payload } = await jwtVerify(token, GITHUB_ACTIONS_JWKS, {
      issuer: OIDC_ISSUER,
      audience: OIDC_AUDIENCE,
    });
    if (isAllowedGithubOidcPayload(payload as Record<string, unknown>)) {
      return { ok: true, via: "github-oidc" };
    }
    return { ok: false, error: "oidc repository not allowed" };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

function sha256Hex(value: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(value))
    .then((buf) =>
      [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""),
    );
}

function sanitizeRunId(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  return cleaned || "manual";
}

type LaunchBody = {
  runId?: string;
  gitSha?: string;
  subject?: {
    object_id?: string;
    gtin?: string;
    serial?: string;
  };
};

function parseLaunchBody(input: unknown): LaunchBody {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const value = input as Record<string, unknown>;
  const subject =
    value.subject && typeof value.subject === "object" && !Array.isArray(value.subject)
      ? (value.subject as Record<string, unknown>)
      : {};
  return {
    runId: typeof value.runId === "string" ? value.runId : undefined,
    gitSha: typeof value.gitSha === "string" ? value.gitSha : undefined,
    subject: {
      object_id:
        typeof subject.object_id === "string" ? subject.object_id : undefined,
      gtin: typeof subject.gtin === "string" ? subject.gtin : undefined,
      serial: typeof subject.serial === "string" ? subject.serial : undefined,
    },
  };
}

export function registerIssuerRoutes<
  E extends IssuerEnv,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  app.get("/protocol/issuer.json", async (c) => {
    const resolved = await resolveAttestationKey(c.env);
    if (!resolved.ok) {
      return c.json(
        {
          ready: false,
          signing: false,
          error: resolved.error,
          jwks: JWKS_URL,
          issuer: ISSUER_ID,
        },
        503,
        NO_STORE,
      );
    }
    return c.json(
      {
        contract: "AuthiChain Attestation Contract v0.1",
        alg: "EdDSA",
        crv: "Ed25519",
        kid: resolved.key.kid,
        issuer: ISSUER_ID,
        jwks: JWKS_URL,
        ready: true,
        signing: Boolean(resolved.key.privatePem),
      },
      200,
      ISSUER_HEADERS,
    );
  });

  app.post("/protocol/launch-proof", async (c) => {
    const auth = await authorizeIssuerRequest(
      c.req.header("authorization"),
      c.env,
    );
    if (!auth.ok) {
      return c.json({ error: auth.error }, 401, NO_STORE);
    }

    const resolved = await resolveAttestationKey(c.env);
    if (!resolved.ok || !resolved.key.privatePem) {
      return c.json(
        { error: "attestation signing key unavailable" },
        503,
        NO_STORE,
      );
    }

    let rawBody: unknown = {};
    try {
      if (c.req.header("content-type")?.includes("application/json")) {
        rawBody = await c.req.json();
      }
    } catch {
      return c.json({ error: "invalid JSON body" }, 400, NO_STORE);
    }
    const body = parseLaunchBody(rawBody);
    const objectId = body.subject?.object_id?.trim() || "";
    if (!objectId || objectId.length > 200) {
      return c.json({ error: "subject.object_id is required" }, 400, NO_STORE);
    }
    const gtin = body.subject?.gtin?.trim();
    if (gtin && !/^\d{8,14}$/.test(gtin)) {
      return c.json({ error: "subject.gtin must contain 8-14 digits" }, 400, NO_STORE);
    }
    const serial = body.subject?.serial?.trim()?.slice(0, 80);
    const runId = sanitizeRunId(body.runId);
    const gitSha = (body.gitSha || "unknown").replace(/[^A-Fa-f0-9]/g, "").slice(0, 40) || "unknown";
    const digest = await sha256Hex(`${objectId}|${runId}|${gitSha}`);

    const attestation: AuthiChainAttestationV01 = {
      version: "0.1",
      attestation_id: `urn:authichain:attestation:v01:launch-${runId}`,
      issuer: { id: ISSUER_ID, name: "AuthiChain" },
      subject: {
        object_id: objectId,
        ...(gtin ? { gtin } : {}),
        ...(serial ? { serial } : {}),
      },
      decision: "verified",
      status: "active",
      issued_at: new Date().toISOString(),
      expires_at: "2027-12-31T00:00:00Z",
      evidence: [
        {
          id: "launch-proof",
          type: "production-launch",
          digest: `sha256:${digest}`,
        },
      ],
    };

    try {
      const privateKey = await importPKCS8(resolved.key.privatePem, "EdDSA");
      const jws = await signAttestation(
        attestation,
        privateKey,
        resolved.key.kid,
      );
      return c.json(
        {
          jws,
          kid: resolved.key.kid,
          jwksUrl: JWKS_URL,
          source: "authichain-edge-router",
          via: auth.via,
        },
        200,
        NO_STORE,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "sign failed";
      return c.json({ error: "attestation sign failed", detail: message }, 500, NO_STORE);
    }
  });
}
