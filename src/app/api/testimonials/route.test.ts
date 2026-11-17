import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { state, fromMock } = vi.hoisted(() => {
  const state: { result: { data: unknown; error: unknown } | Error } = {
    result: { data: [], error: null },
  };

  function makeQuery() {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) q[m] = vi.fn(() => q);
    q.then = (
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown
    ) =>
      state.result instanceof Error
        ? Promise.reject(state.result).then(resolve, reject)
        : Promise.resolve(state.result).then(resolve, reject);
    return q;
  }

  return { state, fromMock: vi.fn(() => makeQuery()) };
});

vi.mock("../../../lib/supabase-admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { GET } from "./route";

function req(qs = "") {
  return new NextRequest("https://example.test/api/testimonials" + qs);
}

describe("GET /api/testimonials", () => {
  beforeEach(() => {
    state.result = { data: [], error: null };
  });

  it("returns an empty list when the DB has no rows", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ testimonials: [], count: 0 });
  });

  it("returns an empty list when the DB returns null data", async () => {
    state.result = { data: null, error: null };
    const res = await GET(req("?plan=pro"));
    expect(await res.json()).toEqual({ testimonials: [], count: 0 });
  });

  it("returns an empty list when the query throws", async () => {
    state.result = new Error("db down");
    const res = await GET(req());
    expect(await res.json()).toEqual({ testimonials: [], count: 0 });
  });

  it("returns DB rows unchanged when present", async () => {
    const row = {
      id: "r1",
      name: "N",
      role: null,
      company: null,
      avatar_initials: "N",
      rating: 5,
      text: "t",
      plan: "pro",
      verified: true,
      created_at: "2026-10-01",
    };
    state.result = { data: [row], error: null };
    const res = await GET(req());
    expect(await res.json()).toEqual({ testimonials: [row], count: 1 });
  });
});
