import { describe, it, expect, vi } from "vitest";

// Same seam as reputation.test.ts: intercept drizzle() so db.ts internals are observable.
const rows = [
  { jobName: "pipeline-tick", status: "completed", startedAt: new Date("2026-07-15T10:00:00Z"), error: null, result: null },
  { jobName: "pipeline-tick", status: "failed", startedAt: new Date("2026-07-15T11:00:00Z"), error: "boom", result: { step: 3 } },
  { jobName: "dunning", status: "completed", startedAt: new Date("2026-07-15T09:00:00Z"), error: null, result: null },
  { jobName: "dunning", status: "running", startedAt: new Date("2026-07-15T11:30:00Z"), error: null, result: null },
];

const limit = vi.fn(async () => rows);
const orderBy = vi.fn(() => ({ limit }));
const where = vi.fn(() => ({ orderBy }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));

vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({ select }) }));
vi.mock("pg", () => ({ Pool: class {} }));

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";

import * as db from "./db";

describe("getOpsSummary", () => {
  it("aggregates job runs into the OpsDashboard shape", async () => {
    const s = await db.getOpsSummary();

    expect(s.window_hours).toBe(24);
    expect(s.totals).toEqual({ success: 2, failure: 1 });

    const pipeline = s.summary.find(x => x.workflow === "pipeline-tick");
    expect(pipeline).toMatchObject({ success: 1, failure: 1, last_error: "boom" });
    // failures sort first
    expect(s.summary[0].workflow).toBe("pipeline-tick");

    expect(s.failures).toHaveLength(1);
    expect(s.failures[0]).toMatchObject({ workflow: "pipeline-tick", error: "boom", payload: JSON.stringify({ step: 3 }) });

    // running maps through untouched; completed/failed translate to UI vocabulary
    const statuses = s.recent.map(r => r.status).sort();
    expect(statuses).toEqual(["failure", "running", "success", "success"]);
  });
});
