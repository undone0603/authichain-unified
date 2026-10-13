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
        return {
          eq: (col: string, val: string) => {
            if (col === "id") target.id = val;
            return Promise.resolve({
              error: opts?.updateError ?? null,
            });
          },
        };
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
});
