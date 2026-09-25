// @vitest-environment node
/**
 * authichain-api is a service-worker style script (globals, addEventListener),
 * so it is loaded into a node:vm context with a mocked fetch that plays the
 * role of Supabase PostgREST and the Polygon JSON-RPC endpoint.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { generateKeyPairSync, webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  path.join(import.meta.dirname, "index.js"),
  "utf8"
);

type Call = { url: string; method: string; body: unknown; headers: Headers };
type Handler = (call: Call) => Response | Promise<Response> | undefined;

const TX = "0x" + "ab".repeat(32);
const CONTRACT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";

const PRODUCT = {
  id: "a1000001-0001-4000-a000-000000000001",
  name: "Test Watch",
  description: null,
  brand: "Acme",
  category: "luxury",
  image_url: null,
  truemark_id: "TM-TEST-0001",
  sku: "SKU-1",
  serial_number: null,
  blockchain_tx_hash: TX,
  blockchain_hash: null,
  nft_token_id: null,
  nft_contract_address: null,
  counterfeit_reports: 0,
  data_origin: "attributed",
  status: "active",
  is_registered: true,
  industry_id: "luxury",
  created_at: "2026-01-01T00:00:00Z",
  story: null,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeSigningKey(): { b64: string; x: string } {
  const pair = generateKeyPairSync("ed25519");
  const pem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  const pub = pair.publicKey.export({ format: "jwk" }) as { x: string };
  return { b64: Buffer.from(String(pem)).toString("base64"), x: pub.x };
}

function loadWorker(
  globals: Record<string, string>,
  handler: Handler
): { calls: Call[]; request: (p: string, init?: RequestInit) => Promise<Response> } {
  const calls: Call[] = [];
  let listener: ((e: unknown) => void) | null = null;
  const fetchMock = async (input: string, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      method: init.method || "GET",
      body: init.body ? JSON.parse(String(init.body)) : null,
      headers: new Headers(init.headers),
    };
    calls.push(call);
    const res = await handler(call);
    return res || json({ message: "unmocked " + call.url }, 404);
  };
  const context = vm.createContext({
    addEventListener: (_type: string, fn: (e: unknown) => void) => {
      listener = fn;
    },
    fetch: fetchMock,
    Response,
    Request,
    Headers,
    URL,
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    AbortSignal,
    console,
    ...globals,
  });
  vm.runInContext(SOURCE, context);
  const request = (p: string, init: RequestInit = {}) =>
    new Promise<Response>((resolve, reject) => {
      if (!listener) throw new Error("no fetch listener");
      listener({
        request: new Request("https://authichain-api.test" + p, init),
        respondWith: (r: Promise<Response>) => r.then(resolve, reject),
      });
    });
  return { calls, request };
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

const KEY = "ac_live_0123456789abcdef0123456789abcdef";

function supabase(opts: {
  products?: unknown[];
  receipt?: unknown;
  resolve?: unknown[] | "missing";
  createStatus?: number;
}): Handler {
  return (call) => {
    const u = new URL(call.url);
    if (u.host === "polygon.test")
      return json({ jsonrpc: "2.0", id: 1, result: opts.receipt ?? null });
    if (u.host !== "nhdnkzhtadfkkluiulhs.supabase.co") return undefined;
    if (u.pathname === "/rest/v1/rpc/authichain_api_resolve_key") {
      if (opts.resolve === "missing") return json({ code: "PGRST202" }, 404);
      return json(opts.resolve ?? [{ id: "c1", billing_plan: "pro", company_name: "Acme", api_call_limit: 1000, user_id: null }]);
    }
    if (u.pathname === "/rest/v1/rpc/authichain_api_create_key")
      return json(
        opts.createStatus && opts.createStatus >= 300
          ? { message: "boom" }
          : "c2",
        opts.createStatus || 200
      );
    if (u.pathname === "/rest/v1/products") return json(opts.products ?? []);
    if (u.pathname === "/rest/v1/verifications")
      return new Response(null, { status: 201 });
    return undefined;
  };
}

function verify(req: (p: string, i?: RequestInit) => Promise<Response>, serial: string) {
  return req("/api/v1/verify", {
    method: "POST",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ serial }),
  });
}

describe("authichain-api verify", () => {
  let signing: { b64: string; x: string };
  beforeEach(() => {
    signing = makeSigningKey();
  });

  it("queries real columns (no tenant_id) and does not fuzzy match", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({ products: [] }));
    const res = await verify(w.request, "tm-test-0001");
    const body = await res.json();
    expect(body.status).toBe("not_found");
    expect(body.verified).toBe(false);
    const productCalls = w.calls.filter((c) => c.url.includes("/rest/v1/products"));
    expect(productCalls).toHaveLength(1);
    const q = decodeURIComponent(productCalls[0].url);
    expect(q).not.toContain("tenant_id");
    expect(q).not.toContain("ilike");
    expect(q).toContain('truemark_id.eq."TM-TEST-0001"');
    expect(q).toContain('serial_number.eq."tm-test-0001"');
    expect(q).toContain('sku.eq."TM-TEST-0001"');
  });

  it("rejects identifiers that could inject PostgREST syntax", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await verify(w.request, 'x",id.neq.0');
    expect(res.status).toBe(400);
  });

  it("registered product without confirmed anchor is not verified, and is signed", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon", CERT_SIGNING_KEY: signing.b64 },
      supabase({ products: [PRODUCT] })
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(body.status).toBe("unverified");
    expect(body.verified).toBe(false);
    const anchor = body.evidence.find((c: { id: string }) => c.id === "onchain_anchor");
    expect(anchor.passed).toBe(false);
    expect(anchor.detail).toContain("unchecked");
    expect(body.trust_score).toBe(45); // registered+unit+attributed+no reports
    expect(body.certificate.alg).toBe("EdDSA");

    // Signature verifies against the published JWKS.
    const jwks = await (await w.request("/api/v1/.well-known/jwks.json")).json();
    expect(jwks.keys[0].x).toBe(signing.x);
    expect(jwks.keys[0].d).toBeUndefined();
    expect(jwks.keys[0].kid).toBe(body.certificate.kid);
    const [h, p, s] = body.certificate.jws.split(".");
    const pub = await webcrypto.subtle.importKey(
      "jwk",
      { kty: "OKP", crv: "Ed25519", x: jwks.keys[0].x },
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const ok = await webcrypto.subtle.verify(
      { name: "Ed25519" },
      pub,
      b64urlDecode(s),
      new TextEncoder().encode(h + "." + p)
    );
    expect(ok).toBe(true);
    const payload = JSON.parse(b64urlDecode(p).toString("utf8"));
    expect(payload.result.verified).toBe(false);
    expect(payload.product.id).toBe(PRODUCT.id);
    expect(JSON.parse(b64urlDecode(h).toString("utf8")).kid).toBe(jwks.keys[0].kid);
  });

  it("verifies only with a confirmed receipt to the anchor contract", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        CERT_SIGNING_KEY: signing.b64,
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      supabase({
        products: [PRODUCT],
        receipt: { status: "0x1", to: CONTRACT.toLowerCase(), blockNumber: "0x10" },
      })
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(body.verified).toBe(true);
    expect(body.status).toBe("verified");
    expect(body.trust_score).toBe(95);
    expect(body.blockchain.anchor_status).toBe("confirmed");
    const log = w.calls.find((c) => c.url.includes("/rest/v1/verifications"));
    expect(log?.headers.get("Prefer")).toBe("return=minimal");
  });

  it("a receipt to some other contract does not verify", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon", POLYGON_RPC_URL: "https://polygon.test/rpc" },
      supabase({
        products: [PRODUCT],
        receipt: { status: "0x1", to: "0x" + "11".repeat(20), blockNumber: "0x10" },
      })
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(body.verified).toBe(false);
    expect(body.blockchain.anchor_status).toBe("wrong_contract");
    expect(body.certificate).toBeNull();
    expect(body.certificate_error).toContain("not configured");
  });

  it("SKU matching several rows is ambiguous, never verified", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon" },
      supabase({
        products: [PRODUCT, { ...PRODUCT, id: "b2", truemark_id: "TM-TEST-0002" }],
      })
    );
    const body = await (await verify(w.request, "SKU-1")).json();
    expect(body.status).toBe("ambiguous");
    expect(body.verified).toBe(false);
    expect(body.candidates).toEqual(["TM-TEST-0001", "TM-TEST-0002"]);
  });
});

describe("authichain-api keys", () => {
  it("persists new keys through the RPC and returns 201", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await w.request("/api/v1/keys/create", {
      method: "POST",
      body: JSON.stringify({ email: "A@Example.com", name: "Ann" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    const call = w.calls.find((c) => c.url.includes("authichain_api_create_key"));
    expect(call?.body).toEqual({ p_email: "a@example.com", p_api_key: body.api_key, p_name: "Ann" });
    expect(w.calls.some((c) => c.url.includes("/rest/v1/white_label_clients"))).toBe(false);
  });

  it("does not hand out a key that was not saved", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({ createStatus: 500 }));
    const res = await w.request("/api/v1/keys/create", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com" }),
    });
    expect(res.status).toBe(503);
    expect((await res.json()).api_key).toBeUndefined();
  });

  it("rejects unknown ac_live_ keys once the lookup function exists", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({ resolve: [] }));
    const res = await w.request("/api/v1/me", { headers: { "X-API-Key": KEY } });
    expect(res.status).toBe(401);
  });

  it("keeps the legacy degraded path while the lookup function is missing", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({ resolve: "missing" }));
    const res = await w.request("/api/v1/me", { headers: { "X-API-Key": KEY } });
    expect(res.status).toBe(200);
    expect((await res.json()).plan).toBe("free");
  });

  it("resolves persisted keys to their plan", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const body = await (
      await w.request("/api/v1/me", { headers: { "X-API-Key": KEY } })
    ).json();
    expect(body.plan).toBe("pro");
  });

  it("JWKS returns 503 when no signing key is configured", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await w.request("/api/v1/.well-known/jwks.json");
    expect(res.status).toBe(503);
  });
});
