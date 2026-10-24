import { describe, it, expect, vi, beforeEach } from "vitest";

const { state } = vi.hoisted(() => ({
  state: { user: null as null | { id: string; email: string }, ent: null as null | { catalog_limit: number } },
}));

vi.mock("next/server", () => {
  class NextResponse {
    status: number;
    body: string;
    headers: Map<string, string>;
    constructor(body: string, init?: { status?: number; headers?: Record<string, string> }) {
      this.status = init?.status ?? 200;
      this.body = body;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static json(body: any, init?: { status?: number; headers?: Record<string, string> }) {
      return new NextResponse(JSON.stringify(body), init);
    }
  }
  return { NextResponse };
});
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = { select: () => b, eq: () => b, is: () => b, order: () => b, limit: () => b,
        maybeSingle: async () => ({ data: state.ent, error: null }) };
      return b;
    },
  }),
}));

import { POST, STOREPILOT_PRO_LINK } from "./route";

const csv = (n: number) =>
  "id,name,category\n" + Array.from({ length: n }, (_, i) => `p${i},Item ${i},textiles`).join("\n");

function call(body: string, q = "") {
  return POST(new Request(`https://authichain.com/api/storepilot/report${q}`, { method: "POST", body })) as unknown as Promise<{
    status: number; body: string; headers: Map<string, string>;
  }>;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";
  state.user = { id: "u1", email: "buyer@example.com" };
  state.ent = { catalog_limit: 200 };
});

describe("POST /api/storepilot/report", () => {
  it("503 when Supabase is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await call(csv(1))).status).toBe(503);
  });
  it("401 when signed out", async () => {
    state.user = null;
    expect((await call(csv(1))).status).toBe(401);
  });
  it("402 with the new Pro link when there is no entitlement", async () => {
    state.ent = null;
    const r = await call(csv(1));
    expect(r.status).toBe(402);
    expect(JSON.parse(r.body).pay).toBe(STOREPILOT_PRO_LINK);
    expect(r.body).not.toContain("eVqeVd1IZf7MeSKbDC1ND3x");
  });
  it("200 for 1 and 200 products, 413 for 201", async () => {
    expect((await call(csv(1))).status).toBe(200);
    const ok = await call(csv(200));
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.body).items).toHaveLength(200);
    const over = await call(csv(201));
    expect(over.status).toBe(413);
    expect(JSON.parse(over.body).error).toBe("catalog_over_limit");
  });
  it("format=jsonld returns parseable JSON-LD", async () => {
    const r = await call(csv(3), "?format=jsonld");
    expect(r.headers.get("Content-Type")).toBe("application/ld+json");
    expect(JSON.parse(r.body).numberOfItems).toBe(3);
  });
  it("JSON and JSON-LD both carry both disclaimers verbatim", async () => {
    const a = "Not affiliated with or endorsed by the European Commission.";
    const b = "The QR in this report is not an EU DPP and is not registered in the EU DPP Registry.";
    for (const q of ["", "?format=jsonld"]) {
      const r = await call(csv(2), q);
      expect(r.body).toContain(a);
      expect(r.body).toContain(b);
    }
  });
  it("422 for an unparseable upload", async () => {
    expect((await call("[oops")).status).toBe(422);
  });
});
