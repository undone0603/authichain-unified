import { describe, expect, it } from "vitest";
import { computeModeUsageDigest, runModeUsageCron } from "./mode-usage-cron";

describe("computeModeUsageDigest", () => {
  it("alerts at >=100 total when a core mode is under 5%", () => {
    const d = computeModeUsageDigest({ total: 100, byMode: { stellar_seal: 50, batch_verify: 46, limited_drop: 4 } });
    expect(d.alert).toBe(true);
    expect(d.low_share_modes).toEqual(["limited_drop"]);
  });
  it("no alert at exactly 5%", () => {
    expect(computeModeUsageDigest({ total: 100, byMode: { stellar_seal: 5, batch_verify: 5, limited_drop: 5 } }).alert).toBe(false);
  });
  it("no alert under 100 total", () => {
    expect(computeModeUsageDigest({ total: 99, byMode: {} }).alert).toBe(false);
  });
  it("zero total is safe", () => {
    const d = computeModeUsageDigest({ total: 0, byMode: {} });
    expect(d.shares.stellar_seal).toBe(0);
    expect(d.alert).toBe(false);
  });
});

describe("runModeUsageCron", () => {
  it("disabled (default) only logs dry-run and never loads", async () => {
    const lines: string[] = [];
    let loaded = false;
    for (const env of [undefined, {}, { MODE_USAGE_CRON_ENABLED: "false" }]) {
      const r = await runModeUsageCron(env, { log: l => lines.push(l), loadCounts: async () => { loaded = true; return null; } });
      expect(r.status).toBe("dry_run");
    }
    expect(loaded).toBe(false);
    expect(lines.every(l => JSON.parse(l).status === "dry-run")).toBe(true);
  });
  it("enabled without a data source reports no_data_source", async () => {
    const r = await runModeUsageCron({ MODE_USAGE_CRON_ENABLED: "true" }, { log: () => {} });
    expect(r.status).toBe("no_data_source");
  });
  it("enabled with counts logs the digest", async () => {
    const lines: string[] = [];
    const r = await runModeUsageCron({ MODE_USAGE_CRON_ENABLED: "true" }, {
      log: l => lines.push(l),
      loadCounts: async () => ({ total: 200, byMode: { stellar_seal: 100, batch_verify: 99, limited_drop: 1 } }),
    });
    expect(r.status).toBe("ok");
    expect(JSON.parse(lines[0]).alert).toBe(true);
  });
  it("loader errors are logged, not thrown", async () => {
    const r = await runModeUsageCron({ MODE_USAGE_CRON_ENABLED: "true" }, {
      log: () => {},
      loadCounts: async () => { throw new Error("x"); },
    });
    expect(r.status).toBe("error");
  });
});
