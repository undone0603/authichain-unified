// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerBotSignerRoutes, signBotOutput, canonicalFlat, type BotRegistry } from "./bot-signer";
import { canonicalize } from "../protocol/verifier.mjs";
import {
  verifyBotOutput,
  jwkThumbprint,
  botKeySecretName,
  PINNED_JWKS_URL,
} from "../protocol/dogfood/bot-output.mjs";

const TOKEN = "test-bearer-token-not-a-secret";
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");

function setup(status: "active" | "pending" = "active") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "jwk" }) as { x: string; kty: string; crv: string };
  const kid = jwkThumbprint(pub);
  const registry: BotRegistry = {
    v: "aco-bot-registry/1",
    jwks_url: PINNED_JWKS_URL,
    bots: [
      {
        bot: "grok-bot",
        channels: ["internal-dryrun", "x"],
        status,
        kid: status === "active" ? kid : null,
        publicJwk: status === "active" ? { kty: "OKP", crv: "Ed25519", x: pub.x, kid } : null,
        secret_name: botKeySecretName("grok-bot"),
      },
    ],
  };
  const env = {
    DOGFOOD_SIGNER_ENABLED: "1",
    DOGFOOD_SIGNER_TOKENS: JSON.stringify({ "grok-bot": TOKEN_HASH }),
    DOGFOOD_BOT_KEY_GROK_BOT: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  };
  return { registry, env };
}

const NOW = new Date("2026-10-09T16:00:00.000Z");
const req = { bot: "grok-bot", channel: "x", content: "hello, exact bytes\n", authorization: `Bearer ${TOKEN}` };

describe("signBotOutput", () => {
  it("signs, and the repo's reference verifier passes it (end to end)", async () => {
    const { registry, env } = setup();
    const r = await signBotOutput(req, env, registry, () => NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = verifyBotOutput(req.content, r.envelope, registry, { now: NOW, ledgerTs: NOW.toISOString() });
    expect(v).toMatchObject({ ok: true, reasons: [] });
    // tampered copy must FAIL
    expect(verifyBotOutput(req.content + "!", r.envelope, registry, { now: NOW }).ok).toBe(false);
  });

  it("worker canonical form equals the reference JCS", async () => {
    const p = { v: "aco-bot-sig/1", bot: "b", content_bytes: 3, ts: "t", nonce: "n", kid: "k", channel: "x", content_sha256: "h" };
    expect(canonicalFlat(p)).toBe(canonicalize(p));
  });

  it("is off unless DOGFOOD_SIGNER_ENABLED=1", async () => {
    const { registry, env } = setup();
    const r = await signBotOutput(req, { ...env, DOGFOOD_SIGNER_ENABLED: undefined }, registry);
    expect(r).toMatchObject({ ok: false, status: 503 });
  });

  it("rejects a wrong or missing bearer token", async () => {
    const { registry, env } = setup();
    expect(await signBotOutput({ ...req, authorization: "Bearer nope" }, env, registry)).toMatchObject({ status: 401 });
    expect(await signBotOutput({ ...req, authorization: undefined }, env, registry)).toMatchObject({ status: 401 });
  });

  it("rejects pending bots and unregistered channels", async () => {
    const pending = setup("pending");
    expect(await signBotOutput(req, pending.env, pending.registry)).toMatchObject({ status: 403 });
    const { registry, env } = setup();
    expect(await signBotOutput({ ...req, channel: "email" }, env, registry)).toMatchObject({ status: 403 });
  });

  it("fails closed when the bound key is missing or does not match the registry", async () => {
    const { registry, env } = setup();
    expect(await signBotOutput(req, { ...env, DOGFOOD_BOT_KEY_GROK_BOT: undefined }, registry)).toMatchObject({ status: 503 });
    const other = setup();
    expect(await signBotOutput(req, { ...env, DOGFOOD_BOT_KEY_GROK_BOT: other.env.DOGFOOD_BOT_KEY_GROK_BOT }, registry)).toMatchObject({ status: 500 });
  });
});

describe("registerBotSignerRoutes", () => {
  it("serves only active public keys at the pinned path, never private material", async () => {
    const { registry } = setup();
    const app = new Hono();
    registerBotSignerRoutes(app, registry);
    const res = await app.request("/api/v1/.well-known/bot-jwks.json");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keys: Array<Record<string, string>> };
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]).not.toHaveProperty("d");
    expect(body.keys[0].kid).toBe(registry.bots[0].kid);
  });

  it("is not mounted in the live worker (mounting is Zac's step)", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(index).not.toContain("registerBotSignerRoutes");
  });
});
