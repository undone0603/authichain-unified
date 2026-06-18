import { describe, it, expect, vi, beforeEach } from "vitest";

// getFounderSnapshot is the read-only "founder heartbeat" the admin dashboard
// reads. It must degrade safely: when the database is unavailable it returns a
// fully-zeroed payload rather than throwing, so the dashboard still renders.

vi.mock("../db", () => ({ getDb: vi.fn() }));

import { getFounderSnapshot } from "./snapshot";
import { getDb } from "../db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFounderSnapshot — safe fallback", () => {
  it("returns a fully-zeroed snapshot when there is no database (no throw)", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const snap = await getFounderSnapshot();

    expect(snap.revenue).toEqual({ today: 0, last7d: 0, last30d: 0, txnsToday: 0, bySourceLast30d: {} });
    expect(snap.pipeline).toEqual({ leadsByStatus: {}, leadsLast24h: 0 });
    expect(snap.approvals).toEqual({
      draftsPending: 0,
      draftsByKind: {},
      payoutsPendingApproval: 0,
      payoutsPendingTotalUsd: 0,
    });
    expect(snap.autonomy).toEqual({ jobs: [], missionsActive: 0, tasksByStatus: {} });
    expect(snap.health).toEqual({ failuresLast24h: 0, recentFailures: [] });
    expect(typeof snap.generatedAt).toBe("string");
  });
});
