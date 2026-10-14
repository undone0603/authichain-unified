import { describe, expect, it } from "vitest";
import {
  beginProvisionContinuity,
  finishProvisionContinuity,
  type ContinuitySupabase,
} from "./supabase-log";

function memorySupabase(): ContinuitySupabase & {
  rows: (table: string) => Record<string, unknown>[];
} {
  const tables = new Map<string, Record<string, unknown>[]>();
  const bucket = (table: string) => {
    const rows = tables.get(table) ?? [];
    tables.set(table, rows);
    return rows;
  };
  return {
    rows: table => [...(tables.get(table) ?? [])],
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return builder;
        },
        maybeSingle: async () => {
          const found =
            bucket(table).find(row =>
              filters.every(([col, val]) => row[col] === val)
            ) ?? null;
          return { data: found, error: null };
        },
        insert: async (row: Record<string, unknown>) => {
          const rows = bucket(table);
          if (
            rows.some(
              existing => existing.idempotency_key === row.idempotency_key
            )
          ) {
            return { error: { code: "23505" } };
          }
          rows.push({ ...row });
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (col: string, val: unknown) => {
            const found = bucket(table).find(row => row[col] === val);
            if (!found) return { error: { code: "02000" } };
            const history = patch.history;
            const previous = found.history;
            if (
              Array.isArray(history) &&
              Array.isArray(previous) &&
              history.length < previous.length
            ) {
              return { error: { code: "23514", message: "history_shortened" } };
            }
            Object.assign(found, patch);
            return { error: null };
          },
        }),
      };
      return builder;
    },
  };
}

const input = {
  sessionId: "cs_test_continuity",
  amountCents: 29900,
  isDemo: false,
  plan: "dpp_readiness",
  now: new Date("2026-10-13T22:00:00.000Z"),
};

describe("provision continuity", () => {
  it("stays running when the process stops before the grant is recorded", async () => {
    const db = memorySupabase();
    await beginProvisionContinuity(db, input);
    const running = db.rows("founder_exit_actions");
    expect(running).toHaveLength(1);
    expect(running[0]?.state).toBe("running");
    expect(db.rows("founder_exit_side_effects")).toHaveLength(0);
  });

  it("refuses to continue when the stored action is not resumable", async () => {
    const db = memorySupabase();
    await db.from("founder_exit_actions").insert({
      action_id: "dpp-fulfill:cs_test_continuity",
      idempotency_key: "dpp_fulfill:cs_test_continuity",
      state: "denied",
      created_at: "2026-10-13T22:00:00.000Z",
      updated_at: "2026-10-13T22:00:00.000Z",
      history: [],
    });
    await expect(beginProvisionContinuity(db, input)).rejects.toThrow(
      "continuity_state_not_resumable"
    );
    expect(db.rows("founder_exit_actions")[0]?.state).toBe("denied");
    expect(db.rows("founder_exit_side_effects")).toHaveLength(0);
  });

  it("records one grant key and does not apply it again", async () => {
    const db = memorySupabase();
    await beginProvisionContinuity(db, input);
    const first = await finishProvisionContinuity(db, {
      ...input,
      grantAlreadyPresent: false,
      now: new Date("2026-10-13T22:00:02.000Z"),
    });
    const second = await finishProvisionContinuity(db, {
      ...input,
      grantAlreadyPresent: true,
      now: new Date("2026-10-13T22:00:03.000Z"),
    });
    const action = db.rows("founder_exit_actions")[0];
    expect(first).toBe("recorded");
    expect(second).toBe("duplicate");
    expect(action?.state).toBe("succeeded");
    expect(action?.verification_status).toBe("observed_unverified");
    expect(db.rows("founder_exit_side_effects")).toHaveLength(1);
    expect(Array.isArray(action?.history) && action.history.length).toBe(4);
    expect(action?.economic_event_refs).toEqual([
      "amount_cents:29900",
      "plan:dpp_readiness",
      "is_demo:false",
    ]);
  });
});
