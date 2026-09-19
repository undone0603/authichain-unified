import { describe, expect, it } from "vitest";
import { DEMO_PROFILE_ID, loadLedgerCounts } from "./ledger-counts";

function client(result: {
  profiles?: { count: number };
  qrons?: { count: number; data: Array<{ scan_count?: number | null }> };
}) {
  const calls: Array<{ table: string; eq?: [string, unknown]; neq?: [string, unknown] }> =
    [];
  return {
    calls,
    from(table: string) {
      const rec: { table: string; eq?: [string, unknown]; neq?: [string, unknown] } = {
        table,
      };
      calls.push(rec);
      const done = () => {
        if (table === "profiles") {
          return Promise.resolve({
            count: result.profiles?.count ?? 0,
            data: null,
            error: null,
          });
        }
        return Promise.resolve({
          count: result.qrons?.count ?? 0,
          data: result.qrons?.data ?? [],
          error: null,
        });
      };
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          rec.eq = [col, val];
          return chain;
        },
        neq: (col: string, val: unknown) => {
          rec.neq = [col, val];
          return chain;
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          done().then(resolve, reject),
      };
      return chain;
    },
  };
}

describe("loadLedgerCounts", () => {
  it("excludes the seed profile and demo QRONs, and sums scans from those rows", async () => {
    const sb = client({
      profiles: { count: 4 },
      qrons: {
        count: 2,
        data: [{ scan_count: 10 }, { scan_count: 3 }],
      },
    });
    const counts = await loadLedgerCounts(sb);
    expect(counts).toMatchObject({
      total_users: 4,
      total_qrons: 2,
      total_scans: 13,
    });
    expect(sb.calls.find((c) => c.table === "profiles")?.neq).toEqual([
      "id",
      DEMO_PROFILE_ID,
    ]);
    expect(sb.calls.find((c) => c.table === "qrons")?.eq).toEqual([
      "is_demo",
      false,
    ]);
  });
});
