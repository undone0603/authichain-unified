// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import {
  registerLeadRoutes,
  syncContactToHubSpot,
  type LeadEnv,
} from "./lead-routes";

const { inserts, upserts } = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: unknown }>,
  upserts: [] as Array<{ table: string; row: unknown }>,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: async (row: unknown) => {
        inserts.push({ table, row });
        return { error: null };
      },
      upsert: async (row: unknown) => {
        upserts.push({ table, row });
        return { error: null };
      },
    }),
  }),
}));

const env: LeadEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  HUBSPOT_ACCESS_TOKEN: "pat-test",
  INTERNAL_API_SECRET: "internal-secret",
};

function makeApp() {
  const app = new Hono<{ Bindings: LeadEnv }>();
  registerLeadRoutes(app);
  return app;
}

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return makeApp().request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
    env
  );
}

type FetchCall = { url: string; init?: RequestInit };
let fetchCalls: FetchCall[];

function hubspotCalls() {
  return fetchCalls.filter(
    call => new URL(call.url).hostname === "api.hubapi.com"
  );
}

beforeEach(() => {
  inserts.length = 0;
  upserts.length = 0;
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      if (url.endsWith("/crm/v3/objects/contacts")) {
        return new Response(JSON.stringify({ id: "101" }), { status: 201 });
      }
      if (url.endsWith("/crm/v3/objects/deals")) {
        return new Response(JSON.stringify({ id: "202" }), { status: 201 });
      }
      return new Response("{}", { status: 200 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/book", () => {
  it("rejects a submission without name or email", async () => {
    const res = await post("/api/book", { email: "a@acme.com" });
    expect(res.status).toBe(400);
  });

  it("records the lead and creates a HubSpot contact, deal and association", async () => {
    const res = await post("/api/book", {
      name: "Ada Lovelace",
      email: "ada@acme.com",
      company: "Acme",
      message: "Need DPPs",
    });
    expect(res.status).toBe(200);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe("leads");
    const urls = hubspotCalls().map(call => call.url);
    expect(urls).toContain("https://api.hubapi.com/crm/v3/objects/contacts");
    expect(urls).toContain("https://api.hubapi.com/crm/v3/objects/deals");
    expect(urls).toContain(
      "https://api.hubapi.com/crm/v4/objects/deals/202/associations/contacts/101/3"
    );
  });

  it("drops a honeypot submission with a 200 and writes nothing", async () => {
    const res = await post("/api/book", {
      name: "Bot",
      email: "bot@acme.com",
      company_website: "http://spam.example",
    });
    expect(res.status).toBe(200);
    expect(upserts).toHaveLength(0);
    expect(hubspotCalls()).toHaveLength(0);
  });
});

describe("POST /api/lead-capture and /api/leads/capture", () => {
  it.each(["/api/lead-capture", "/api/leads/capture"])(
    "%s stores the capture and syncs a business email to HubSpot",
    async path => {
      const res = await post(path, {
        email: "buyer@acme.com",
        source: "eu-dpp-guide",
      });
      expect(res.status).toBe(200);
      expect(inserts.some(i => i.table === "lead_captures")).toBe(true);
      const contact = hubspotCalls().find(call =>
        call.url.endsWith("/crm/v3/objects/contacts")
      );
      expect(contact).toBeDefined();
      const sent = JSON.parse(String(contact!.init!.body)).properties;
      expect(sent.email).toBe("buyer@acme.com");
      expect(sent.source).toBe("eu-dpp-guide");
    }
  );

  it("requires an email", async () => {
    const res = await post("/api/lead-capture", { name: "No Email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/crm/sync", () => {
  it("refuses callers without the internal secret", async () => {
    const res = await post("/api/crm/sync", { email: "x@acme.com" });
    expect(res.status).toBe(401);
    expect(hubspotCalls()).toHaveLength(0);
  });

  it("syncs with the internal secret", async () => {
    const res = await post(
      "/api/crm/sync",
      { email: "x@acme.com", lead_score: 80 },
      { "x-internal-secret": "internal-secret" }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, contact_id: "101" });
  });
});

describe("syncContactToHubSpot", () => {
  it("never sends lead_score, which is not a property on this portal", async () => {
    await syncContactToHubSpot(
      { email: "x@acme.com", lead_score: 90 },
      "pat-test"
    );
    const sent = JSON.parse(String(fetchCalls[0].init!.body)).properties;
    expect(sent).not.toHaveProperty("lead_score");
    expect(sent.hs_lead_status).toBe("OPEN");
  });

  it("treats an existing contact (409) as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 409 }))
    );
    const result = await syncContactToHubSpot(
      { email: "x@acme.com" },
      "pat-test"
    );
    expect(result).toEqual({ ok: true, existed: true });
  });
});
