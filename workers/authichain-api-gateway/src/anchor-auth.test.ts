import { test } from "node:test";
import assert from "node:assert/strict";
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

function anchor(env: any, headers: Record<string, string> = {}) {
  return worker.fetch(
    new Request("https://api.authichain.com/api/v1/anchor", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(VALID_BODY),
    }),
    env
  );
}

test("anchor rejects a request with no key and stores nothing", async () => {
  const store = fakeStore();
  const res = await anchor({ ANCHOR_API_KEY: KEY, RATE_LIMITS: store });
  assert.equal(res.status, 401);
  assert.equal(store.puts.length, 0);
});

test("anchor rejects a wrong key, including one containing demo", async () => {
  const store = fakeStore();
  for (const key of ["wrong", "demo", `${KEY}-demo`]) {
    const res = await anchor(
      { ANCHOR_API_KEY: KEY, RATE_LIMITS: store },
      { "X-API-Key": key }
    );
    assert.equal(res.status, 401, key);
  }
  assert.equal(store.puts.length, 0);
});

test("anchor fails closed when ANCHOR_API_KEY is unset", async () => {
  const store = fakeStore();
  const res = await anchor({ RATE_LIMITS: store }, { "X-API-Key": "" });
  assert.equal(res.status, 401);
  assert.equal(store.puts.length, 0);
});

test("anchor does not report success when storage is missing", async () => {
  const res = await anchor({ ANCHOR_API_KEY: KEY }, { "X-API-Key": KEY });
  assert.equal(res.status, 503);
});

test("anchor stores the record and does not claim it was anchored", async () => {
  const store = fakeStore();
  const res = await anchor(
    { ANCHOR_API_KEY: KEY, RATE_LIMITS: store },
    { Authorization: `Bearer ${KEY}` }
  );
  assert.equal(res.status, 201);
  const body: any = await res.json();
  assert.equal(body.certificate.anchored, false);
  assert.equal(store.puts.length, 1);
  assert.equal(store.puts[0][0], "cert:AC-AAAAAAAA");
});
