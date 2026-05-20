import { describe, it, expect } from "vitest";
import { aggregateAuthentications } from "./aggregate";

describe("aggregateAuthentications", () => {
  it("returns zero-state when there are no rows", () => {
    const result = aggregateAuthentications([], new Date("2026-04-27T00:00:00Z"));
    expect(result.stats.totalScans).toBe(0);
    expect(result.stats.counterfeitRate).toBe(0);
    expect(result.stats.authenticScans).toBe(0);
    expect(result.stats.counterfeitScans).toBe(0);
    expect(result.dailyTrends).toHaveLength(7);
    expect(result.dailyTrends.every((d) => d.scans === 0)).toBe(true);
  });

  it("rounds counterfeitRate to a whole percent", () => {
    const rows = [
      { result: "authentic", createdAt: "2026-04-27T10:00:00Z" },
      { result: "counterfeit", createdAt: "2026-04-27T10:00:00Z" },
      { result: "authentic", createdAt: "2026-04-27T10:00:00Z" },
    ];
    const result = aggregateAuthentications(rows, new Date("2026-04-27T00:00:00Z"));
    expect(result.stats.totalScans).toBe(3);
    expect(result.stats.counterfeitScans).toBe(1);
    expect(result.stats.authenticScans).toBe(2);
    expect(result.stats.counterfeitRate).toBe(33); // 1/3 = 33.33% → rounded
  });

  it("ignores 'uncertain' rows when counting authentic/counterfeit but includes them in totalScans", () => {
    const rows = [
      { result: "authentic", createdAt: "2026-04-27T10:00:00Z" },
      { result: "uncertain", createdAt: "2026-04-27T10:00:00Z" },
      { result: "counterfeit", createdAt: "2026-04-27T10:00:00Z" },
    ];
    const result = aggregateAuthentications(rows, new Date("2026-04-27T00:00:00Z"));
    expect(result.stats.totalScans).toBe(3);
    expect(result.stats.authenticScans).toBe(1);
    expect(result.stats.counterfeitScans).toBe(1);
    // counterfeitRate = 1/3 of total (uncertain still in denominator)
    expect(result.stats.counterfeitRate).toBe(33);
  });

  it("groups dailyTrends across last 7 days, oldest first", () => {
    const now = new Date("2026-04-27T12:00:00Z");
    const rows = [
      { result: "authentic", createdAt: "2026-04-27T10:00:00Z" },
      { result: "authentic", createdAt: "2026-04-27T11:00:00Z" },
      { result: "counterfeit", createdAt: "2026-04-26T10:00:00Z" },
      { result: "counterfeit", createdAt: "2026-04-21T10:00:00Z" }, // 6 days back, still in window
      { result: "authentic", createdAt: "2026-04-20T10:00:00Z" }, // 7 days back, OUT of window
    ];
    const result = aggregateAuthentications(rows, now);
    expect(result.dailyTrends).toHaveLength(7);
    // First entry = oldest (6 days ago = 2026-04-21)
    expect(result.dailyTrends[0].counterfeit).toBe(1);
    expect(result.dailyTrends[0].authentic).toBe(0);
    // Last entry = today (2026-04-27)
    expect(result.dailyTrends[6].authentic).toBe(2);
    expect(result.dailyTrends[6].counterfeit).toBe(0);
    // Day 5 (2026-04-26)
    expect(result.dailyTrends[5].counterfeit).toBe(1);
    // 2026-04-20 row should not appear in any day (out of window)
    const totalInTrends = result.dailyTrends.reduce((s, d) => s + d.scans, 0);
    expect(totalInTrends).toBe(4); // 5 rows minus the out-of-window one
  });

  it("accepts both Date and string createdAt values", () => {
    const rows = [
      { result: "authentic", createdAt: new Date("2026-04-27T10:00:00Z") },
      { result: "authentic", createdAt: "2026-04-27T11:00:00Z" },
    ];
    const result = aggregateAuthentications(rows, new Date("2026-04-27T12:00:00Z"));
    expect(result.dailyTrends[6].authentic).toBe(2);
  });
});
