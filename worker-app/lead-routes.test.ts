// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import {
  ESTATE_LEAD_CAPTURE_CONSENT_MESSAGE,
  ESTATE_LEAD_CAPTURE_HOSTNAMES,
  ESTATE_LEAD_CAPTURE_ORIGINS,
  estateLeadCaptureAllowedOrigin,
  isEstateFooterLeadCapture,
  registerLeadRoutes,
  syncContactToHubSpot,
  type LeadEnv,
} from "./lead-routes";

const { inserts, upserts, db } = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: unknown }>,
  upserts: [] as Array<{ table: string; row: unknown }>,
  db: { formColumnsMissing: false, insertFails: false, upsertFails: false },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: async (row: unknown) => {
        if (db.insertFails && table === "lead_captures") {
          return {
            error: {
              code: "23502",
              message:
                'null value in column "email" of relation "lead_captures"',
            },
          };
        }
        if (
          db.formColumnsMissing &&
          table === "lead_captures" &&
          row &&
          typeof row === "object" &&
          "company" in row
        ) {
          return {
            error: {
              code: "PGRST204",
              message:
                "Could not find the 'battery_categories' column of 'lead_captures' in the schema cache",
            },
          };
        }
        inserts.push({ table, row });
        return { error: null };
      },
      upsert: async (row: unknown) => {
        if (db.upsertFails && table === "leads") {
          return {
            error: {
              code: "23502",
              message: 'null value in column "email" of relation "leads"',
            },
          };
        }
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
  db.formColumnsMissing = false;
  db.insertFails = false;
  db.upsertFails = false;
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

  it("does not report success or notify when the booking row is not stored", async () => {
    db.upsertFails = true;
    const res = await makeApp().request(
      "/api/book",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@acme.com",
          company: "Acme",
        }),
      },
      {
        ...env,
        RESEND_API_KEY: "re_test",
        SALES_NOTIFY_EMAIL: "sales@example.com",
      } as LeadEnv
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not store the request" });
    expect(upserts).toHaveLength(0);
    expect(hubspotCalls()).toHaveLength(0);
    expect(fetchCalls.some(call => call.url.includes("api.resend.com"))).toBe(
      false
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

  it("never sends the lead to Apollo, even with an Apollo key bound", async () => {
    const prev = process.env.APOLLO_API_KEY;
    process.env.APOLLO_API_KEY = "apollo-test";
    try {
      const res = await makeApp().request(
        "/api/leads/capture",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "buyer@acme.com",
            source: "battery-passport-page",
          }),
        },
        { ...env, APOLLO_API_KEY: "apollo-test" } as LeadEnv
      );
      expect(res.status).toBe(200);
      const hosts = fetchCalls.map(c => new URL(c.url).hostname);
      expect(
        hosts.some(h => h === "api.apollo.io" || h.endsWith(".apollo.io"))
      ).toBe(false);
      expect(hubspotCalls().length).toBeGreaterThan(0);
    } finally {
      if (prev === undefined) delete process.env.APOLLO_API_KEY;
      else process.env.APOLLO_API_KEY = prev;
    }
  });

  it("stores company, role, categories, target date and message", async () => {
    const res = await post("/api/leads/capture", {
      email: "lead@cells.example",
      name: "Ada Lovelace",
      source: "battery-passport-page",
      company: "Example Cells",
      role: "Compliance lead",
      categories: ["LMT (e-bikes, scooters)", "EV"],
      target_date: "Q1 2027",
      message: "Two models",
    });
    expect(res.status).toBe(200);
    const row = inserts.find(i => i.table === "lead_captures")!.row as Record<
      string,
      unknown
    >;
    expect(row).toMatchObject({
      email: "lead@cells.example",
      source: "battery-passport-page",
      company: "Example Cells",
      role: "Compliance lead",
      battery_categories: ["LMT (e-bikes, scooters)", "EV"],
      target_date: "Q1 2027",
      message: "Two models",
    });
    const contact = hubspotCalls().find(c =>
      c.url.endsWith("/crm/v3/objects/contacts")
    )!;
    const sent = JSON.parse(String(contact.init!.body)).properties;
    expect(sent.company).toBe("Example Cells");
    expect(sent.jobtitle).toBe("Compliance lead");
    expect(sent.firstname).toBe("Ada");
    expect(sent.lastname).toBe("Lovelace");
  });

  it("does not report success or sync HubSpot when the lead row is not stored", async () => {
    db.insertFails = true;
    const res = await post("/api/leads/capture", {
      email: "buyer@acme.com",
      source: "battery-passport-page",
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Could not store the request" });
    expect(inserts.some(i => i.table === "lead_captures")).toBe(false);
    expect(hubspotCalls()).toHaveLength(0);
  });

  it("answers OPTIONS preflight for estate origins and echoes that Origin", async () => {
    for (const origin of ESTATE_LEAD_CAPTURE_ORIGINS) {
      const res = await makeApp().request(
        "/api/leads/capture",
        {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
          },
        },
        env
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/POST/);
      expect(res.headers.get("Access-Control-Allow-Headers")).toMatch(
        /Content-Type/i
      );
      expect(res.headers.get("Vary")).toMatch(/Origin/);
    }
  });

  it("refuses OPTIONS from an origin outside the estate allowlist", async () => {
    const res = await makeApp().request(
      "/api/leads/capture",
      {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example" },
      },
      env
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it.each([...ESTATE_LEAD_CAPTURE_ORIGINS])(
    "stores a capture from %s and returns CORS headers",
    async origin => {
      const hostname = new URL(origin).hostname;
      const res = await makeApp().request(
        "/api/leads/capture",
        {
          method: "POST",
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: `buyer@${hostname}`,
            source: hostname,
            product_interest: hostname.split(".")[0],
            consent: "yes",
          }),
        },
        env
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      const row = inserts.find(i => i.table === "lead_captures")!.row as Record<
        string,
        unknown
      >;
      expect(row.source).toBe(hostname);
      expect(row.email).toBe(`buyer@${hostname}`);
      expect(row.message).toBe(ESTATE_LEAD_CAPTURE_CONSENT_MESSAGE);
      expect(hubspotCalls()).toHaveLength(0);
    }
  );

  it("still stores a same-origin capture without CORS headers", async () => {
    const res = await post("/api/leads/capture", {
      email: "buyer@acme.com",
      source: "authichain.com",
      consent: "yes",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const row = inserts.find(i => i.table === "lead_captures")!.row as Record<
      string,
      unknown
    >;
    expect(row.message).toBe(ESTATE_LEAD_CAPTURE_CONSENT_MESSAGE);
    expect(hubspotCalls()).toHaveLength(0);
  });

  it.each([...ESTATE_LEAD_CAPTURE_HOSTNAMES])(
    "returns 400 Consent required when estate hostname %s omits consent",
    async hostname => {
      const res = await post("/api/leads/capture", {
        email: `buyer@${hostname}`,
        source: hostname,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Consent required" });
      expect(inserts.some(i => i.table === "lead_captures")).toBe(false);
      expect(hubspotCalls()).toHaveLength(0);
    }
  );

  it("returns 400 Consent required for a sister-origin capture without consent", async () => {
    const res = await makeApp().request(
      "/api/leads/capture",
      {
        method: "POST",
        headers: {
          Origin: "https://qron.space",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "buyer@qron.space",
          source: "website",
        }),
      },
      env
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Consent required" });
    expect(inserts.some(i => i.table === "lead_captures")).toBe(false);
  });

  it.each([...ESTATE_LEAD_CAPTURE_HOSTNAMES])(
    "skips HubSpot, Apollo, Make, and n8n for quiet estate hostname %s",
    async hostname => {
      const res = await makeApp().request(
        "/api/leads/capture",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `buyer@${hostname}`,
            source: hostname,
            consent: "yes",
          }),
        },
        {
          ...env,
          APOLLO_API_KEY: "apollo-test-key",
          MAKE_LEAD_WEBHOOK_URL: "https://hook.make.example/lead",
          N8N_LEAD_WEBHOOK_URL: "https://n8n.example/lead",
        } as LeadEnv
      );
      expect(res.status).toBe(200);
      const row = inserts.find(i => i.table === "lead_captures")!.row as Record<
        string,
        unknown
      >;
      expect(row.message).toBe("consent: yes (site-lead-capture-v1)");
      expect(hubspotCalls()).toHaveLength(0);
      expect(
        fetchCalls.some(call =>
          /make\.example|n8n\.example|apollo\.io/i.test(call.url)
        )
      ).toBe(false);
    }
  );

  it("does not require footer consent for battery-passport from authichain.com Origin", async () => {
    const res = await makeApp().request(
      "/api/leads/capture",
      {
        method: "POST",
        headers: {
          Origin: "https://authichain.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "buyer@acme.com",
          source: "battery-passport-page",
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    expect(hubspotCalls().length).toBeGreaterThan(0);
    const row = inserts.find(i => i.table === "lead_captures")!.row as Record<
      string,
      unknown
    >;
    expect(row.message).toBeNull();
    expect(row.source).toBe("battery-passport-page");
  });

  it("estateLeadCaptureAllowedOrigin only allows the four live apexes", () => {
    expect(estateLeadCaptureAllowedOrigin("https://qron.space")).toBe(
      "https://qron.space"
    );
    expect(estateLeadCaptureAllowedOrigin("https://evil.example")).toBeNull();
    expect(estateLeadCaptureAllowedOrigin(undefined)).toBeNull();
    expect(isEstateFooterLeadCapture("qron.space", null)).toBe(true);
    expect(isEstateFooterLeadCapture("website", "https://strainchain.io")).toBe(
      true
    );
    expect(
      isEstateFooterLeadCapture(
        "battery-passport-page",
        "https://authichain.com"
      )
    ).toBe(false);
    expect(isEstateFooterLeadCapture("eu-dpp-guide", undefined)).toBe(false);
  });

  it("keeps the lead when the form-field migration is not applied yet", async () => {
    db.formColumnsMissing = true;
    const res = await post("/api/leads/capture", {
      email: "lead@cells.example",
      company: "Example Cells",
      categories: "EV, Home storage",
    });
    expect(res.status).toBe(200);
    const rows = inserts.filter(i => i.table === "lead_captures");
    expect(rows).toHaveLength(1);
    expect(rows[0].row).toMatchObject({ email: "lead@cells.example" });
    expect(rows[0].row).not.toHaveProperty("company");
  });
});

describe("lead capture Apollo enrichment guard (CFD-125)", () => {
  const apolloEnv: LeadEnv = { ...env, APOLLO_API_KEY: "apollo-test-key" };
  let savedFlag: string | undefined;
  let savedKey: string | undefined;

  function apolloCalls() {
    return fetchCalls.filter(
      call => new URL(call.url).hostname === "api.apollo.io"
    );
  }

  function capture(path: string, body: unknown) {
    return makeApp().request(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      apolloEnv
    );
  }

  beforeEach(() => {
    savedFlag = process.env.LEAD_APOLLO_ENRICH;
    savedKey = process.env.APOLLO_API_KEY;
    delete process.env.LEAD_APOLLO_ENRICH;
  });

  afterEach(() => {
    if (savedFlag === undefined) delete process.env.LEAD_APOLLO_ENRICH;
    else process.env.LEAD_APOLLO_ENRICH = savedFlag;
    if (savedKey === undefined) delete process.env.APOLLO_API_KEY;
    else process.env.APOLLO_API_KEY = savedKey;
    vi.restoreAllMocks();
  });

  it.each(["/api/lead-capture", "/api/leads/capture"])(
    "%s with LEAD_APOLLO_ENRICH unset stores the lead and never calls api.apollo.io, even with APOLLO_API_KEY bound",
    async path => {
      const logSpy = vi.spyOn(console, "log");
      const res = await capture(path, {
        email: "buyer@acme.com",
        source: "cfd125-test",
      });
      expect(res.status).toBe(200);
      expect(inserts.some(i => i.table === "lead_captures")).toBe(true);
      expect(process.env.APOLLO_API_KEY).toBe("apollo-test-key");
      expect(apolloCalls()).toHaveLength(0);
      const logged = logSpy.mock.calls.flat().map(String).join("\n");
      expect(logged).not.toContain("buyer@acme.com");
    }
  );

  it("still calls api.apollo.io when LEAD_APOLLO_ENRICH is explicitly on (control)", async () => {
    process.env.LEAD_APOLLO_ENRICH = "on";
    const res = await capture("/api/leads/capture", {
      email: "buyer@acme.com",
      source: "cfd125-test",
    });
    expect(res.status).toBe(200);
    expect(inserts.some(i => i.table === "lead_captures")).toBe(true);
    expect(apolloCalls()).toHaveLength(1);
  });

  it("does not call api.apollo.io for estate footer captures even when LEAD_APOLLO_ENRICH is on", async () => {
    process.env.LEAD_APOLLO_ENRICH = "on";
    const res = await capture("/api/leads/capture", {
      email: "buyer@acme.com",
      source: "govchain.us",
      consent: "yes",
    });
    expect(res.status).toBe(200);
    expect(inserts.some(i => i.table === "lead_captures")).toBe(true);
    expect(apolloCalls()).toHaveLength(0);
    expect(hubspotCalls()).toHaveLength(0);
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

import { NO_OUTBOUND_SOURCE } from "./lead-routes";
describe("is-this-real lead source", () => {
  it("is the source the /is-this-real page sends", () => {
    expect(NO_OUTBOUND_SOURCE).toBe("is-this-real");
  });
});
