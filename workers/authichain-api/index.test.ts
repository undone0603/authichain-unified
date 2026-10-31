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

const SOURCE = readFileSync(path.join(import.meta.dirname, "index.js"), "utf8");

type Call = {
  url: string;
  method: string;
  body: unknown;
  headers: Headers;
  timed: boolean;
};
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

const DPP_RECORD = {
  type: ["VerifiableCredential", "DigitalProductPassport"],
  credentialSubject: { id: "urn:authichain:item:example-1" },
};

const DPP_ANCHOR = {
  chain: "polygon:137",
  recordHash: "sha256:" + "cd".repeat(32),
};

const PROVENANCE_RECORD = {
  type: ["VerifiableCredential", "ProvenanceRecord"],
  credentialSubject: {
    id: "https://authichain.com/protocol/examples/polygon-anchor-1",
    name: "Protocol demonstration. Not a product, not a battery passport.",
  },
};

const ABSENT_PASSPORT =
  "Registered product found. This check does not scan a product passport. A registry row and an anchor receipt are not that scan.";
const ANSWERED_PASSPORT =
  "passportScan is the verify worker's reading of a stored DigitalProductPassport. verified on this object stays false. A registry row and an anchor receipt are not that scan.";
const UNREACHABLE_PASSPORT =
  "The verify worker was not reached. The anchor receipt was not used as the scan. verified stays false.";

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
  handler: Handler,
  extras: Record<string, unknown> = {}
): {
  calls: Call[];
  request: (p: string, init?: RequestInit) => Promise<Response>;
} {
  const calls: Call[] = [];
  let listener: ((e: unknown) => void) | null = null;
  const fetchMock = async (input: string, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      method: init.method || "GET",
      body: init.body ? JSON.parse(String(init.body)) : null,
      headers: new Headers(init.headers),
      timed: init.signal instanceof AbortSignal,
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
    ...extras,
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
  return call => {
    const u = new URL(call.url);
    if (u.host === "polygon.test")
      return json({ jsonrpc: "2.0", id: 1, result: opts.receipt ?? null });
    if (u.host !== "nhdnkzhtadfkkluiulhs.supabase.co") return undefined;
    if (u.pathname === "/rest/v1/rpc/authichain_api_resolve_key") {
      if (opts.resolve === "missing") return json({ code: "PGRST202" }, 404);
      return json(
        opts.resolve ?? [
          {
            id: "c1",
            billing_plan: "pro",
            company_name: "Acme",
            api_call_limit: 1000,
            user_id: null,
          },
        ]
      );
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

function verify(
  req: (p: string, i?: RequestInit) => Promise<Response>,
  serial: string
) {
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
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon" },
      supabase({ products: [] })
    );
    const res = await verify(w.request, "tm-test-0001");
    const body = await res.json();
    expect(body.status).toBe("not_found");
    expect(body.verified).toBe(false);
    const productCalls = w.calls.filter(c =>
      c.url.includes("/rest/v1/products")
    );
    expect(productCalls).toHaveLength(1);
    const q = decodeURIComponent(productCalls[0].url);
    expect(q).not.toContain("tenant_id");
    expect(q).not.toContain("ilike");
    expect(q).toContain('truemark_id.eq."TM-TEST-0001"');
    expect(q).toContain('serial_number.eq."tm-test-0001"');
    expect(q).toContain('sku.eq."TM-TEST-0001"');
    expect(q).toContain("story,metadata");
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
    const anchor = body.evidence.find(
      (c: { id: string }) => c.id === "onchain_anchor"
    );
    expect(anchor.passed).toBe(false);
    expect(anchor.detail).toContain("unchecked");
    expect(body.trust_score).toBe(45); // registered+unit+attributed+no reports
    expect(body.certificate.alg).toBe("EdDSA");

    // Signature verifies against the published JWKS.
    const jwks = await (
      await w.request("/api/v1/.well-known/jwks.json")
    ).json();
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
    expect(body.passportScan).toBeNull();
    expect(body.message).toBe(ABSENT_PASSPORT);
    expect(JSON.parse(b64urlDecode(h).toString("utf8")).kid).toBe(
      jwks.keys[0].kid
    );
  });

  it("a confirmed receipt does not make the registry row a product passport", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        CERT_SIGNING_KEY: signing.b64,
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      supabase({
        products: [PRODUCT],
        receipt: {
          status: "0x1",
          to: CONTRACT.toLowerCase(),
          blockNumber: "0x10",
        },
      })
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(body.verified).toBe(false);
    expect(body.status).toBe("unverified");
    expect(body.trust_score).toBe(95);
    expect(body.message).toBe(ABSENT_PASSPORT);
    expect(body.message).not.toMatch(/Verified:/);
    expect(body.passportScan).toBeNull();
    expect(body.genuine).toBeUndefined();
    expect(body.blockchain.anchor_status).toBe("confirmed");
    expect(body.blockchain.verified_at).toBeNull();
    const log = w.calls.find(c => c.url.includes("/rest/v1/verifications"));
    expect(log?.headers.get("Prefer")).toBe("return=minimal");
  });

  it("a receipt to some other contract does not verify", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      supabase({
        products: [PRODUCT],
        receipt: {
          status: "0x1",
          to: "0x" + "11".repeat(20),
          blockNumber: "0x10",
        },
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
        products: [
          PRODUCT,
          { ...PRODUCT, id: "b2", truemark_id: "TM-TEST-0002" },
        ],
      })
    );
    const body = await (await verify(w.request, "SKU-1")).json();
    expect(body.status).toBe("ambiguous");
    expect(body.verified).toBe(false);
    expect(body.candidates).toEqual(["TM-TEST-0001", "TM-TEST-0002"]);
  });

  it("posts a stored DigitalProductPassport and keeps verified false", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        CERT_SIGNING_KEY: signing.b64,
        VERIFY_WORKER_URL: "https://verify.test/api/verify",
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      call => {
        const host = new URL(call.url).host;
        if (host === "verify.test") {
          return json({
            genuine: true,
            verdict: "verified",
            digitalIdentity: "urn:authichain:item:example-1",
            verified: true,
          });
        }
        return supabase({
          products: [
            {
              ...PRODUCT,
              metadata: {
                passport: { record: DPP_RECORD, anchor: DPP_ANCHOR },
              },
            },
          ],
          receipt: {
            status: "0x1",
            to: CONTRACT.toLowerCase(),
            blockNumber: "0x10",
          },
        })(call);
      }
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    const posted = w.calls.filter(c => c.url.includes("verify.test"));
    expect(posted).toHaveLength(1);
    expect(posted[0].method).toBe("POST");
    expect(posted[0].timed).toBe(true);
    expect(posted[0].body).toEqual({ record: DPP_RECORD, anchor: DPP_ANCHOR });
    expect(JSON.stringify(posted[0].body)).not.toContain("sealSerial");
    expect(body.verified).toBe(false);
    expect(body.status).toBe("unverified");
    expect(body.passportScan).toEqual({
      genuine: true,
      verdict: "verified",
      digitalIdentity: "urn:authichain:item:example-1",
    });
    expect(body.message).toBe(ANSWERED_PASSPORT);
    expect(body.blockchain.anchor_status).toBe("confirmed");
    expect(body.blockchain.verified_at).toBeNull();
    const [, payload] = body.certificate.jws.split(".");
    const signed = JSON.parse(b64urlDecode(payload).toString("utf8"));
    expect(signed.result.verified).toBe(false);
    expect(signed.result.status).toBe("unverified");
  });

  it("posts a passport record stored directly on metadata.passport", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        VERIFY_WORKER_URL: "https://verify.test/api/verify",
      },
      call => {
        if (new URL(call.url).host === "verify.test")
          return json({ genuine: false, verdict: "invalid" });
        return supabase({
          products: [{ ...PRODUCT, metadata: { passport: DPP_RECORD } }],
        })(call);
      }
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    const posted = w.calls.find(c => c.url.includes("verify.test"));
    expect(posted?.body).toEqual({ record: DPP_RECORD, anchor: null });
    expect(body.passportScan).toEqual({ genuine: false, verdict: "invalid" });
    expect(body.verified).toBe(false);
    expect(body.message).toBe(ANSWERED_PASSPORT);
  });

  it("does not use the anchor receipt when the verify worker is unset", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      supabase({
        products: [
          {
            ...PRODUCT,
            metadata: { passport: { record: DPP_RECORD, anchor: DPP_ANCHOR } },
          },
        ],
        receipt: {
          status: "0x1",
          to: CONTRACT.toLowerCase(),
          blockNumber: "0x10",
        },
      })
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(w.calls.some(c => c.url.includes("verify.test"))).toBe(false);
    expect(body.passportScan).toEqual({
      genuine: false,
      reason: "verifier_unreachable",
    });
    expect(body.verified).toBe(false);
    expect(body.status).toBe("unverified");
    expect(body.message).toBe(UNREACHABLE_PASSPORT);
    expect(body.blockchain.anchor_status).toBe("confirmed");
  });

  it("an HTTP error from the verify worker does not fall back to the receipt", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        VERIFY_WORKER_URL: "https://verify.test/api/verify",
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      call => {
        if (new URL(call.url).host === "verify.test")
          return json({ genuine: true }, 503);
        return supabase({
          products: [
            {
              ...PRODUCT,
              metadata: {
                passport: { record: DPP_RECORD, anchor: DPP_ANCHOR },
              },
            },
          ],
          receipt: {
            status: "0x1",
            to: CONTRACT.toLowerCase(),
            blockNumber: "0x10",
          },
        })(call);
      }
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(body.passportScan).toEqual({
      genuine: false,
      reason: "verifier_unreachable",
    });
    expect(body.verified).toBe(false);
    expect(body.message).toBe(UNREACHABLE_PASSPORT);
    expect(body.blockchain.anchor_status).toBe("confirmed");
  });

  it("a timeout uses verifier_unreachable and the injected fetchImpl", async () => {
    const seen: Call[] = [];
    const fetchImpl = async (input: string, init: RequestInit = {}) => {
      seen.push({
        url: String(input),
        method: init.method || "GET",
        body: init.body ? JSON.parse(String(init.body)) : null,
        headers: new Headers(init.headers),
        timed: init.signal instanceof AbortSignal,
      });
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    };
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        VERIFY_WORKER_URL: "https://verify.test/api/verify",
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      supabase({
        products: [
          {
            ...PRODUCT,
            metadata: { passport: { record: DPP_RECORD, anchor: DPP_ANCHOR } },
          },
        ],
        receipt: {
          status: "0x1",
          to: CONTRACT.toLowerCase(),
          from: CONTRACT.toLowerCase(),
          blockNumber: "0x10",
        },
      }),
      { fetchImpl }
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(seen).toHaveLength(1);
    expect(seen[0].timed).toBe(true);
    expect(seen[0].body).toEqual({ record: DPP_RECORD, anchor: DPP_ANCHOR });
    expect(w.calls.some(c => c.url.includes("verify.test"))).toBe(false);
    expect(body.passportScan).toEqual({
      genuine: false,
      reason: "verifier_unreachable",
    });
    expect(body.verified).toBe(false);
    expect(body.message).toBe(UNREACHABLE_PASSPORT);
    expect(body.blockchain.anchor_status).toBe("confirmed");
  });

  it("does not post a ProvenanceRecord, including polygon-anchor-1", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        VERIFY_WORKER_URL: "https://verify.test/api/verify",
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      call => {
        if (new URL(call.url).host === "verify.test") {
          return json({ genuine: true, verdict: "verified" });
        }
        return supabase({
          products: [
            {
              ...PRODUCT,
              metadata: PROVENANCE_RECORD,
            },
          ],
          receipt: {
            status: "0x1",
            to: CONTRACT.toLowerCase(),
            blockNumber: "0x10",
          },
        })(call);
      }
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(w.calls.some(c => c.url.includes("verify.test"))).toBe(false);
    expect(body.passportScan).toBeNull();
    expect(body.verified).toBe(false);
    expect(body.message).toBe(ABSENT_PASSPORT);
    expect(body.blockchain.anchor_status).toBe("confirmed");
  });

  it("does not post polygon-anchor-1 when it is nested under metadata.passport", async () => {
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        VERIFY_WORKER_URL: "https://verify.test/api/verify",
      },
      supabase({
        products: [{ ...PRODUCT, metadata: { passport: PROVENANCE_RECORD } }],
      })
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(w.calls.some(c => c.url.includes("verify.test"))).toBe(false);
    expect(body.passportScan).toBeNull();
    expect(body.verified).toBe(false);
    expect(body.message).toBe(ABSENT_PASSPORT);
  });

  it("a self-transfer stays wrong_contract and does not verify", async () => {
    const wallet = "0x" + "22".repeat(20);
    const w = loadWorker(
      {
        SUPABASE_ANON_KEY: "anon",
        POLYGON_RPC_URL: "https://polygon.test/rpc",
      },
      supabase({
        products: [PRODUCT],
        receipt: {
          status: "0x1",
          from: wallet,
          to: wallet,
          blockNumber: "0x10",
        },
      })
    );
    const body = await (await verify(w.request, "TM-TEST-0001")).json();
    expect(body.verified).toBe(false);
    expect(body.blockchain.anchor_status).toBe("wrong_contract");
    expect(body.passportScan).toBeNull();
    expect(SOURCE).not.toMatch(/import\s|require\(/);
    expect(SOURCE).toContain(CONTRACT);
    expect(SOURCE).not.toContain("verified: passportScan");
    expect(SOURCE).toContain("verified: assessment.verified");
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
    const call = w.calls.find(c => c.url.includes("authichain_api_create_key"));
    expect(call?.body).toEqual({
      p_email: "a@example.com",
      p_api_key: body.api_key,
      p_name: "Ann",
    });
    expect(call?.headers.get("authorization")).toBe("Bearer anon");
    expect(
      w.calls.some(c => c.url.includes("/rest/v1/white_label_clients"))
    ).toBe(false);
  });

  it("uses the service-role key only for create_key when it is bound", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-role" },
      supabase({})
    );
    const res = await w.request("/api/v1/keys/create", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com" }),
    });
    expect(res.status).toBe(201);
    const call = w.calls.find(c => c.url.includes("authichain_api_create_key"));
    expect(call?.headers.get("authorization")).toBe("Bearer service-role");
    expect(call?.headers.get("apikey")).toBe("service-role");
  });

  it("resolves keys with the anon key even when a service role is bound", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-role" },
      supabase({ resolve: [] })
    );
    const res = await w.request("/api/v1/me", {
      headers: { "X-API-Key": KEY },
    });
    expect(res.status).toBe(401);
    const call = w.calls.find(c =>
      c.url.includes("authichain_api_resolve_key")
    );
    expect(call?.headers.get("authorization")).toBe("Bearer anon");
  });

  it("captures a lead with the service-role key and still resolves with anon", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-role" },
      call => {
        const path = new URL(call.url).pathname;
        if (path === "/rest/v1/rpc/authichain_api_resolve_key") {
          return json([
            {
              id: "c1",
              billing_plan: "pro",
              company_name: "Acme",
              api_call_limit: 1000,
              user_id: null,
            },
          ]);
        }
        if (path === "/rest/v1/rpc/authichain_api_capture_lead")
          return json(null, 200);
        return undefined;
      }
    );
    const res = await w.request("/api/v1/leads", {
      method: "POST",
      headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "Buyer@Example.com",
        source: "site",
        name: "Bo",
        company: "Co",
      }),
    });
    expect(res.status).toBe(201);
    const lead = w.calls.find(c =>
      c.url.includes("authichain_api_capture_lead")
    );
    const resolve = w.calls.find(c =>
      c.url.includes("authichain_api_resolve_key")
    );
    expect(lead?.headers.get("authorization")).toBe("Bearer service-role");
    expect(lead?.body).toEqual({
      p_email: "buyer@example.com",
      p_source: "site",
      p_name: "Bo",
      p_company: "Co",
    });
    expect(resolve?.headers.get("authorization")).toBe("Bearer anon");
  });

  it("does not hand out a key that was not saved", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon" },
      supabase({ createStatus: 500 })
    );
    const res = await w.request("/api/v1/keys/create", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com" }),
    });
    expect(res.status).toBe(503);
    expect((await res.json()).api_key).toBeUndefined();
  });

  it("rejects unknown ac_live_ keys once the lookup function exists", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon" },
      supabase({ resolve: [] })
    );
    const res = await w.request("/api/v1/me", {
      headers: { "X-API-Key": KEY },
    });
    expect(res.status).toBe(401);
  });

  it("keeps the legacy degraded path while the lookup function is missing", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon" },
      supabase({ resolve: "missing" })
    );
    const res = await w.request("/api/v1/me", {
      headers: { "X-API-Key": KEY },
    });
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

  it("rejects the removed hard-coded demo keys", async () => {
    for (const k of ["demo_test_key_2026", "rapidapi_test_2026"]) {
      const w = loadWorker(
        { SUPABASE_ANON_KEY: "anon" },
        supabase({ resolve: [] })
      );
      const res = await w.request("/api/v1/me", {
        headers: { "X-API-Key": k },
      });
      expect(res.status).toBe(401);
      const bearer = await w.request("/api/v1/me", {
        headers: { Authorization: "Bearer " + k },
      });
      expect(bearer.status).toBe(401);
    }
    expect(SOURCE).not.toMatch(/demo_test_key_2026|rapidapi_test_2026/);
  });

  it("returns 401 for a missing key without calling Supabase", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await w.request("/api/v1/me");
    expect(res.status).toBe(401);
    expect(w.calls.length).toBe(0);
  });

  it("rejects any X-RapidAPI-Key when no proxy secret is configured", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await w.request("/api/v1/me", {
      headers: {
        "X-RapidAPI-Key": "anything",
        "X-RapidAPI-Proxy-Secret": "anything",
      },
    });
    expect(res.status).toBe(401);
    // Not looked up as a tenant key and not granted the basic plan.
    expect(
      w.calls.some(c => c.url.includes("authichain_api_resolve_key"))
    ).toBe(false);
  });

  it("rejects a RapidAPI request with a missing or wrong proxy secret", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon", RAPIDAPI_PROXY_SECRET: "proxy-secret-1" },
      supabase({})
    );
    const missing = await w.request("/api/v1/me", {
      headers: { "X-RapidAPI-Key": "rk" },
    });
    expect(missing.status).toBe(401);
    const wrong = await w.request("/api/v1/me", {
      headers: {
        "X-RapidAPI-Key": "rk",
        "X-RapidAPI-Proxy-Secret": "proxy-secret-2",
      },
    });
    expect(wrong.status).toBe(401);
    const prefix = await w.request("/api/v1/me", {
      headers: {
        "X-RapidAPI-Key": "rk",
        "X-RapidAPI-Proxy-Secret": "proxy-secret",
      },
    });
    expect(prefix.status).toBe(401);
  });

  it("does not let an unverified X-RapidAPI-Key ride along with a valid key", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await w.request("/api/v1/me", {
      headers: { "X-RapidAPI-Key": "anything", "X-API-Key": KEY },
    });
    expect(res.status).toBe(401);
  });

  it("accepts a RapidAPI request whose proxy secret matches", async () => {
    const w = loadWorker(
      { SUPABASE_ANON_KEY: "anon", RAPIDAPI_PROXY_SECRET: "proxy-secret-1" },
      supabase({})
    );
    const res = await w.request("/api/v1/me", {
      headers: {
        "X-RapidAPI-Key": "rk",
        "X-RapidAPI-Proxy-Secret": "proxy-secret-1",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("basic");
    expect(body.isDemo).toBe(false);
  });

  it("JWKS returns 503 when no signing key is configured", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await w.request("/api/v1/.well-known/jwks.json");
    expect(res.status).toBe(503);
  });
});

describe("authichain-api public pricing", () => {
  it("lists only the free meter and the live product page", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await w.request("/api/v1/pricing");
    expect(res.status).toBe(200);
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(body.plans).toEqual([
      { id: "free", name: "Free", price: "$0", requests: "10/hour" },
    ]);
    expect(body.products).toBe("https://authichain.com/pricing");
    expect(text).not.toMatch(/\$9|\$29|\$99|Basic|Ultra|rapidapi\.com/);
  });

  it("does not send a missing key to a RapidAPI checkout", async () => {
    const w = loadWorker({ SUPABASE_ANON_KEY: "anon" }, supabase({}));
    const res = await w.request("/api/v1/verify", { method: "POST" });
    expect(res.status).toBe(401);
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/rapidapi\.com|\$9\/mo/);
    expect(text).toContain("https://authichain.com/pricing");
  });
});
