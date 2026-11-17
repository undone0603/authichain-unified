// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { CERT_ID_RE, hashApiKey, newCertificateId } from "./index.ts";

const VALID_KEY = "qron_live_abcdefghijklmnopqrstuvwxyz012345";
const UNKNOWN_KEY = "qron_live_unknownkey00000000000000000000";
const VALID_BODY = {
  name: "Sample",
  brand: "Sample Brand",
  hash: "a".repeat(64),
};
const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CERT_ID = "AC-" + UUID.replace(/-/g, "").toUpperCase();

const KEY_STORE = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const puts: Array<[string, string]> = [];
  return {
    puts,
    data,
    async get(key: string) {
      return data.get(key) ?? null;
    },
    async put(key: string, value: string) {
      puts.push([key, value]);
      data.set(key, value);
    },
  };
}

function certPuts(store: ReturnType<typeof fakeStore>) {
  return store.puts.filter(([key]) => key.startsWith("cert:"));
}

function mockKeyRows(
  rowsForHash: Record<string, Array<{ user_id: string; is_active: boolean }>>
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes("/rest/v1/api_keys")) {
      return new Response("not found", { status: 404 });
    }
    const match = /key_hash=eq\.([0-9a-f]+)/i.exec(url);
    const hash = match?.[1]?.toLowerCase() ?? "";
    const rows = rowsForHash[hash] ?? [];
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

function anchor(
  env: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return worker.fetch(
    new Request("https://api.authichain.com/api/v1/anchor", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(VALID_BODY),
    }),
    env
  );
}

describe("POST /api/v1/anchor auth", () => {
  let validHash: string;
  let unknownHash: string;

  beforeEach(async () => {
    validHash = await hashApiKey(VALID_KEY);
    unknownHash = await hashApiKey(UNKNOWN_KEY);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(UUID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a request with no key and stores nothing", async () => {
    const store = fakeStore();
    const fetchMock = mockKeyRows({});
    vi.stubGlobal("fetch", fetchMock);
    const res = await anchor({ RATE_LIMITS: store, ...KEY_STORE });
    expect(res.status).toBe(401);
    expect(certPuts(store)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty X-API-Key with 401 and stores nothing", async () => {
    const store = fakeStore();
    const fetchMock = mockKeyRows({});
    vi.stubGlobal("fetch", fetchMock);
    const res = await anchor(
      { RATE_LIMITS: store, ...KEY_STORE },
      { "X-API-Key": "" }
    );
    expect(res.status).toBe(401);
    expect(certPuts(store)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid (unknown) key with 401 and stores nothing", async () => {
    const store = fakeStore();
    const fetchMock = mockKeyRows({ [unknownHash]: [] });
    vi.stubGlobal("fetch", fetchMock);
    const res = await anchor(
      { RATE_LIMITS: store, ...KEY_STORE },
      { "X-API-Key": UNKNOWN_KEY }
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid api key/i);
    expect(certPuts(store)).toEqual([]);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("rejects a non-qron_ key without hitting the key store", async () => {
    const store = fakeStore();
    const fetchMock = mockKeyRows({});
    vi.stubGlobal("fetch", fetchMock);
    const res = await anchor(
      { RATE_LIMITS: store, ...KEY_STORE },
      { "X-API-Key": "any-nonempty-not-demo" }
    );
    expect(res.status).toBe(401);
    expect(certPuts(store)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a revoked key with 403 and stores nothing", async () => {
    const store = fakeStore();
    const fetchMock = mockKeyRows({
      [validHash]: [{ user_id: "user-1", is_active: false }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await anchor(
      { RATE_LIMITS: store, ...KEY_STORE },
      { "X-API-Key": VALID_KEY }
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/revoked/i);
    expect(certPuts(store)).toEqual([]);
  });

  it("fails closed with 503 when the key store is unavailable", async () => {
    const store = fakeStore();
    const res = await anchor(
      { RATE_LIMITS: store },
      { "X-API-Key": VALID_KEY }
    );
    expect(res.status).toBe(503);
    expect(certPuts(store)).toEqual([]);
  });

  it("does not report success when certificate storage is missing", async () => {
    vi.stubGlobal(
      "fetch",
      mockKeyRows({
        [validHash]: [{ user_id: "user-1", is_active: true }],
      })
    );
    const res = await anchor({ ...KEY_STORE }, { "X-API-Key": VALID_KEY });
    expect(res.status).toBe(503);
  });

  it("stores the record from a valid key with a 128-bit id and does not claim it was anchored", async () => {
    const store = fakeStore();
    const fetchMock = mockKeyRows({
      [validHash]: [{ user_id: "user-1", is_active: true }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await anchor(
      { RATE_LIMITS: store, ...KEY_STORE },
      { "X-API-Key": VALID_KEY }
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      certificate: { id: string; anchored: boolean };
    };
    expect(body.certificate.anchored).toBe(false);
    expect(body.id).toBe(CERT_ID);
    expect(body.id).toMatch(/^AC-[0-9A-F]{32}$/);
    expect(CERT_ID_RE.test(body.id)).toBe(true);
    expect(certPuts(store).map(([key]) => key)).toEqual([`cert:${CERT_ID}`]);
    expect(fetchMock).toHaveBeenCalled();
    const requested = String(fetchMock.mock.calls[0]?.[0]);
    expect(requested).toContain(`key_hash=eq.${validHash}`);
  });

  it("accepts Authorization Bearer the same way sibling v1 routes do", async () => {
    const store = fakeStore();
    vi.stubGlobal(
      "fetch",
      mockKeyRows({
        [validHash]: [{ user_id: "user-1", is_active: true }],
      })
    );
    const res = await anchor(
      { RATE_LIMITS: store, ...KEY_STORE },
      { Authorization: `Bearer ${VALID_KEY}` }
    );
    expect(res.status).toBe(201);
    expect(certPuts(store).map(([key]) => key)).toEqual([`cert:${CERT_ID}`]);
  });

  it("refuses to overwrite an existing certificate id with 409", async () => {
    const store = fakeStore({
      [`cert:${CERT_ID}`]: JSON.stringify({
        id: CERT_ID,
        hash: "b".repeat(64),
      }),
    });
    vi.stubGlobal(
      "fetch",
      mockKeyRows({
        [validHash]: [{ user_id: "user-1", is_active: true }],
      })
    );
    const res = await anchor(
      { RATE_LIMITS: store, ...KEY_STORE },
      { "X-API-Key": VALID_KEY }
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; id: string };
    expect(body.id).toBe(CERT_ID);
    expect(body.error).toMatch(/already exists/i);
    expect(certPuts(store)).toEqual([]);
    expect(store.data.get(`cert:${CERT_ID}`)).toContain("b".repeat(64));
  });
});

describe("certificate id format", () => {
  it("newCertificateId is AC- plus 32 hex chars", () => {
    const id = newCertificateId();
    expect(id).toMatch(/^AC-[0-9A-F]{32}$/);
    expect(CERT_ID_RE.test(id)).toBe(true);
  });

  it("GET still serves legacy 8-hex ids and rejects malformed ids", async () => {
    const legacyId = "AC-DEADBEEF";
    const store = fakeStore({
      [`cert:${legacyId}`]: JSON.stringify({ id: legacyId, name: "legacy" }),
    });
    const ok = await worker.fetch(
      new Request(`https://api.authichain.com/api/v1/cert/${legacyId}`),
      { RATE_LIMITS: store }
    );
    expect(ok.status).toBe(200);
    const bad = await worker.fetch(
      new Request("https://api.authichain.com/api/v1/cert/AC-NOTHEX!!"),
      { RATE_LIMITS: store }
    );
    expect(bad.status).toBe(400);
  });
});
