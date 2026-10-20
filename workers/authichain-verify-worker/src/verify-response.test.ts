// @vitest-environment node
import { createHash, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signPassport } from "../../../protocol/passport.mjs";
import { signingBytes } from "../../../protocol/verifier.mjs";
import worker, { type Env } from "./index";
import { expectedRecordHash } from "./protocol-verify.mjs";

// RES-145 / PM-394: /api/verify must not present 0x4da4…72BE as AuthiChain's
// contract. Nobody has shown we control it, so polygon.contract is null.
const env = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  NEXT_PUBLIC_SITE_URL: "https://authichain.com",
} as Env;

describe("/api/verify polygon block", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns polygon.contract null for the published demonstration record", async () => {
    // No network in tests: JWKS and RPC reads fail closed.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const res = await worker.fetch(
      new Request("https://authichain.com/api/verify?id=polygon-anchor-1"),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { polygon?: { contract?: unknown } };
    expect(body.polygon).toBeDefined();
    expect(body.polygon!.contract).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/0x4da4D2675e52374639C9c954f4f653887A9972BE/i);
    expect(Object.hasOwn(body, "hashPublication")).toBe(false);
  });

  it("returns a hash publication row when the receipt contains the signing-bytes hash", async () => {
    const { record, anchor, hash, txHash } = signedPassport();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { body?: string }) => {
        const request = init?.body ? (JSON.parse(init.body) as { method?: string }) : {};
        if (request.method === "eth_getTransactionByHash") {
          return Response.json({
            result: { input: "0x" + hash, from: "0xabc", to: "0xabc" },
          });
        }
        if (request.method === "eth_getTransactionReceipt") {
          return Response.json({ result: { status: "0x1", blockNumber: "0x10" } });
        }
        return Response.json({ keys: [] });
      }),
    );
    const res = await worker.fetch(
      new Request("https://authichain.com/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record, anchor }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      genuine?: boolean;
      anchored?: boolean;
      hashPublication?: { type?: string; signingBytesSha256?: string; txHash?: string };
      polygon?: { contract?: unknown };
      product?: unknown;
    };
    expect(body.genuine).toBe(true);
    expect(body.anchored).toBe(true);
    expect(body.product).toBeNull();
    expect(body.polygon?.contract).toBeNull();
    expect(body.hashPublication).toEqual({
      type: "hash_publication",
      signingBytesSha256: "sha256:" + hash,
      txHash,
    });
    expect(JSON.stringify(body.hashPublication)).not.toMatch(/genuine/);
  });

  it("leaves the hash publication off when the anchor transaction was not read", async () => {
    const { record, anchor } = signedPassport();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const res = await worker.fetch(
      new Request("https://authichain.com/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record, anchor }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { genuine?: boolean; anchored?: boolean; hashPublication?: unknown };
    expect(body.genuine).toBe(true);
    expect(body.anchored).toBe(false);
    expect(body.hashPublication).toBeUndefined();
  });
});

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buf: Buffer): string {
  let num = BigInt("0x" + (buf.toString("hex") || "0"));
  let out = "";
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

function signedPassport() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const issuer = "did:key:z" + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  const record = signPassport({
    digitalIdentity: "urn:authichain:item:example-1",
    privateKey,
    issuer,
  });
  const hash = expectedRecordHash(record);
  const signingHash = createHash("sha256").update(signingBytes(record)).digest("hex");
  const txHash = "0x" + "cd".repeat(32);
  const anchor = {
    recordHash: "sha256:" + signingHash,
    chain: "polygon:137",
    txHash,
    anchoredAt: "2026-01-01T00:05:00Z",
  };
  return { record, anchor, hash, txHash };
}
