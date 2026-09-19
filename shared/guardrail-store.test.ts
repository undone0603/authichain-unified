import { describe, it, expect, beforeEach } from "vitest";
import {
  checkAndReserveWithSupabase,
  recordEventWithSupabase,
  addSuppressionWithSupabase,
  ensureLiveB2bChannel,
  B2B_CHANNEL,
  B2B_DAILY_CAP,
  type GuardrailAdmin,
} from "./guardrail-store";

type Row = Record<string, unknown>;

function makeAdmin(seed?: {
  channels?: Row[];
  kills?: Row[];
  suppression?: Row[];
  counters?: Row[];
}): GuardrailAdmin & { events: Row[]; counters: Row[]; channels: Row[] } {
  const channels = [...(seed?.channels ?? [])];
  const kills = [...(seed?.kills ?? [])];
  const suppression = [...(seed?.suppression ?? [])];
  const counters = [...(seed?.counters ?? [])];
  const events: Row[] = [];

  function table(name: string) {
    const rows =
      name === "guardrail_channels"
        ? channels
        : name === "kill_switches"
          ? kills
          : name === "guardrail_suppression_list"
            ? suppression
            : name === "guardrail_counters"
              ? counters
              : name === "guardrail_events"
                ? events
                : [];

    const filters: Array<[string, unknown]> = [];
    let pendingUpdate: Row | null = null;
    let mode: "select" | "insert" | "upsert" | "update" = "select";

    const q: any = {
      select() {
        return q;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return q;
      },
      insert(row: Row) {
        mode = "insert";
        rows.push(row);
        return q;
      },
      upsert(row: Row, opts?: { ignoreDuplicates?: boolean }) {
        mode = "upsert";
        const key =
          name === "guardrail_channels"
            ? "name"
            : name === "guardrail_suppression_list"
              ? "email"
              : "channel_id";
        const existing = rows.find(
          r =>
            r[key] === row[key] && (key !== "channel_id" || r.day === row.day)
        );
        if (existing) {
          if (!opts?.ignoreDuplicates) Object.assign(existing, row);
        } else {
          if (name === "guardrail_counters" && row.id == null)
            row.id = rows.length + 1;
          if (name === "guardrail_channels" && row.id == null)
            row.id = rows.length + 1;
          rows.push(row);
        }
        return q;
      },
      update(row: Row) {
        mode = "update";
        pendingUpdate = row;
        return q;
      },
      async maybeSingle() {
        const match = rows.filter(r => filters.every(([c, v]) => r[c] === v));
        if (mode === "update" && pendingUpdate) {
          const target = match[0];
          if (!target) return { data: null, error: null };
          Object.assign(target, pendingUpdate);
          return { data: target, error: null };
        }
        return { data: match[0] ?? null, error: null };
      },
    };
    return q;
  }

  return {
    from: (name: string) => table(name),
    events,
    counters,
    channels,
  };
}

const CHANNEL = { id: 1, name: "email.b2b-cold", daily_cap: 25, enabled: true };

describe("checkAndReserveWithSupabase", () => {
  let admin: ReturnType<typeof makeAdmin>;

  beforeEach(() => {
    admin = makeAdmin({ channels: [CHANNEL] });
  });

  it("allows a send within the daily cap and reserves it", async () => {
    const result = await checkAndReserveWithSupabase(
      admin,
      "email.b2b-cold",
      1
    );
    expect(result).toEqual({ allowed: true, remaining: 24 });
    expect(admin.counters[0].count).toBe(1);
  });

  it("denies when the global kill switch is engaged", async () => {
    admin = makeAdmin({
      channels: [CHANNEL],
      kills: [{ scope: "global", enabled: true, reason: "stop" }],
    });
    const result = await checkAndReserveWithSupabase(
      admin,
      "email.b2b-cold",
      1
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/global kill switch/);
  });

  it("denies an unknown channel", async () => {
    admin = makeAdmin();
    const result = await checkAndReserveWithSupabase(admin, "nope", 1);
    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      reason: "unknown channel: nope",
    });
  });

  it("denies a disabled channel", async () => {
    admin = makeAdmin({
      channels: [{ ...CHANNEL, enabled: false }],
    });
    const result = await checkAndReserveWithSupabase(
      admin,
      "email.b2b-cold",
      1
    );
    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      reason: "channel disabled",
    });
  });

  it("denies a suppressed recipient", async () => {
    admin = makeAdmin({
      channels: [CHANNEL],
      suppression: [{ email: "bad@example.com", reason: "bounced" }],
    });
    const result = await checkAndReserveWithSupabase(
      admin,
      "email.b2b-cold",
      1,
      "Bad@Example.com"
    );
    expect(result.reason).toMatch(/suppressed: bounced/);
  });

  it("denies when the daily cap is already reached", async () => {
    admin = makeAdmin({
      channels: [CHANNEL],
      counters: [
        {
          id: 9,
          channel_id: 1,
          day: new Date().toISOString().slice(0, 10),
          count: 25,
        },
      ],
    });
    const result = await checkAndReserveWithSupabase(
      admin,
      "email.b2b-cold",
      1
    );
    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      reason: "daily cap reached",
    });
  });

  it("denies a non-positive count", async () => {
    const result = await checkAndReserveWithSupabase(
      admin,
      "email.b2b-cold",
      0
    );
    expect(result.reason).toBe("invalid count");
  });
});

describe("recordEventWithSupabase / addSuppressionWithSupabase", () => {
  it("logs an event tied to the resolved channel id", async () => {
    const admin = makeAdmin({ channels: [CHANNEL] });
    await recordEventWithSupabase(admin, {
      channel: "email.b2b-cold",
      action: "record",
      allowed: true,
      reason: "sent",
    });
    expect(admin.events[0]).toMatchObject({
      channel_id: 1,
      action: "record",
      allowed: true,
      reason: "sent",
    });
  });

  it("lowercases suppression emails", async () => {
    const admin = makeAdmin();
    await addSuppressionWithSupabase(
      admin,
      "Bad@Example.com",
      "bounced",
      "test"
    );
    const { data } = await admin
      .from("guardrail_suppression_list")
      .select("email")
      .eq("email", "bad@example.com")
      .maybeSingle();
    expect(data.email).toBe("bad@example.com");
  });
});

describe("ensureLiveB2bChannel", () => {
  it("upserts email.b2b-cold as enabled with the daily cap", async () => {
    const admin = makeAdmin();
    await ensureLiveB2bChannel(admin);
    expect(admin.channels[0]).toMatchObject({
      name: B2B_CHANNEL,
      enabled: true,
      daily_cap: B2B_DAILY_CAP,
    });
  });
});
