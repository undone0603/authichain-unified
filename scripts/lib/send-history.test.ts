// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { priorContact, recordContact } from "./send-history";

type Rows = Record<string, any[]>;

/** Minimal PostgREST-style fake: records filters, returns rows that match eq/ilike. */
function fakeAdmin(rows: Rows, failOn?: string) {
  const upserts: { table: string; row: any }[] = [];
  const from = (table: string) => {
    const filters: [string, string, any][] = [];
    const matches = (r: any) =>
      filters.every(([op, col, v]) => {
        const actual =
          col === "metadata->>email" ? r.metadata?.email : r[col];
        if (op === "eq") return actual === v;
        return String(actual ?? "").toLowerCase() === String(v).replace(/\\/g, "").toLowerCase();
      });
    const result = () =>
      failOn === table
        ? { data: null, error: { message: `${table} unavailable` } }
        : { data: (rows[table] ?? []).filter(matches), error: null };
    const q: any = {
      select: () => q,
      eq: (c: string, v: any) => (filters.push(["eq", c, v]), q),
      ilike: (c: string, v: any) => (filters.push(["ilike", c, v]), q),
      limit: () => Promise.resolve(result()),
      maybeSingle: () => {
        const r = result();
        return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
      },
      upsert: (row: any) => {
        upserts.push({ table, row });
        return Promise.resolve({ error: null });
      },
    };
    return q;
  };
  return { admin: { from }, upserts };
}

describe("priorContact", () => {
  it("allows an address with no history", async () => {
    const { admin } = fakeAdmin({});
    expect(await priorContact(admin, "new@acme.com")).toEqual({ blocked: false });
  });

  it("blocks an address a past run sent to, even with different case", async () => {
    const { admin } = fakeAdmin({
      guardrail_events: [
        {
          action: "record",
          allowed: true,
          reason: "sent",
          metadata: { email: "inquiries@moo.com" },
          created_at: "2026-09-20T14:00:00Z",
        },
      ],
    });
    const r = await priorContact(admin, "Inquiries@MOO.com");
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain("already_emailed");
  });

  it("blocks suppressed and contacted addresses", async () => {
    const { admin } = fakeAdmin({
      guardrail_suppression_list: [{ email: "a@x.com", reason: "unsubscribe" }],
      leads: [{ email: "b@x.com", status: "contacted" }],
    });
    expect((await priorContact(admin, "a@x.com")).reason).toBe("suppressed: unsubscribe");
    expect((await priorContact(admin, "b@x.com")).blocked).toBe(true);
  });

  it("fails closed when history cannot be read", async () => {
    const { admin } = fakeAdmin({}, "guardrail_events");
    const r = await priorContact(admin, "new@acme.com");
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain("send_history_unavailable");
  });
});

describe("recordContact", () => {
  it("adds the address to the suppression list so no later run resends", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-23T12:00:00Z"));
    const { admin, upserts } = fakeAdmin({});
    await recordContact(admin, " Dana@Acme.com ", "email.b2b-cold");
    vi.useRealTimers();
    expect(upserts).toEqual([
      {
        table: "guardrail_suppression_list",
        row: {
          email: "dana@acme.com",
          reason: "contacted 2026-09-23 via email.b2b-cold",
          source: "email.b2b-cold",
        },
      },
    ]);
  });
});
