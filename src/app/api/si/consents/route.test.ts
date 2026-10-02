import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const state = vi.hoisted(() => ({
  isAdmin: true,
  upserted: null as Record<string, unknown> | null,
}));

vi.mock("../../../../utils/supabase/server", () => ({
  createClient: async () => ({}),
}));

vi.mock("../../../../lib/require-admin", () => ({
  requireAdmin: async () =>
    state.isAdmin
      ? { user: { id: "owner" } }
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));

vi.mock("../../../../lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => {
      const result = {
        data: { granted_at: "2026-10-01T00:00:00.000Z" },
        error: null,
      };
      const query = {
        select: () => query,
        eq: () => query,
        upsert: (values: Record<string, unknown>) => {
          state.upserted = values;
          return query;
        },
        maybeSingle: async () => result,
        single: async () => ({ data: state.upserted, error: null }),
      };
      return query;
    },
  }),
}));

import { GET, PATCH } from "./route";

const patch = (body: unknown) =>
  PATCH(
    new NextRequest("https://authichain.com/api/si/consents", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("/api/si/consents", () => {
  beforeEach(() => {
    state.isAdmin = true;
    state.upserted = null;
  });

  it("restricts consent inspection to the owner", async () => {
    state.isAdmin = false;

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("rejects unsupported source names", async () => {
    const response = await patch({ source: "notion", share_public: true });

    expect(response.status).toBe(400);
    expect(state.upserted).toBeNull();
  });

  it("persists an explicit owner-only source grant", async () => {
    const response = await patch({ source: "agentz", share_public: true });

    expect(response.status).toBe(200);
    expect(state.upserted).toMatchObject({
      user_id: "owner",
      source: "agentz",
      share_public: true,
      revoked_at: null,
    });
  });

  it("preserves the original grant timestamp when consent is revoked", async () => {
    const response = await patch({ source: "agentz", share_public: false });

    expect(response.status).toBe(200);
    expect(state.upserted).toMatchObject({
      source: "agentz",
      share_public: false,
      granted_at: "2026-10-01T00:00:00.000Z",
    });
    expect(state.upserted?.revoked_at).toEqual(expect.any(String));
  });
});
