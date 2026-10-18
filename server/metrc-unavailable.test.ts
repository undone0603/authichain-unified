import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runStrainChainSync } from "./jobs/strainchain-sync";
import { metrcUnavailable } from "./metrc-unavailable";

const root = import.meta.dirname;

describe("metrc unavailable", () => {
  it("returns no census and no passport scan", () => {
    const result = metrcUnavailable();
    expect(result).toEqual({ available: false, reason: "metrc_unavailable" });
    expect(JSON.stringify(result)).not.toMatch(
      /42|1042|98\.4|LARA|Michigan|passport|genuine/i,
    );
  });

  it("the sync function does not call METRC or anchor", async () => {
    await expect(runStrainChainSync()).resolves.toEqual({
      itemsProcessed: 0,
      details: { status: "metrc_unavailable", totalAnchored: 0 },
    });
  });

  it("the job and the router do not reach the METRC client", () => {
    const job = readFileSync(path.join(root, "jobs/strainchain-sync.ts"), "utf8");
    const router = readFileSync(path.join(root, "routers/metrc.ts"), "utf8");
    const schedule = readFileSync(path.join(root, "scheduled-jobs.ts"), "utf8");
    const jobBlock = schedule.slice(schedule.indexOf('name: "strainchain-metrc-sync"'));
    expect(job).not.toMatch(/syncMetrcTransfers|anchorPackageToTruthLayer|api-mi\.metrc/);
    expect(router).not.toMatch(
      /syncMetrcTransfers|anchorPackageToTruthLayer|api-mi\.metrc|activeLicenses/,
    );
    expect(jobBlock.startsWith('name: "strainchain-metrc-sync"')).toBe(true);
    expect(jobBlock.slice(0, 500)).toMatch(/enabled: false/);
    expect(jobBlock.slice(0, 500)).not.toMatch(/runStrainChainSync/);
  });
});
