// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const guardedSend = vi.fn();
const checkSender = vi.fn();

vi.mock("../../server/outreach/send-guard", () => ({
  guardedSend: (args: unknown) => guardedSend(args),
}));
vi.mock("../../server/email-service", () => ({
  // The real one swaps in a recorder; the guard itself is mocked above.
  withDryRunEmail: async (fn: () => Promise<unknown>) => ({
    result: await fn(),
    sends: [],
  }),
}));
vi.mock("../lib/resend-preflight", () => ({
  checkSender: (from: string) => checkSender(from),
  reportSenderFailure: vi.fn(),
}));

import { dppOptInMessage } from "../../src/lib/dpp-followup";
import { maskEmail, renderReport, run } from "../dpp-followup";

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

function optIn(email: string, hours = 6) {
  return {
    id: email,
    email,
    source: "dpp-check",
    product_interest: "dpp_check_followup",
    message: dppOptInMessage({
      category: "battery_passport",
      score: 40,
      band: "partly_ready",
    }),
    created_at: hoursAgo(hours),
  };
}

type Table = { data?: unknown[]; error?: { message: string } };

/** Just enough of the Supabase query builder for the calls the script makes. */
function fakeAdmin(tables: Record<string, Table>) {
  const writes: { table: string; op: string; row: Record<string, unknown> }[] =
    [];
  return {
    writes,
    from(table: string) {
      const t = tables[table] ?? {};
      const q: Record<string, unknown> = {};
      for (const m of [
        "select",
        "eq",
        "gte",
        "order",
        "limit",
        "in",
        "ilike",
      ]) {
        q[m] = () => q;
      }
      q.maybeSingle = async () => ({ data: null, error: null });
      q.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: t.data ?? [], error: t.error ?? null });
      q.insert = async (row: Record<string, unknown>) => {
        writes.push({ table, op: "insert", row });
        return { error: null };
      };
      q.upsert = async (row: Record<string, unknown>) => {
        writes.push({ table, op: "upsert", row });
        return { error: null };
      };
      return q;
    },
  };
}

const LIVE = {
  DRY_RUN: "false",
  OWNER_LIVE_SEND: "true",
  RESEND_API_KEY: "key-1",
};

beforeEach(() => {
  guardedSend.mockReset();
  checkSender.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("maskEmail / renderReport", () => {
  it("keeps two characters and the domain", () => {
    expect(maskEmail("jordan@example.com")).toBe("jo***@example.com");
  });

  it("never prints a full address", () => {
    const report = renderReport("dry-run", 1, [
      {
        who: maskEmail("jordan@example.com"),
        status: "would_send",
        detail: "x",
      },
    ]);
    expect(report).toContain("jo***@example.com");
    expect(report).not.toContain("jordan@example.com");
  });

  it("says so when nothing is due", () => {
    expect(renderReport("dry-run", 0, [])).toContain("Nothing due.");
  });
});

describe("run: dry run (the default)", () => {
  it("reports what would send and writes nothing", async () => {
    guardedSend.mockResolvedValue({ sent: false, reason: "dry_run" });
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
    });

    const res = await run(admin, {});

    expect(res.code).toBe(0);
    expect(res.outcomes).toEqual([
      expect.objectContaining({
        who: "bu***@example.com",
        status: "would_send",
      }),
    ]);
    expect(guardedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        source: "inbound_optin",
      })
    );
    expect(admin.writes).toEqual([]);
    expect(checkSender).not.toHaveBeenCalled();
    expect(res.report).not.toContain("buyer@example.com");
  });

  it("reports the guard's reason when a gate would block the send", async () => {
    guardedSend.mockResolvedValue({ sent: false, reason: "no_mx" });
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
    });
    const res = await run(admin, {});
    expect(res.outcomes[0]).toMatchObject({
      status: "skipped",
      detail: "blocked: no_mx",
    });
  });

  it("stays a dry run when DRY_RUN=false but the owner switch is off", async () => {
    guardedSend.mockResolvedValue({ sent: false, reason: "dry_run" });
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
    });

    const res = await run(admin, { DRY_RUN: "false" });

    expect(res.outcomes[0].status).toBe("would_send");
    expect(checkSender).not.toHaveBeenCalled();
    expect(admin.writes).toEqual([]);
  });
});

describe("run: who is never emailed", () => {
  it("skips someone who started checkout or paid, without calling the guard", async () => {
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
      funnel_events: { data: [{ metadata: { email: "Buyer@Example.com" } }] },
    });
    const res = await run(admin, LIVE);
    expect(res.outcomes).toEqual([]);
    expect(guardedSend).not.toHaveBeenCalled();
  });

  it("skips someone the send history says was already contacted", async () => {
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
      guardrail_events: { data: [{ created_at: "2026-10-01" }] },
    });
    const res = await run(admin, LIVE);
    expect(res.outcomes[0]).toMatchObject({ status: "skipped" });
    expect(res.outcomes[0].detail).toContain("already_emailed");
    expect(guardedSend).not.toHaveBeenCalled();
  });

  it("ignores rows that are not a consenting /dpp-check opt-in", async () => {
    const admin = fakeAdmin({
      lead_captures: {
        data: [
          { ...optIn("a@example.com"), product_interest: "qron" },
          { ...optIn("b@example.com"), message: "hi" },
        ],
      },
    });
    const res = await run(admin, LIVE);
    expect(res.outcomes).toEqual([]);
    expect(guardedSend).not.toHaveBeenCalled();
  });
});

describe("run: fails closed", () => {
  it("sends nobody when opt-ins cannot be read", async () => {
    const admin = fakeAdmin({ lead_captures: { error: { message: "boom" } } });
    const res = await run(admin, LIVE);
    expect(res.code).toBe(1);
    expect(guardedSend).not.toHaveBeenCalled();
  });

  it("sends nobody when checkout history cannot be read", async () => {
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
      funnel_events: { error: { message: "boom" } },
    });
    const res = await run(admin, LIVE);
    expect(res.code).toBe(1);
    expect(guardedSend).not.toHaveBeenCalled();
  });

  it("sends nobody when send history cannot be read", async () => {
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
      guardrail_events: { error: { message: "boom" } },
    });
    const res = await run(admin, LIVE);
    expect(res.outcomes[0].detail).toContain("send_history_unavailable");
    expect(guardedSend).not.toHaveBeenCalled();
  });

  it("does not send when the sender cannot send", async () => {
    checkSender.mockResolvedValue({
      ok: false,
      from: "x",
      reason: "nope",
      kind: "invalid_key",
    });
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
    });
    const res = await run(admin, LIVE);
    expect(res.code).toBe(1);
    expect(res.outcomes[0].status).toBe("failed");
    expect(guardedSend).not.toHaveBeenCalled();
  });
});

describe("run: live", () => {
  it("sends through the guard with the owning credential, then records the contact", async () => {
    checkSender.mockResolvedValue({
      ok: true,
      from: "x",
      credential: "RESEND_API_KEY",
    });
    guardedSend.mockResolvedValue({ sent: true, id: "re_1" });
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
    });

    const res = await run(admin, LIVE);

    expect(res.code).toBe(0);
    expect(res.outcomes[0]).toMatchObject({
      who: "bu***@example.com",
      status: "sent",
    });
    expect(guardedSend).toHaveBeenCalledWith(
      expect.objectContaining({ source: "inbound_optin", apiKey: "key-1" })
    );
    const suppress = admin.writes.find(
      w => w.table === "guardrail_suppression_list"
    );
    expect(suppress?.row).toMatchObject({
      email: "buyer@example.com",
      source: "dpp-followup",
    });
    const log = admin.writes.find(w => w.table === "automation_logs");
    expect(log?.row).toMatchObject({
      workflow_name: "dpp_followup",
      status: "success",
    });
    expect(String(log?.row.payload)).not.toContain("buyer@example.com");
    expect(res.report).not.toContain("buyer@example.com");
  });

  it("respects MAX_LIVE_SENDS", async () => {
    checkSender.mockResolvedValue({
      ok: true,
      from: "x",
      credential: "RESEND_API_KEY",
    });
    guardedSend.mockResolvedValue({ sent: true, id: "re_1" });
    const admin = fakeAdmin({
      lead_captures: {
        data: [
          optIn("a@example.com", 9),
          optIn("b@example.com", 8),
          optIn("c@example.com", 7),
        ],
      },
    });

    const res = await run(admin, { ...LIVE, MAX_LIVE_SENDS: "1" });

    expect(guardedSend).toHaveBeenCalledTimes(1);
    expect(res.outcomes.map(o => o.status)).toEqual([
      "sent",
      "skipped",
      "skipped",
    ]);
  });

  it("does not record a contact when the guard refuses", async () => {
    checkSender.mockResolvedValue({
      ok: true,
      from: "x",
      credential: "RESEND_API_KEY",
    });
    guardedSend.mockResolvedValue({
      sent: false,
      reason: "claim:statistic:40%",
    });
    const admin = fakeAdmin({
      lead_captures: { data: [optIn("buyer@example.com")] },
    });

    const res = await run(admin, LIVE);

    expect(res.code).toBe(1);
    expect(res.outcomes[0].status).toBe("failed");
    expect(admin.writes).toEqual([]);
  });
});
