import { describe, expect, it } from "vitest";
import {
  CATALOG_GRANT_RPC,
  applyCatalogGrantState,
  grantReceiptKey,
  provisionPurchase,
  stackedPackCredits,
} from "./provisioning";

function catalogArgs(args: Record<string, unknown>) {
  return {
    profileId: String(args.p_profile_id),
    sessionId: String(args.p_session_id),
    plan: String(args.p_plan),
    brand: String(args.p_brand),
    generations: Number(args.p_generations),
    stack: Boolean(args.p_stack),
    stripeCustomerId: (args.p_stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId:
      (args.p_stripe_subscription_id as string | null) ?? null,
    isTrial: Boolean(args.p_is_trial),
  };
}

function fakeProfiles(opts?: {
  existingId?: string | null;
  insertError?: { message: string; code?: string } | null;
  insertedId?: string | null;
  lastGrantSessionId?: string | null;
  lookupError?: { message: string } | null;
  grantReadError?: { message: string } | null;
  receiptLookupError?: { message: string } | null;
  receiptWriteError?: { message: string; code?: string } | null;
  receipts?: string[];
  receiptProfiles?: Record<string, string>;
  updateError?: { message: string } | null;
  rpcError?: { message: string } | null;
  rpcAlreadyGranted?: boolean;
  rpcProfileOverride?: string | null;
  row?: Record<string, unknown>;
}) {
  const inserts: Array<Record<string, unknown>> = [];
  const receiptInserts: Array<Record<string, unknown>> = [];
  const receipts = new Set(opts?.receipts ?? []);
  const profileRow: Record<string, unknown> = {
    last_grant_session_id: opts?.lastGrantSessionId ?? null,
    ...(opts?.row ?? {}),
  };
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  let reads = 0;
  const from = (table?: string) => {
    if (table === "founder_exit_side_effects") {
      let key = "";
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: string) => {
          if (col === "idempotency_key") key = val;
          return builder;
        },
        maybeSingle: async () => {
          if (opts?.receiptLookupError) {
            return { data: null, error: opts.receiptLookupError };
          }
          return {
            data: receipts.has(key) ? { idempotency_key: key } : null,
            error: null,
          };
        },
        insert: (row: Record<string, unknown>) => {
          receiptInserts.push(row);
          if (opts?.receiptWriteError) {
            return {
              then: (res: (v: unknown) => unknown) =>
                Promise.resolve({
                  data: null,
                  error: opts.receiptWriteError,
                }).then(res),
            };
          }
          const keyToAdd = String(row.idempotency_key ?? "");
          if (receipts.has(keyToAdd)) {
            return {
              then: (res: (v: unknown) => unknown) =>
                Promise.resolve({
                  data: null,
                  error: { code: "23505", message: "duplicate" },
                }).then(res),
            };
          }
          receipts.add(keyToAdd);
          return {
            then: (res: (v: unknown) => unknown) =>
              Promise.resolve({ data: row, error: null }).then(res),
          };
        },
      };
      return builder;
    }
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
                ...profileRow,
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
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    if (opts?.rpcError) {
      return { data: null, error: opts.rpcError };
    }
    if (fn === "grant_dpp_checkout_session") {
      return {
        data: {
          status: opts?.rpcAlreadyGranted ? "already_granted" : "granted",
          profile_id: args.p_profile_id,
        },
        error: null,
      };
    }
    if (fn === CATALOG_GRANT_RPC) {
      const result = applyCatalogGrantState(
        {
          receipts,
          receiptProfiles: opts?.receiptProfiles,
          row: profileRow,
        },
        catalogArgs(args)
      );
      if (result.status === "conflict") {
        return {
          data: null,
          error: { message: "catalog_grant_receipt_conflict" },
        };
      }
      if (result.status === "granted") {
        updates.push({
          id: String(args.p_profile_id),
          patch: { ...profileRow },
        });
      }
      return {
        data: { status: result.status, profile_id: opts?.rpcProfileOverride === undefined ? result.profileId : opts.rpcProfileOverride },
        error: null,
      };
    }
    return { data: null, error: { message: `unexpected RPC ${fn}` } };
  };
  return {
    supabase: { from, rpc },
    inserts,
    receiptInserts,
    updates,
    rpcCalls,
  };
}

describe("atomic catalog response identity", () => {
  it("rejects missing profile identity on an acknowledged replay", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      receipts: ["grant:cs_a"],
      rpcProfileOverride: null,
    });
    const result = await provisionPurchase(supabase, {
      userId: "prof_1",
      brand: "qron",
      plan: "starter",
      sessionId: "cs_a",
    });
    expect(result.status).toBe("upsert_failed");
    expect(updates).toHaveLength(0);
  });
});

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

  it("uses the atomic RPC for DPP session grants", async () => {
    const { supabase, updates, rpcCalls } = fakeProfiles({
      existingId: "prof_1",
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "dpp_readiness",
      sessionId: "cs_atomic",
      stripeCustomerId: "cus_1",
      atomicDppSessionGrant: true,
    });

    expect(result).toMatchObject({
      profileId: "prof_1",
      status: "provisioned",
    });
    expect(rpcCalls).toEqual([
      {
        fn: "grant_dpp_checkout_session",
        args: {
          p_profile_id: "prof_1",
          p_session_id: "cs_atomic",
          p_brand: "authichain",
          p_stripe_customer_id: "cus_1",
        },
      },
    ]);
    expect(updates).toHaveLength(0);
  });

  it("fails closed when the atomic DPP grant RPC fails", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      rpcError: { message: "database unavailable" },
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "dpp_readiness",
      sessionId: "cs_atomic",
      atomicDppSessionGrant: true,
    });

    expect(result).toMatchObject({
      profileId: "prof_1",
      status: "upsert_failed",
      error: "database unavailable",
    });
    expect(updates).toHaveLength(0);
  });

  it("treats an existing atomic DPP receipt as idempotent", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      rpcAlreadyGranted: true,
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "dpp_readiness",
      sessionId: "cs_atomic",
      atomicDppSessionGrant: true,
    });

    expect(result).toMatchObject({
      profileId: "prof_1",
      status: "provisioned",
      skippedIdempotent: true,
    });
    expect(updates).toHaveLength(0);
  });

  it("fails closed when the atomic DPP grant RPC is unavailable", async () => {
    const { supabase, updates } = fakeProfiles({ existingId: "prof_1" });

    const result = await provisionPurchase(
      { from: supabase.from },
      {
        email: "buyer@example.com",
        brand: "authichain",
        plan: "dpp_readiness",
        sessionId: "cs_atomic",
        atomicDppSessionGrant: true,
      }
    );

    expect(result).toMatchObject({
      profileId: "prof_1",
      status: "upsert_failed",
      error: "atomic DPP grant RPC unavailable",
    });
    expect(updates).toHaveLength(0);
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

  it("does not grant when the atomic catalog RPC fails", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      rpcError: { message: "connection reset" },
    });

    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "starter",
      sessionId: "cs_retry",
    });

    expect(result.status).toBe("upsert_failed");
    expect(result.error).toMatch(/connection reset/);
    expect(updates).toHaveLength(0);
  });

  it("fails closed when PostgREST has not loaded the catalog grant RPC", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      rpcError: { message: "Could not find the function", code: "PGRST202" },
    });
    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "starter",
      sessionId: "cs_new",
    });
    expect(result).toMatchObject({
      profileId: "prof_1",
      status: "upsert_failed",
      error: "atomic catalog grant RPC unavailable",
    });
    expect(updates).toHaveLength(0);
  });

  it("fails closed when the session receipt belongs to another profile", async () => {
    const { supabase, updates } = fakeProfiles({
      existingId: "prof_1",
      receipts: ["grant:cs_taken"],
      receiptProfiles: { "grant:cs_taken": "prof_other" },
      row: { generations_limit: 100, generations_used: 0 },
    });
    const result = await provisionPurchase(supabase, {
      email: "buyer@example.com",
      brand: "authichain",
      plan: "starter",
      sessionId: "cs_taken",
    });
    expect(result).toMatchObject({
      profileId: "prof_1",
      status: "upsert_failed",
      error: "catalog_grant_receipt_conflict",
    });
    expect(updates).toEqual([]);
  });

  it("reports upsert_failed when the atomic catalog RPC is unavailable", async () => {
    const { supabase, updates } = fakeProfiles({ existingId: "prof_1" });

    const result = await provisionPurchase(
      { from: supabase.from },
      {
        email: "buyer@example.com",
        brand: "authichain",
        plan: "starter",
        sessionId: "cs_new",
      }
    );

    expect(result).toMatchObject({
      profileId: "prof_1",
      status: "upsert_failed",
      error: "atomic catalog grant RPC unavailable",
    });
    expect(updates).toHaveLength(0);
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
      expect(patch.subscription_plan).toBe("qron_launch");
      expect(patch.subscription_status).toBe("active");
      expect(patch.stripe_subscription_id).toBe("sub_123");
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

    it("does not add again when an older session is replayed after a newer purchase", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_1",
        lastGrantSessionId: "cs_new",
        receipts: ["grant:cs_old"],
        row: { generations_limit: 200, generations_used: 0 },
      });
      const r = await provisionPurchase(supabase, {
        ...base,
        plan: "starter",
        sessionId: "cs_old",
      });
      expect(r.skippedIdempotent).toBe(true);
      expect(updates).toEqual([]);
    });

    it("a new Starter session adds 100; replaying that session does not add again", async () => {
      const first = fakeProfiles({
        existingId: "prof_1",
        lastGrantSessionId: "cs_old",
        row: { generations_limit: 100, generations_used: 40 },
      });
      const granted = await provisionPurchase(first.supabase, {
        ...base,
        plan: "starter",
        sessionId: "cs_repeat",
      });
      expect(granted.skippedIdempotent).toBeUndefined();
      expect(first.updates[0].patch).toMatchObject({
        generations_limit: 160,
        generations_used: 0,
        last_grant_session_id: "cs_repeat",
      });

      const replay = fakeProfiles({
        existingId: "prof_1",
        lastGrantSessionId: "cs_repeat",
        row: { generations_limit: 160, generations_used: 0 },
      });
      const skipped = await provisionPurchase(replay.supabase, {
        ...base,
        plan: "starter",
        sessionId: "cs_repeat",
      });
      expect(skipped.skippedIdempotent).toBe(true);
      expect(replay.updates).toEqual([]);
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

  describe("atomic catalog session grant", () => {
    type Row = Record<string, unknown>;
    function statefulDb(row: Row, opts?: { rpcError?: { message: string } }) {
      const state = { row: { ...row }, writes: 0 };
      const receipts = new Set<string>();
      const tick = () => new Promise(r => setTimeout(r, 0));
      let locked = false;
      const from = () => {
        const b: Record<string, unknown> = {
          select: () => b,
          eq: () => b,
          maybeSingle: async () => {
            await tick();
            return { data: { id: "prof_1", ...state.row }, error: null };
          },
        };
        return b;
      };
      const rpc = async (fn: string, args: Record<string, unknown>) => {
        await tick();
        while (locked) await tick();
        locked = true;
        try {
          if (opts?.rpcError) {
            return { data: null, error: opts.rpcError };
          }
          if (fn !== CATALOG_GRANT_RPC) {
            return { data: null, error: { message: `unexpected RPC ${fn}` } };
          }
          const result = applyCatalogGrantState(
            { receipts, row: state.row },
            catalogArgs(args)
          );
          if (result.status === "conflict") {
            return {
              data: null,
              error: { message: "catalog_grant_receipt_conflict" },
            };
          }
          if (result.status === "granted") state.writes += 1;
          return {
            data: { status: result.status, profile_id: result.profileId },
            error: null,
          };
        } finally {
          locked = false;
        }
      };
      return { supabase: { from, rpc }, state, receipts };
    }
    const base = { brand: "qron" as const, email: "buyer@example.com" };

    it("grant A, grant B, replay A does not add A again (CFA-869 F869-1)", async () => {
      const { supabase, state } = statefulDb({
        generations_limit: 0,
        generations_used: 0,
        last_grant_session_id: null,
      });
      const grant = (sessionId: string) =>
        provisionPurchase(supabase, {
          ...base,
          userId: "prof_1",
          plan: "starter",
          sessionId,
        });
      expect((await grant("cs_a")).status).toBe("provisioned");
      expect((await grant("cs_b")).status).toBe("provisioned");
      expect(state.row.generations_limit).toBe(200);
      expect(state.row.last_grant_session_id).toBe("cs_b");
      const writes = state.writes;
      const replay = await grant("cs_a");
      expect(replay.skippedIdempotent).toBe(true);
      expect(state.writes).toBe(writes);
      expect(state.row.generations_limit).toBe(200);
    });

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

    it("fails closed when the catalog RPC errors, without changing credits", async () => {
      const { supabase, state } = statefulDb(
        {
          generations_limit: 100,
          generations_used: 40,
          last_grant_session_id: "cs_old",
        },
        { rpcError: { message: "catalog grant timeout" } }
      );
      const r = await provisionPurchase(supabase, {
        ...base,
        userId: "prof_1",
        plan: "starter",
        sessionId: "cs_x",
      });
      expect(r.status).toBe("upsert_failed");
      expect(r.error).toMatch(/timeout/);
      expect(state.writes).toBe(0);
      expect(state.row.generations_limit).toBe(100);
    });

    it("never returns granted without a durable session receipt", () => {
      const state = {
        receipts: new Set<string>(),
        row: {
          generations_limit: 0,
          generations_used: 0,
          last_grant_session_id: null,
        },
      };
      const granted = applyCatalogGrantState(state, {
        profileId: "prof_1",
        sessionId: "cs_a",
        plan: "starter",
        brand: "qron",
        generations: 100,
        stack: true,
      });
      expect(granted.status).toBe("granted");
      expect(state.receipts.has(grantReceiptKey("cs_a"))).toBe(true);
      expect(state.row.generations_limit).toBe(100);
      const replay = applyCatalogGrantState(state, {
        profileId: "prof_1",
        sessionId: "cs_a",
        plan: "starter",
        brand: "qron",
        generations: 100,
        stack: true,
      });
      expect(replay.status).toBe("already_granted");
      expect(state.row.generations_limit).toBe(100);
    });

    it("stacks leftover credits the same way SQL GREATEST(0, limit-used)+pack does", () => {
      expect(
        stackedPackCredits(
          { generations_limit: 100, generations_used: 40 },
          100
        )
      ).toEqual({ generations_limit: 160, generations_used: 0 });
    });
  });
});
