import { describe, expect, it } from "vitest";
import { provisionPurchase } from "./provisioning";

function fakeProfiles(opts?: {
  existingId?: string | null;
  insertError?: { message: string; code?: string } | null;
  insertedId?: string | null;
  lastGrantSessionId?: string | null;
  lookupError?: { message: string } | null;
  grantReadError?: { message: string } | null;
  updateError?: { message: string } | null;
  row?: Record<string, unknown>;
}) {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let reads = 0;
  const from = () => {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => {
        reads += 1;
        if (reads === 1 && opts?.lookupError) {
          return { data: null, error: opts.lookupError };
        }
        if (reads > 1 && opts?.grantReadError) {
          return { data: null, error: opts.grantReadError };
        }
        return {
          data: opts?.existingId
            ? {
                id: opts.existingId,
                last_grant_session_id: opts.lastGrantSessionId ?? null,
                ...(opts.row ?? {}),
              }
            : null,
          error: null,
        };
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
        const result = {
          error: opts?.updateError ?? null,
          data: [{ id: "x" }],
        };
        const chain: Record<string, unknown> = {
          eq: (col: string, val: string) => {
            if (col === "id") target.id = val;
            return chain;
          },
          is: () => chain,
          select: () => chain,
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
            Promise.resolve(result).then(res, rej),
        };
        return chain;
      },
    };
    return builder;
  };
  return { supabase: { from }, inserts, updates };
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

  it("skips entitlement reset when last_grant_session_id already matches", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      lastGrantSessionId: "cs_same",
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "starter",
      sessionId: "cs_same",
    });

    expect(result).toEqual({
      profileId: "prof_1",
      created: false,
      status: "provisioned",
      skippedIdempotent: true,
    });
    expect(updates).toHaveLength(0);
  });

  it("writes last_grant_session_id on a new session grant", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      lastGrantSessionId: "cs_old",
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "starter",
      sessionId: "cs_new",
      generationsGrant: 50,
    });

    expect(result.status).toBe("provisioned");
    expect(updates).toHaveLength(1);
    expect(updates[0].patch).toMatchObject({
      generations_used: 0,
      last_grant_session_id: "cs_new",
    });
    expect(updates[0].patch).not.toHaveProperty("subscribed_at");
  });

  it("does not insert a second profile when the email lookup fails", async () => {
    const { supabase, inserts, updates } = fakeProfiles({
      lookupError: { message: "profile lookup timed out" },
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "dpp_readiness",
      sessionId: "cs_retry",
    });

    expect(result).toMatchObject({
      profileId: null,
      status: "upsert_failed",
      error: "profile lookup timed out",
    });
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("does not grant when the prior-session read fails", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      grantReadError: { message: "connection reset" },
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "dpp_readiness",
      sessionId: "cs_retry",
    });

    expect(result.status).toBe("upsert_failed");
    expect(result.error).toMatch(/connection reset/);
    expect(updates).toHaveLength(0);
  });

  it("reports upsert_failed when the entitlement update fails", async () => {
    const { supabase } = fakeProfiles({
      existingId: "prof_1",
      updateError: { message: "profiles update rejected" },
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "dpp_readiness",
      sessionId: "cs_new",
    });

    expect(result).toMatchObject({
      profileId: "prof_1",
      status: "upsert_failed",
      error: "profiles update rejected",
    });
    expect(result.skippedIdempotent).toBeUndefined();
  });

  describe("one-time packs stack onto unused credits", () => {
    const base = { brand: "qron" as const, email: "buyer@example.com" };

    it("60 left + Starter = 160", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_1",
        lastGrantSessionId: "cs_old",
        row: { generations_limit: 100, generations_used: 40 },
      });
      const r = await provisionPurchase(supabase, {
        ...base,
        plan: "starter",
        sessionId: "cs_new",
      });
      expect(r.status).toBe("provisioned");
      expect(updates).toHaveLength(1);
      expect(updates[0].patch).toMatchObject({
        generations_limit: 160,
        generations_used: 0,
        last_grant_session_id: "cs_new",
        subscription_plan: "starter",
      });
    });

    it("stacks Creator onto leftover credits (60 + 500 = 560)", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_1",
        lastGrantSessionId: "cs_old",
        row: { generations_limit: 100, generations_used: 40 },
      });
      await provisionPurchase(supabase, {
        ...base,
        plan: "creator",
        sessionId: "cs_creator",
      });
      expect(updates[0].patch).toMatchObject({
        generations_limit: 560,
        generations_used: 0,
        subscription_plan: "creator",
      });
    });

    it("keeps an active subscriber's plan and status when they buy a pack", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_1",
        lastGrantSessionId: "cs_launch",
        row: {
          generations_limit: 100,
          generations_used: 30,
          subscription_plan: "qron_launch",
          subscription_status: "active",
          stripe_subscription_id: "sub_123",
        },
      });
      await provisionPurchase(supabase, {
        ...base,
        plan: "starter",
        sessionId: "cs_pack",
      });
      const patch = updates[0].patch;
      expect(patch.subscription_plan).toBeUndefined();
      expect(patch.subscription_status).toBeUndefined();
      expect(patch.stripe_subscription_id).toBeUndefined();
      expect(patch).toMatchObject({
        generations_limit: 170,
        generations_used: 0,
      });
    });

    it("changes nothing for a duplicate checkout session", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_1",
        lastGrantSessionId: "cs_dup",
        row: { generations_limit: 160, generations_used: 0 },
      });
      const r = await provisionPurchase(supabase, {
        ...base,
        plan: "starter",
        sessionId: "cs_dup",
      });
      expect(r.skippedIdempotent).toBe(true);
      expect(updates).toEqual([]);
    });

    it("still SETs the period grant for a subscription (no stacking)", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_1",
        lastGrantSessionId: "cs_old",
        row: { generations_limit: 100, generations_used: 40 },
      });
      await provisionPurchase(supabase, {
        ...base,
        plan: "qron_launch",
        stripeSubscriptionId: "sub_9",
        sessionId: "cs_sub",
      });
      expect(updates[0].patch).toMatchObject({
        generations_limit: 100,
        generations_used: 0,
        subscription_plan: "qron_launch",
      });
    });
  });

  describe("lost-update guard (CFA-346)", () => {
    type Row = Record<string, unknown>;
    function statefulDb(row: Row, opts?: { alwaysConflict?: boolean }) {
      const state = { row: { ...row }, writes: 0, conflicts: 0 };
      const tick = () => new Promise(r => setTimeout(r, 0));
      const from = () => {
        const b: Record<string, unknown> = {
          select: () => b,
          eq: () => b,
          maybeSingle: async () => {
            await tick();
            return { data: { id: "prof_1", ...state.row }, error: null };
          },
          update: (patch: Row) => {
            const filters: Array<[string, unknown]> = [];
            const chain: Record<string, unknown> = {
              eq: (col: string, val: unknown) => {
                if (col !== "id") filters.push([col, val]);
                return chain;
              },
              is: (col: string) => {
                filters.push([col, null]);
                return chain;
              },
              select: () => chain,
              then: (res: (v: unknown) => unknown) =>
                tick().then(() => {
                  const match =
                    !opts?.alwaysConflict &&
                    filters.every(([c, v]) => (state.row[c] ?? null) === v);
                  if (!match) {
                    state.conflicts += 1;
                    return res({ data: [], error: null });
                  }
                  for (const [k, v] of Object.entries(patch)) {
                    if (v !== undefined) state.row[k] = v;
                  }
                  state.writes += 1;
                  return res({ data: [{ id: "prof_1" }], error: null });
                }),
            };
            return chain;
          },
        };
        return b;
      };
      return { supabase: { from }, state };
    }
    const base = { brand: "qron" as const, email: "buyer@example.com" };

    it("credits two concurrent grants exactly once each (60 + 100 + 500 = 660)", async () => {
      const { supabase, state } = statefulDb({
        generations_limit: 100,
        generations_used: 40,
        last_grant_session_id: "cs_old",
      });
      const [a, b] = await Promise.all([
        provisionPurchase(supabase, {
          ...base,
          userId: "prof_1",
          plan: "starter",
          sessionId: "cs_a",
        }),
        provisionPurchase(supabase, {
          ...base,
          userId: "prof_1",
          plan: "creator",
          sessionId: "cs_b",
        }),
      ]);
      expect(a.status).toBe("provisioned");
      expect(b.status).toBe("provisioned");
      expect(state.writes).toBe(2);
      expect(state.conflicts).toBeGreaterThanOrEqual(1);
      expect(state.row.generations_limit).toBe(660);
      expect(state.row.generations_used).toBe(0);
    });

    it("never double-grants the same session delivered twice concurrently", async () => {
      const { supabase, state } = statefulDb({
        generations_limit: 100,
        generations_used: 40,
        last_grant_session_id: "cs_old",
      });
      const input = {
        ...base,
        userId: "prof_1",
        plan: "starter",
        sessionId: "cs_same",
      };
      const [a, b] = await Promise.all([
        provisionPurchase(supabase, input),
        provisionPurchase(supabase, input),
      ]);
      expect(state.writes).toBe(1);
      expect(state.row.generations_limit).toBe(160);
      expect(
        [a.skippedIdempotent, b.skippedIdempotent].filter(Boolean)
      ).toHaveLength(1);
      expect(a.status).toBe("provisioned");
      expect(b.status).toBe("provisioned");
    });

    it("fails closed after retries are exhausted so Stripe redelivers", async () => {
      const { supabase, state } = statefulDb(
        {
          generations_limit: 100,
          generations_used: 40,
          last_grant_session_id: "cs_old",
        },
        { alwaysConflict: true }
      );
      const r = await provisionPurchase(supabase, {
        ...base,
        userId: "prof_1",
        plan: "starter",
        sessionId: "cs_x",
      });
      expect(r.status).toBe("upsert_failed");
      expect(r.error).toMatch(/retry/);
      expect(state.conflicts).toBe(4); // first try + 3 retries
      expect(state.row.generations_limit).toBe(100);
    });
  });
});
