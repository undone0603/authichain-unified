// @vitest-environment node
import { describe, expect, it } from "vitest";
import worker from "./index.ts";

const KEY = "test-anchor-key";
const VALID_BODY = {
  name: "Sample",
  brand: "Sample Brand",
  hash: "a".repeat(64),
};

function fakeStore() {
  const puts: Array<[string, string]> = [];
  return {
    puts,
    async put(key: string, value: string) {
      puts.push([key, value]);
    },
    async get() {
      return null;
    },
  };
}

function certPuts(store: ReturnType<typeof fakeStore>) {
  return store.puts.filter(([key]) => key.startsWith("cert:"));
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
  it("rejects a request with no key and stores nothing", async () => {
    const store = fakeStore();
    const res = await anchor({ RATE_LIMITS: store });
    expect(res.status).toBe(401);
    expect(certPuts(store)).toEqual([]);
  });

  it("rejects an empty X-API-Key with 401 and stores nothing", async () => {
    const store = fakeStore();
    const res = await anchor({ RATE_LIMITS: store }, { "X-API-Key": "" });
    expect(res.status).toBe(401);
    expect(certPuts(store)).toEqual([]);
  });

  it("rejects demo-tier keys with 403 and stores no certificate", async () => {
    const store = fakeStore();
    for (const key of ["demo", `${KEY}-demo`]) {
      const res = await anchor({ RATE_LIMITS: store }, { "X-API-Key": key });
      expect(res.status).toBe(403);
    }
    expect(certPuts(store)).toEqual([]);
  });

  it("does not report success when storage is missing", async () => {
    const res = await anchor({}, { "X-API-Key": KEY });
    expect(res.status).toBe(503);
  });

  it("stores the record from X-API-Key and does not claim it was anchored", async () => {
    const store = fakeStore();
    const res = await anchor({ RATE_LIMITS: store }, { "X-API-Key": KEY });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      certificate: { anchored: boolean };
    };
    expect(body.certificate.anchored).toBe(false);
    expect(certPuts(store).map(([key]) => key)).toEqual(["cert:AC-AAAAAAAA"]);
  });

  it("accepts Authorization Bearer the same way sibling v1 routes do", async () => {
    const store = fakeStore();
    const res = await anchor(
      { RATE_LIMITS: store },
      { Authorization: `Bearer ${KEY}` }
    );
    expect(res.status).toBe(201);
    expect(certPuts(store).map(([key]) => key)).toEqual(["cert:AC-AAAAAAAA"]);
  });
});
