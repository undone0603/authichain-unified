/**
 * DOGFOOD-IDENTITY-V1 signing hook (NOT MOUNTED).
 *
 * POST /api/v1/bot-sign            sign exact bot output bytes with that bot's key
 * GET  /api/v1/.well-known/bot-jwks.json  active bot public keys (from the repo registry)
 *
 * registerBotSignerRoutes() is deliberately not called from index.ts in this
 * PR. Mounting it, and binding the secrets below, is Zac's step.
 *
 * Secrets (wrangler secret put --name <worker>; names only, values never in repo):
 *   DOGFOOD_BOT_KEY_<BOT>   Ed25519 PKCS#8 private key (base64 DER or PEM), one per bot.
 *                           Lives only here. Bots never see it.
 *   DOGFOOD_SIGNER_TOKENS   JSON {"<bot>": "<sha256 hex of that bot's bearer token>"}.
 *                           Bots hold only their bearer token; it can request a
 *                           signature but cannot reveal or export the key.
 * Var:
 *   DOGFOOD_SIGNER_ENABLED  "1" to turn the endpoint on. Anything else = 503.
 *
 * Fails closed: any missing secret, unknown bot, inactive key, key that does
 * not match the registry, or bad token returns an error and no signature.
 */
import { timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import registryJson from "../protocol/dogfood/registry.json";

export type BotRegistryEntry = {
  bot: string;
  channels: string[];
  status: "pending" | "active" | "revoked";
  kid: string | null;
  publicJwk: { kty: string; crv: string; x: string; kid: string } | null;
  secret_name: string;
};

export type BotRegistry = { v: string; jwks_url: string; bots: BotRegistryEntry[] };

export type BotSignerEnv = Record<string, string | undefined>;

const PAYLOAD_VERSION = "aco-bot-sig/1";
const MAX_CONTENT_BYTES = 100_000;
const NO_STORE = { "Cache-Control": "private, no-store" };

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hex(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

/** JCS for the flat payload (string and integer values only). Cross-checked against protocol/verifier.mjs in tests. */
export function canonicalFlat(obj: Record<string, string | number>): string {
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${JSON.stringify(obj[k])}`)
      .join(",") +
    "}"
  );
}

function pkcs8Der(raw: string): Uint8Array {
  let text = raw.trim();
  if (!text.includes("BEGIN PRIVATE KEY")) {
    try {
      const decoded = atob(text.replace(/\s+/g, ""));
      if (decoded.includes("BEGIN PRIVATE KEY")) text = decoded;
    } catch {
      /* raw DER base64 */
    }
  }
  const b64 = text
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function envOf(env?: BotSignerEnv): BotSignerEnv {
  const proc = typeof process !== "undefined" ? (process.env as BotSignerEnv) : {};
  return { ...proc, ...(env ?? {}) };
}

async function tokenMatches(provided: string, expectedHex: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) return false;
  const got = Buffer.from(hex(await sha256(new TextEncoder().encode(provided))), "utf8");
  const want = Buffer.from(expectedHex, "utf8");
  return got.length === want.length && timingSafeEqual(got, want);
}

export type SignResult =
  | { ok: true; envelope: { alg: "EdDSA"; payload: Record<string, string | number>; sig: string } }
  | { ok: false; status: number; error: string };

export async function signBotOutput(
  input: { bot?: unknown; channel?: unknown; content?: unknown; authorization?: string },
  rawEnv?: BotSignerEnv,
  registry: BotRegistry = registryJson as BotRegistry,
  now: () => Date = () => new Date(),
): Promise<SignResult> {
  const env = envOf(rawEnv);
  if (env.DOGFOOD_SIGNER_ENABLED !== "1") return { ok: false, status: 503, error: "signer disabled" };

  const { bot, channel, content } = input;
  if (typeof bot !== "string" || typeof channel !== "string" || typeof content !== "string") {
    return { ok: false, status: 400, error: "bot, channel, content (string) required" };
  }
  const bytes = new TextEncoder().encode(content);
  if (bytes.length > MAX_CONTENT_BYTES) return { ok: false, status: 413, error: "content too large" };

  const entry = registry.bots.find((b) => b.bot === bot);
  if (!entry || entry.status !== "active" || !entry.kid || !entry.publicJwk) {
    return { ok: false, status: 403, error: "bot key not active" };
  }
  if (!entry.channels.includes(channel)) return { ok: false, status: 403, error: "channel not allowed" };

  const token = (input.authorization ?? "").match(/^Bearer (\S+)$/)?.[1];
  let tokens: Record<string, string> = {};
  try {
    tokens = JSON.parse(env.DOGFOOD_SIGNER_TOKENS ?? "{}");
  } catch {
    return { ok: false, status: 503, error: "signer tokens misconfigured" };
  }
  if (!token || !tokens[bot] || !(await tokenMatches(token, tokens[bot]))) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const rawKey = env[entry.secret_name];
  if (!rawKey) return { ok: false, status: 503, error: "bot key not bound" };

  let key: CryptoKey;
  try {
    const der = pkcs8Der(rawKey);
    const extractable = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
    const jwk = (await crypto.subtle.exportKey("jwk", extractable)) as JsonWebKey;
    if (jwk.x !== entry.publicJwk.x) return { ok: false, status: 500, error: "bound key does not match registry" };
    key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
  } catch {
    return { ok: false, status: 503, error: "bot key invalid" };
  }

  const payload = {
    v: PAYLOAD_VERSION,
    bot,
    channel,
    kid: entry.kid,
    content_sha256: hex(await sha256(bytes)),
    content_bytes: bytes.length,
    ts: now().toISOString(),
    nonce: hex(crypto.getRandomValues(new Uint8Array(16))),
  };
  const sig = await crypto.subtle.sign(
    { name: "Ed25519" },
    key,
    new TextEncoder().encode(canonicalFlat(payload)),
  );
  return { ok: true, envelope: { alg: "EdDSA", payload, sig: b64url(sig) } };
}

export function registerBotSignerRoutes<E extends { Bindings: BotSignerEnv }>(
  app: Hono<E>,
  registry: BotRegistry = registryJson as BotRegistry,
): void {
  app.get("/api/v1/.well-known/bot-jwks.json", (c) => {
    const keys = registry.bots.filter((b) => b.status === "active" && b.publicJwk).map((b) => ({
      ...b.publicJwk,
      use: "sig",
      alg: "EdDSA",
    }));
    return c.json({ keys }, 200, { "Cache-Control": "public, max-age=300" });
  });

  app.post("/api/v1/bot-sign", async (c) => {
    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "json body required" }, 400, NO_STORE);
    }
    const r = await signBotOutput(
      { ...body, authorization: c.req.header("Authorization") },
      c.env as BotSignerEnv,
      registry,
    );
    if (!r.ok) return c.json({ error: r.error }, r.status as 400, NO_STORE);
    console.log(
      JSON.stringify({ evt: "bot-sign", bot: r.envelope.payload.bot, kid: r.envelope.payload.kid, content_sha256: r.envelope.payload.content_sha256 }),
    );
    return c.json({ envelope: r.envelope }, 200, NO_STORE);
  });
}
