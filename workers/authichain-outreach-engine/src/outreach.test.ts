// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkClaims } from "./claims";
import { checkLead, personFirstName } from "./guard";
import { renderTemplate, segmentFor, TEMPLATES, type Segment } from "./templates";
import worker, { buildDraft, type Env } from "./index";

// The text this worker's predecessor actually sent to DEA/CBP and Pfizer addresses.
const DEA_EMAIL =
  "Hi Pilot Coordinator,\n\nAuthiChain provides DoD-level supply chain verification. Would you like to see our SBIR Phase 1 results?";
const PFIZER_EMAIL =
  "Thank you again for taking the time for the demo. Active enterprise contracts in pharma. Reduces audit costs by 90%, scannable in 2.1 seconds.";

const goodMeta = {
  verification_source: "apollo_verified",
  verification_evidence: "apollo:person:64f0c0ffee",
};

describe("checkClaims", () => {
  it("blocks the DEA/CBP email", () => {
    const rules = checkClaims("Supply chain pilot", DEA_EMAIL).map(v => v.rule);
    expect(rules).toContain("unverified_award");
    expect(rules).toContain("compliance_or_grade_claim");
  });

  it("blocks the Pfizer email", () => {
    const rules = checkClaims("Pharma traceability", PFIZER_EMAIL).map(v => v.rule);
    expect(rules).toEqual(
      expect.arrayContaining([
        "fabricated_engagement",
        "unverified_traction",
        "unverified_statistic",
      ])
    );
  });

  it("blocks fake reply subjects and unrendered placeholders", () => {
    expect(checkClaims("Re: our call", "Hello").map(v => v.rule)).toContain("fake_reply_subject");
    expect(checkClaims("Hi", "Hi {{first_name}}").map(v => v.rule)).toContain(
      "unrendered_placeholder"
    );
  });

  it.each(Object.keys(TEMPLATES) as Segment[])("shipped %s template passes when filled", seg => {
    const r = renderTemplate(TEMPLATES[seg], {
      first_name: "Dana",
      company: "Acme Labs",
      sender_name: "Zachary Kietzman",
    });
    expect(checkClaims(r.subject, r.body)).toEqual([]);
  });
});

describe("templates", () => {
  it("leaves missing values as placeholders instead of 'there' / 'your company'", () => {
    const r = renderTemplate(TEMPLATES.general, { first_name: "", company: "", sender_name: "Z" });
    expect(r.body).toContain("{{first_name}}");
    expect(r.subject).toContain("{{company}}");
    expect(r.body).not.toMatch(/\bthere\b|your company/);
  });

  it("maps industries to segments with no government segment", () => {
    expect(segmentFor("Pharmaceuticals")).toBe("pharma");
    expect(segmentFor("Luxury watches")).toBe("luxury");
    expect(segmentFor("cannabis")).toBe("cannabis");
    expect(segmentFor("defense")).toBe("general");
  });
});

describe("checkLead", () => {
  const base = { email: "dana@acmelabs.com", name: "Dana Reyes", company: "Acme Labs", metadata: goodMeta };

  it("accepts a verified person at a real company", () => {
    expect(checkLead(base)).toEqual({ ok: true, reasons: [], first_name: "Dana" });
  });

  it("rejects the leads that were actually in the table", () => {
    const dea = checkLead({ ...base, email: "tracking@dea.gov", name: "Pilot Coordinator", metadata: {} });
    expect(dea.reasons).toEqual(
      expect.arrayContaining([
        "government_or_military_address",
        "contact_name_not_a_person",
        "untrusted_source:unknown",
      ])
    );
    const arc = checkLead({ ...base, company: "AuthiChain OS — Arc'teryx Gear Authentication (AMER)" });
    expect(arc.reasons).toContain("company_names_our_own_product");
    expect(checkLead({ ...base, company: "Arc'teryx — AMER" }).reasons).toContain(
      "company_looks_synthetic"
    );
  });

  it("rejects role inboxes, missing evidence and unsourced notes", () => {
    expect(checkLead({ ...base, email: "info@acmelabs.com" }).reasons).toContain("role_inbox");
    expect(
      checkLead({ ...base, metadata: { verification_source: "apollo_verified" } }).reasons
    ).toContain("missing_verification_evidence");
    expect(
      checkLead({ ...base, metadata: { verification_source: "published_contact", verification_evidence: "their site" } })
        .reasons
    ).toContain("published_contact_needs_source_url");
    expect(
      checkLead({ ...base, metadata: { ...goodMeta, personal_note: "Congrats on the launch." } }).reasons
    ).toContain("personal_note_needs_source_url");
  });

  it("does not treat a job title as a first name", () => {
    expect(personFirstName("Director of Trade")).toBeNull();
    expect(personFirstName("Operations Team")).toBeNull();
    expect(personFirstName("José Álvarez")).toBe("José");
  });
});

// --- worker flow against an in-memory D1/KV ---------------------------------------

interface Lead {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
  industry: string | null;
  score: number;
  status: string;
  metadata: string | null;
  created_at: string;
  last_contacted_at: string | null;
}

function fakeEnv(overrides: Partial<Env> = {}) {
  const leads: Lead[] = [];
  const logs: { lead_id: number; status: string; error_message: string | null }[] = [];
  const kv = new Map<string, string>();

  const exec = (sql: string, args: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT COUNT(*) AS n FROM outreach_logs")) {
      const ids = new Set(leads.filter(l => l.email.toLowerCase() === args[0]).map(l => l.id));
      return { first: { n: logs.filter(g => ids.has(g.lead_id) && ["sent", "ok"].includes(g.status)).length } };
    }
    if (s.startsWith("SELECT id FROM leads WHERE lower(email)")) {
      const l = leads.find(x => x.email.toLowerCase() === args[0]);
      return { first: l ? { id: l.id } : null };
    }
    if (s.startsWith("INSERT INTO leads")) {
      const id = leads.length + 1;
      leads.push({
        id, email: args[0], name: args[1], company: args[2], title: args[3], industry: args[4],
        score: args[5], status: "new", metadata: args[6], created_at: "now", last_contacted_at: null,
      });
      return { run: { meta: { last_row_id: id } } };
    }
    if (s.startsWith("INSERT INTO outreach_logs")) {
      logs.push({ lead_id: args[0], status: args[2], error_message: args[3] });
      return { run: { meta: {} } };
    }
    if (s.includes("WHERE id = ?1") && s.startsWith("SELECT")) {
      return { first: leads.find(l => l.id === args[0]) ?? null };
    }
    if (s.includes("WHERE status IN ('new','approved')")) {
      return { all: leads.filter(l => ["new", "approved"].includes(l.status)).slice(0, args[0]) };
    }
    if (s.includes("WHERE status = 'approved'")) {
      return { all: leads.filter(l => l.status === "approved").slice(0, args[0]) };
    }
    if (s.startsWith("UPDATE leads SET status = ?2, metadata = ?3")) {
      const l = leads.find(x => x.id === args[0])!;
      l.status = args[1];
      l.metadata = args[2];
      return { run: { meta: {} } };
    }
    if (s.startsWith("UPDATE leads SET status = ?2")) {
      leads.find(x => x.id === args[0])!.status = args[1];
      return { run: { meta: {} } };
    }
    if (s.startsWith("UPDATE leads SET last_contacted_at")) {
      leads.find(x => x.id === args[0])!.last_contacted_at = "now";
      return { run: { meta: {} } };
    }
    if (s.startsWith("UPDATE leads SET status = 'suppressed'")) {
      leads.filter(l => l.email.toLowerCase() === args[0]).forEach(l => (l.status = "suppressed"));
      return { run: { meta: {} } };
    }
    throw new Error(`unhandled SQL in fake D1: ${s}`);
  };

  const DB = {
    prepare(sql: string) {
      let args: any[] = [];
      const stmt = {
        bind(...a: any[]) {
          args = a;
          return stmt;
        },
        async first() {
          return exec(sql, args).first;
        },
        async all() {
          return { results: exec(sql, args).all };
        },
        async run() {
          return exec(sql, args).run;
        },
      };
      return stmt;
    },
  };

  const SUPPRESS_KV = {
    async get(k: string) {
      return kv.get(k) ?? null;
    },
    async put(k: string, v: string) {
      kv.set(k, v);
    },
  };

  const env = {
    DB,
    SUPPRESS_KV,
    OUTREACH_ADMIN_TOKEN: "admin-tok",
    OUTREACH_APPROVER_TOKEN: "approver-tok",
    RESEND_API_KEY: "re_test",
    OUTREACH_FROM_EMAIL: "AuthiChain <noreply@authichain.com>",
    OUTREACH_REPLY_TO: "authichain@gmail.com",
    BATCH_SIZE: "5",
    OUTREACH_MODE: "dry_run",
    OUTREACH_PUBLIC_URL: "https://outreach.example.workers.dev",
    OUTREACH_SENDER_NAME: "Zachary Kietzman",
    OUTREACH_UNSUBSCRIBE_SECRET: "unsub-secret",
    MAILING_ADDRESS: "123 Example St, Town, ST 00000",
    ...overrides,
  } as unknown as Env;

  return { env, leads, logs, kv };
}

type FetchLog = { url: string; body?: any }[];

function stubFetch(resend: { status: number; body: any } = { status: 200, body: { id: "em_1" } }) {
  const calls: FetchLog = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.startsWith("https://cloudflare-dns.com/")) {
        return Response.json({ Status: 0, Answer: [{ type: 15, data: "10 mx.example.com." }] });
      }
      if (url === "https://api.resend.com/emails") {
        return Response.json(resend.body, { status: resend.status });
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );
  return calls;
}

const resendCalls = (calls: FetchLog) => calls.filter(c => c.url === "https://api.resend.com/emails");

function req(path: string, token: string | null, body?: unknown, method = "POST") {
  return new Request(`https://w.test${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const goodLead = {
  company: "Acme Labs",
  contact_name: "Dana Reyes",
  contact_email: "dana@acmelabs.com",
  industry: "pharmaceuticals",
  ...goodMeta,
};

describe("worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const run = (env: Env, path: string, token: string | null, body?: unknown) =>
    worker.fetch(req(path, token, body), env);

  it("rejects an unverified lead with reasons", async () => {
    const { env, leads } = fakeEnv();
    stubFetch();
    const r = await run(env, "/admin/leads", "admin-tok", {
      company: "DEA", contact_name: "Pilot Coordinator", contact_email: "tracking@dea.gov",
    });
    expect(r.status).toBe(422);
    expect((await r.json()).reasons).toContain("government_or_military_address");
    expect(leads).toHaveLength(0);
  });

  it("dry-run /admin/run never calls Resend, even for approved leads", async () => {
    const { env } = fakeEnv();
    const calls = stubFetch();
    await run(env, "/admin/leads", "admin-tok", goodLead);
    await run(env, "/admin/approve", "approver-tok", { lead_ids: [1] });
    const r = await run(env, "/admin/run", "admin-tok");
    const j = await r.json();
    expect(j.mode).toBe("dry_run");
    expect(j.sends).toBe(0);
    expect(j.drafts[0].ok).toBe(true);
    expect(resendCalls(calls)).toHaveLength(0);
  });

  it("the admin token cannot approve", async () => {
    const { env, leads } = fakeEnv();
    stubFetch();
    await run(env, "/admin/leads", "admin-tok", goodLead);
    const r = await run(env, "/admin/approve", "admin-tok", { lead_ids: [1] });
    expect(r.status).toBe(401);
    expect(leads[0].status).toBe("new");
  });

  it("live mode sends only approved leads, with footer and unsubscribe headers", async () => {
    const { env, leads } = fakeEnv({ OUTREACH_MODE: "live" });
    const calls = stubFetch();
    await run(env, "/admin/leads", "admin-tok", goodLead);
    await run(env, "/admin/leads", "admin-tok", { ...goodLead, contact_email: "sam@acmelabs.com", contact_name: "Sam Lee" });
    await run(env, "/admin/approve", "approver-tok", { lead_ids: [1] });

    const j = await (await run(env, "/admin/run", "admin-tok")).json();
    expect(j.sent).toBe(1);
    const sends = resendCalls(calls);
    expect(sends).toHaveLength(1);
    expect(sends[0].body.to).toEqual(["dana@acmelabs.com"]);
    expect(sends[0].body.text).toContain("123 Example St");
    expect(sends[0].body.text).toContain("/unsubscribe?e=dana%40acmelabs.com&t=");
    expect(sends[0].body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(leads.map(l => l.status)).toEqual(["sent", "new"]);

    // A second run sends nothing: the lead is no longer approved.
    await run(env, "/admin/run", "admin-tok");
    expect(resendCalls(calls)).toHaveLength(1);
  });

  it("live mode fails closed without a postal address", async () => {
    const { env } = fakeEnv({ OUTREACH_MODE: "live", MAILING_ADDRESS: "" });
    const calls = stubFetch();
    const r = await run(env, "/admin/run", "admin-tok");
    expect(r.status).toBe(500);
    expect((await r.json()).missing).toContain("MAILING_ADDRESS");
    expect(resendCalls(calls)).toHaveLength(0);
  });

  it("a Resend auth error stops the batch without suppressing or failing leads", async () => {
    const { env, leads, kv } = fakeEnv({ OUTREACH_MODE: "live" });
    const calls = stubFetch({ status: 401, body: { message: "API key is invalid" } });
    await run(env, "/admin/leads", "admin-tok", goodLead);
    await run(env, "/admin/leads", "admin-tok", { ...goodLead, contact_email: "sam@acmelabs.com", contact_name: "Sam Lee" });
    await run(env, "/admin/approve", "approver-tok", { lead_ids: [1, 2] });

    const r = await run(env, "/admin/run", "admin-tok");
    expect(r.status).toBe(502);
    expect(resendCalls(calls)).toHaveLength(1);
    expect(leads.map(l => l.status)).toEqual(["approved", "approved"]);
    expect(kv.size).toBe(0);
  });

  it("blocks an approved lead that was already emailed", async () => {
    const { env, leads, logs } = fakeEnv({ OUTREACH_MODE: "live" });
    const calls = stubFetch();
    await run(env, "/admin/leads", "admin-tok", goodLead);
    await run(env, "/admin/approve", "approver-tok", { lead_ids: [1] });
    logs.push({ lead_id: 1, status: "ok", error_message: null }); // a legacy send
    const j = await (await run(env, "/admin/run", "admin-tok")).json();
    expect(j.blocked).toBe(1);
    expect(j.results[0].reasons).toContain("already_emailed");
    expect(resendCalls(calls)).toHaveLength(0);
    expect(leads[0].status).toBe("blocked");
  });

  it("unsubscribe link suppresses the address; a forged token does not", async () => {
    const { env, leads, kv } = fakeEnv({ OUTREACH_MODE: "live" });
    const calls = stubFetch();
    await run(env, "/admin/leads", "admin-tok", goodLead);
    await run(env, "/admin/approve", "approver-tok", { lead_ids: [1] });
    await run(env, "/admin/run", "admin-tok");
    const link: string = resendCalls(calls)[0].body.headers["List-Unsubscribe"].slice(1, -1);

    const forged = link.replace(/t=[0-9a-f]+/, "t=" + "0".repeat(32));
    expect((await worker.fetch(new Request(forged), env)).status).toBe(400);
    expect(kv.size).toBe(0);

    const ok = await worker.fetch(new Request(link, { method: "POST" }), env);
    expect(ok.status).toBe(200);
    expect(kv.has("suppress:dana@acmelabs.com")).toBe(true);
    expect(leads[0].status).toBe("suppressed");
  });

  it("buildDraft addresses the person by first name and passes every check", async () => {
    const { env } = fakeEnv();
    const d = await buildDraft(
      {
        id: 7, email: "Dana@AcmeLabs.com", name: "Dana Reyes", company: "Acme Labs", industry: "luxury",
        score: 0, status: "new", metadata: JSON.stringify(goodMeta), created_at: "now",
      },
      env
    );
    expect(d.ok).toBe(true);
    expect(d.to).toBe("dana@acmelabs.com");
    expect(d.body.startsWith("Hi Dana,")).toBe(true);
  });
});
