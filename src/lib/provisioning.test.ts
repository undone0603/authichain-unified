import { describe, expect, it } from "vitest";
import { provisionPurchase } from "./provisioning";

function fakeProfiles(opts?: {
  existingId?: string | null;
  insertError?: { message: string; code?: string } | null;
  insertedId?: string | null;
  existingRow?: Record<string, unknown> | null;
}) {
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

  describe("ADM-172: one-time buys never wipe existing credits", () => {
    it("existing Starter (100 credits) buying strainchain_passport keeps 100 and its plan", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_starter",
        existingRow: { generations_limit: 100, subscription_plan: "starter" },
      });
      const result = await provisionPurchase(supabase, {
        email: "buyer@example.com",
        brand: "strainchain",
        plan: "strainchain_passport",
      });
      expect(result.status).toBe("provisioned");
      expect(updates).toHaveLength(1);
      const patch = updates[0].patch;
      expect(patch).not.toHaveProperty("generations_limit");
      expect(patch).not.toHaveProperty("generations_used");
      expect(patch.subscription_plan).toBeUndefined();
    });

    it("existing Starter via user id also keeps its credits", async () => {
      const { supabase, updates } = fakeProfiles({
        existingRow: { generations_limit: 100, subscription_plan: "starter" },
      });
      await provisionPurchase(supabase, {
        userId: "prof_uid",
        brand: "strainchain",
        plan: "strainchain_passport",
      });
      expect(updates[0].id).toBe("prof_uid");
      expect(updates[0].patch).not.toHaveProperty("generations_limit");
      expect(updates[0].patch.subscription_plan).toBeUndefined();
    });

    it("new guest buying strainchain_passport gets the passport plan with 0 credits", async () => {
      const { supabase, updates } = fakeProfiles({ insertedId: "prof_new" });
      const result = await provisionPurchase(supabase, {
        email: "new@example.com",
        brand: "strainchain",
        plan: "strainchain_passport",
      });
      expect(result.created).toBe(true);
      expect(updates[0].patch).toMatchObject({
        subscription_plan: "strainchain_passport",
        generations_limit: 0,
        generations_used: 0,
      });
    });

    it("Starter buy on an existing Starter profile still resets to 100", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_starter",
        existingRow: { generations_limit: 100, subscription_plan: "starter" },
      });
      await provisionPurchase(supabase, {
        email: "buyer@example.com",
        brand: "qron",
        plan: "starter",
      });
      expect(updates[0].patch).toMatchObject({
        subscription_plan: "starter",
        generations_limit: 100,
        generations_used: 0,
      });
    });

    it("Starter buy on a free profile (5 credits) upgrades to 100", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_free",
        existingRow: { generations_limit: 5, subscription_plan: "free" },
      });
      await provisionPurchase(supabase, {
        email: "buyer@example.com",
        brand: "qron",
        plan: "starter",
      });
      expect(updates[0].patch).toMatchObject({
        subscription_plan: "starter",
        generations_limit: 100,
      });
    });

    it("subscription plans are unchanged: qron_launch over a 500-credit profile still sets 100", async () => {
      const { supabase, updates } = fakeProfiles({
        existingId: "prof_big",
        existingRow: { generations_limit: 500, subscription_plan: "creator" },
      });
      await provisionPurchase(supabase, {
        email: "buyer@example.com",
        brand: "qron",
        plan: "qron_launch",
      });
      expect(updates[0].patch).toMatchObject({
        subscription_plan: "qron_launch",
        generations_limit: 100,
      });
    });
  });
});
