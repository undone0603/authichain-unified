import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authorizeGenesis, genesisJson } from "./genesis-cycle";

describe("authorizeGenesis", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "genesis-test-secret";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("rejects a request without a bearer token", () => {
    const req = new Request("https://authichain.com/api/automation/cron");
    expect(authorizeGenesis(req)).toBe(false);
  });

  it("accepts Authorization: Bearer $CRON_SECRET", () => {
    const req = new Request("https://authichain.com/api/automation/cron", {
      headers: { authorization: "Bearer genesis-test-secret" },
    });
    expect(authorizeGenesis(req)).toBe(true);
  });
});

describe("genesisJson", () => {
  it("marks the cycle as genesis and includes a timestamp", () => {
    const body = genesisJson({ maintenance: "ok" });
    expect(body.ok).toBe(true);
    expect(body.status).toBe("genesis");
    expect(body.results).toEqual({ maintenance: "ok" });
    expect(typeof body.timestamp).toBe("string");
  });
});

describe("runGenesisCycle freeze gate", () => {
  it("does not import the outbound autonomous controller", async () => {
    vi.resetModules();
    vi.doMock("./automation", () => ({
      runDailyMaintenance: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("./supabase-admin", () => ({
      supabaseAdmin: {
        from: () => ({
          select: () => ({
            limit: async () => ({ data: [], count: 0, error: null }),
          }),
        }),
      },
    }));
    const { runGenesisCycle } = await import("./genesis-cycle");
    const results = await runGenesisCycle();
    expect(results.outbound).toBe("skipped_public_loop_freeze");
    expect(results.maintenance).toBe("ok");
    const economy = results.economy as { theater?: boolean };
    expect(economy.theater).toBe(true);
  });
});
