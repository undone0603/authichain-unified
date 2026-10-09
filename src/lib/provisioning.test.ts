import { describe, expect, it } from "vitest";
import { provisionPurchase } from "./provisioning";

function fakeProfiles(opts?: {
  existingId?: string | null;
  insertError?: { message: string; code?: string } | null;
  insertedId?: string | null;
  existingRow?: Record<string, unknown> | null;
  grantedSessions?: Set<string>;
}) {
  const granted = opts?.grantedSessions ?? new Set<string>();
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const from = () => {
    let cols = "";
    const builder: Record<string, unknown> = {
      select: (c?: string) => {
        cols = c ?? "";
        return builder;
      },
      eq: () => builder,
      maybeSingle: async () =>
        cols.includes("generations_limit")
          ? { data: opts?.existingRow ?? null, error: null }
          : {
              data: opts?.existingId ? { id: opts.existingId } : null,
              error: null,
            },
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        const result = opts?.insertError
          ? { data: null, error: opts.insertError }
          : {
              data:
                opts?.insertedId === null
                  ? null
                  : { id: opts?.insertedId ?? "prof_guest" },
              error: null,
            };
        return {
          select: () => ({
            maybeSingle: async () => result,
          }),
        };
      },
      update: (patch: Record<string, unknown>) => {
        const target = { id: "", patch };
        updates.push(target);
        return {
          eq: (col: string, val: string) => {
            if (col === "id") target.id = val;
            return Promise.resolve({ error: null });
          },
        };
      },
    };
    return builder;
  };
  const rpc = async (_fn: string, args: Record<string, unknown>) => {
    const sid = String(args.p_session_id);
    if (granted.has(sid)) return { data: false, error: null };
    granted.add(sid);
    return { data: true, error: null };
  };
  return { supabase: { from, rpc }, inserts, updates, granted };
}

describe("provisionPurchase", () => {
  it("does not map a failed guest insert to no_identity", async () => {
    const { supabase, inserts } = fakeProfiles({
      insertError: {
        message:
          'null value in column "user_id" of relation "profiles" violates not-null constraint',
        code: "23502",
      },
    });

    const result = await provisionPurchase(supabase, {
      email: "authichain@gmail.com",
      brand: "authichain",
      plan: "dpp_readiness",
    });

    expect(inserts[0]).toMatchObject({ email: "authichain@gmail.com" });
    expect(result.status).toBe("upsert_failed");
    expect(result.profileId).toBeNull();
    expect(result.error).toMatch(/user_id/i);
  });

  it("creates a guest profile without requiring auth.users user_id", async () => {
    const { supabase, inserts, updates } = fakeProfiles({
      insertedId: "prof_guest",
    });

    const result = await provisionPurchase(supabase, {
      email: "authichain@gmail.com",
      brand: "authichain",
      plan: "dpp_readiness",
      stripeSessionId: "cs_guest_dpp",
    });

    expect(inserts[0]).toEqual(
      expect.objectContaining({
        email: "authichain@gmail.com",
        brand: "authichain",
      })
    );
    expect(inserts[0]).not.toHaveProperty("user_id");
    expect(result).toEqual({
      profileId: "prof_guest",
      created: true,
      status: "provisioned",
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("prof_guest");
  });

  it("returns no_identity only when there is no email and no user id", async () => {
    const { supabase, inserts } = fakeProfiles();
    const result = await provisionPurchase(supabase, {
      email: null,
      userId: null,
      brand: "authichain",
      plan: "dpp_readiness",
    });
    expect(result).toEqual({
      profileId: null,
      created: false,
      status: "no_identity",
    });
    expect(inserts).toHaveLength(0);
  });

  describe("ADM-172/174, RES-201: one-time packs add credits once per session, atomically", () => {
    type Row = {
      id: string;
      email?: string;
      generations_limit: number;
      generations_used: number;
      subscription_plan: string | null;
    };
    /**
     * In-memory stand-in for profiles + credit_grants + grant_pack_credits.
     * The rpc mirrors the SQL: insert-or-skip the session row, then add,
     * and roll the session row back if the add fails.
     */
    function fakeDb(seed: Row[] = [], opts?: { failAdds?: number }) {
      const profiles = new Map(seed.map(r => [r.id, { ...r }]));
      const grants = new Set<string>();
      let failAdds = opts?.failAdds ?? 0;
      let nextId = 1;
      const rpcCalls: Array<Record<string, unknown>> = [];
      const from = () => {
        let eqCol = "";
        let eqVal = "";
        let mode: "select" | "update" | "insert" = "select";
        let patch: Record<string, unknown> = {};
        let insertRow: Record<string, unknown> = {};
        const find = () =>
          [...profiles.values()].find(
            r => (r as Record<string, unknown>)[eqCol] === eqVal
          ) ?? null;
        const b: Record<string, unknown> = {
          select: () => b,
          eq: (c: string, v: string) => {
            eqCol = c;
            eqVal = v;
            if (mode === "update") {
              const r = find();
              if (r) {
                for (const [k, v2] of Object.entries(patch)) {
                  if (v2 !== undefined) (r as Record<string, unknown>)[k] = v2;
                }
              }
              return Promise.resolve({ error: null });
            }
            return b;
          },
          maybeSingle: async () => {
            if (mode === "insert") {
              const id = `prof_new_${nextId++}`;
              profiles.set(id, {
                id,
                email: insertRow.email as string,
                generations_limit: 0,
                generations_used: 0,
                subscription_plan: null,
              });
              return { data: { id }, error: null };
            }
            return { data: find(), error: null };
          },
          insert: (row: Record<string, unknown>) => {
            mode = "insert";
            insertRow = row;
            return b;
          },
          update: (p: Record<string, unknown>) => {
            mode = "update";
            patch = p;
            return b;
          },
        };
        return b;
      };
      const rpc = async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, ...args });
        const sid = String(args.p_session_id);
        if (grants.has(sid)) return { data: false, error: null };
        grants.add(sid); // INSERT credit_grants
        const r = profiles.get(String(args.p_profile_id));
        if (failAdds > 0 || !r) {
          failAdds--;
          grants.delete(sid); // transaction rolled back
          return { data: null, error: { message: "simulated add failure" } };
        }
        r.generations_limit += Number(args.p_credits);
        return { data: true, error: null };
      };
      return { supabase: { from, rpc }, profiles, grants, rpcCalls };
    }
    const starter = (limit: number, used = 0, plan = "starter"): Row => ({
      id: "prof_1",
      email: "b@example.com",
      generations_limit: limit,
      generations_used: used,
      subscription_plan: plan,
    });
    const buy = (
      db: ReturnType<typeof fakeDb>,
      plan: string,
      session: string | null,
      email = "b@example.com"
    ) =>
      provisionPurchase(db.supabase, {
        email,
        brand: "qron",
        plan,
        stripeSessionId: session,
      });

    it("buyer at 600 buys Creator and ends at 1,100 without resetting usage", async () => {
      const db = fakeDb([starter(600, 40)]);
      await buy(db, "creator", "cs_creator_1");
      const r = db.profiles.get("prof_1")!;
      expect(r.generations_limit).toBe(1100);
      expect(r.generations_used).toBe(40);
      expect(r.subscription_plan).toBe("creator");
    });

    it("Starter over Starter at 100 ends at 200", async () => {
      const db = fakeDb([starter(100, 7)]);
      await buy(db, "starter", "cs_starter_2");
      expect(db.profiles.get("prof_1")!.generations_limit).toBe(200);
      expect(db.profiles.get("prof_1")!.generations_used).toBe(7);
    });

    it("passport over Starter keeps 100, usage and plan, and never calls the rpc", async () => {
      const db = fakeDb([starter(100, 3)]);
      await buy(db, "strainchain_passport", "cs_pass_1");
      const r = db.profiles.get("prof_1")!;
      expect(r).toMatchObject({
        generations_limit: 100,
        generations_used: 3,
        subscription_plan: "starter",
      });
      expect(db.rpcCalls).toHaveLength(0);
    });

    it("the same session delivered twice credits once", async () => {
      const db = fakeDb([starter(100)]);
      await buy(db, "starter", "cs_dup");
      await buy(db, "starter", "cs_dup");
      expect(db.profiles.get("prof_1")!.generations_limit).toBe(200);
      expect(db.grants.size).toBe(1);
    });

    it("an add that fails after the record is written rolls back, throws, and a retry still delivers", async () => {
      const db = fakeDb([starter(100)], { failAdds: 1 });
      await expect(buy(db, "creator", "cs_retry")).rejects.toThrow(
        /grant_pack_credits failed/
      );
      expect(db.grants.has("cs_retry")).toBe(false);
      expect(db.profiles.get("prof_1")!.generations_limit).toBe(100);
      await buy(db, "creator", "cs_retry"); // Stripe retry
      expect(db.profiles.get("prof_1")!.generations_limit).toBe(600);
      expect(db.grants.has("cs_retry")).toBe(true);
    });

    it("concurrent checkouts with different sessions both add", async () => {
      const db = fakeDb([starter(100)]);
      await Promise.all([
        buy(db, "starter", "cs_a"),
        buy(db, "creator", "cs_b"),
      ]);
      expect(db.profiles.get("prof_1")!.generations_limit).toBe(700);
      expect(db.grants.size).toBe(2);
    });

    it("one-time pack without a session id fails closed before any write", async () => {
      const db = fakeDb([starter(100, 5)]);
      await expect(buy(db, "starter", null)).rejects.toThrow(/stripeSessionId/);
      expect(db.profiles.get("prof_1")).toMatchObject({
        generations_limit: 100,
        generations_used: 5,
      });
      expect(db.rpcCalls).toHaveLength(0);
    });

    it("rpc errors fail closed (e.g. migration not applied)", async () => {
      const db = fakeDb([starter(100)]);
      db.supabase.rpc = async () => ({
        data: null,
        error: { message: "function public.grant_pack_credits does not exist" },
      });
      await expect(buy(db, "starter", "cs_x")).rejects.toThrow(
        /does not exist/
      );
      expect(db.profiles.get("prof_1")!.generations_limit).toBe(100);
    });

    it("a one-time pack never downgrades a subscription plan", async () => {
      const db = fakeDb([starter(100, 0, "qron_launch")]);
      await buy(db, "starter", "cs_s_over_sub");
      expect(db.profiles.get("prof_1")).toMatchObject({
        generations_limit: 200,
        subscription_plan: "qron_launch",
      });
    });

    it("new guest buying the passport gets the plan with 0 credits", async () => {
      const db = fakeDb();
      const r = await buy(
        db,
        "strainchain_passport",
        "cs_pass_new",
        "new@example.com"
      );
      expect(r.created).toBe(true);
      expect(db.profiles.get(r.profileId!)).toMatchObject({
        subscription_plan: "strainchain_passport",
        generations_limit: 0,
        generations_used: 0,
      });
      expect(db.rpcCalls).toHaveLength(0);
    });

    it("new guest buying Starter gets exactly 100, and a replay does not add", async () => {
      const db = fakeDb();
      const r = await buy(db, "starter", "cs_starter_new", "new@example.com");
      expect(db.profiles.get(r.profileId!)).toMatchObject({
        subscription_plan: "starter",
        generations_limit: 100,
        generations_used: 0,
      });
      await buy(db, "starter", "cs_starter_new", "new@example.com");
      expect(db.profiles.get(r.profileId!)!.generations_limit).toBe(100);
    });

    it("subscription plans are unchanged: qron_launch over 500 sets 100 and resets usage", async () => {
      const db = fakeDb([starter(500, 9, "creator")]);
      await buy(db, "qron_launch", "cs_sub_1");
      expect(db.profiles.get("prof_1")).toMatchObject({
        subscription_plan: "qron_launch",
        generations_limit: 100,
        generations_used: 0,
      });
      expect(db.rpcCalls).toHaveLength(0);
    });
  });
});
