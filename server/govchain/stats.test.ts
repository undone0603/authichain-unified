import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ logActivity: vi.fn() }));

import { govchainRouter } from "./router";

describe("govchain.stats publishes no figures", () => {
  it("returns the same keys, all null", async () => {
    const caller = govchainRouter.createCaller({ user: null, req: {}, res: {} } as any);
    const result = await caller.stats();
    expect(result).toEqual({
      activeAgencies: null,
      passportsIssued: null,
      complianceScore: null,
      network: null,
    });
    const body = JSON.stringify(result);
    for (const fake of ["1420", "99.9", "12", "FIPS"]) expect(body).not.toContain(fake);
  });
});
