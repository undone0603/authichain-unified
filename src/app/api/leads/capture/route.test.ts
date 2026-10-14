/**
 * The Next capture route is a second rail behind the edge worker.
 * A failed lead_captures insert must not look saved and must not start CRM.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const { db, automation } = vi.hoisted(() => ({
  db: { error: null as { message: string } | null },
  automation: {
    handleLeadAutomation: vi.fn(async () => undefined),
    logAutomation: vi.fn(async () => undefined),
  },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/automation", () => ({
  handleLeadAutomation: automation.handleLeadAutomation,
  logAutomation: automation.logAutomation,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      insert: async () => ({ error: db.error }),
    }),
  }),
}));

import { POST } from "./route";

function post(body: unknown) {
  const req = { json: async () => body } as unknown as NextRequest;
  return POST(req) as unknown as Promise<{
    status: number;
    json: () => Promise<unknown>;
  }>;
}

describe("POST /api/leads/capture (Next)", () => {
  beforeEach(() => {
    db.error = null;
    automation.handleLeadAutomation.mockClear();
    automation.logAutomation.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  it("stores the row before automation", async () => {
    const res = await post({ email: "buyer@acme.com", source: "website" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(automation.handleLeadAutomation).toHaveBeenCalledOnce();
  });

  it("does not report success or start automation when the row is not stored", async () => {
    db.error = { message: "null value in column email" };
    const res = await post({ email: "buyer@acme.com", source: "website" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not store the request" });
    expect(automation.handleLeadAutomation).not.toHaveBeenCalled();
    expect(automation.logAutomation).toHaveBeenCalled();
  });

  it("does not start automation when Supabase is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await post({ email: "buyer@acme.com" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not store the request" });
    expect(automation.handleLeadAutomation).not.toHaveBeenCalled();
  });
});
