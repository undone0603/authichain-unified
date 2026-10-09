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
      upsert: (row: { stripe_session_id: string }) => ({
        select: async () => {
          if (granted.has(row.stripe_session_id))
            return { data: [], error: null };
          granted.add(row.stripe_session_id);
          return {
            data: [{ stripe_session_id: row.stripe_session_id }],
            error: null,
          };
        },
      }),
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
  return { supabase: { from }, inserts, updates, granted };
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

  describe("ADM-172/174: one-time packs add credits once per session", () => {
    const existing = (
      limit: number,
      plan: string,
      grantedSessions?: Set<string>
    ) =>
      fakeProfiles({
        existingId: "prof_1",
        existingRow: { generations_limit: limit, subscription_plan: plan },
        grantedSessions,
      });

    it("buyer at 600 buys Creator and ends at 1,100 without resetting usage", async () => {
      const { supabase, updates } = existing(600, "starter");
      await provisionPurchase(supabase, {
        email: "b@example.com",
        brand: "qron",
        plan: "creator",
        stripeSessionId: "cs_creator_1",
      });
      expect(updates[0].patch.generations_limit).toBe(1100);
      expect(updates[0].patch).not.toHaveProperty("generations_used");
      expect(updates[0].patch.subscription_plan).toBe("creator");
    });

    it("Starter over Starter at 100 ends at 200", async () => {
      const { supabase, updates } = existing(100, "starter");
      await provisionPurchase(supabase, {
        email: "b@example.com",
        brand: "qron",
        plan: "starter",
        stripeSessionId: "cs_starter_2",
      });
      expect(updates[0].patch.generations_limit).toBe(200);
      expect(updates[0].patch).not.toHaveProperty("generations_used");
    });

    it("passport over Starter keeps 100, usage and the starter plan", async () => {
      const { supabase, updates, granted } = existing(100, "starter");
      await provisionPurchase(supabase, {
        email: "b@example.com",
        brand: "strainchain",
        plan: "strainchain_passport",
        stripeSessionId: "cs_pass_1",
      });
      const patch = updates[0].patch;
      expect(patch).not.toHaveProperty("generations_limit");
      expect(patch).not.toHaveProperty("generations_used");
      expect(patch).not.toHaveProperty("subscription_plan");
      expect(granted.size).toBe(0);
    });

    it("the same session delivered twice credits once", async () => {
      const sessions = new Set<string>();
      const first = existing(100, "starter", sessions);
      await provisionPurchase(first.supabase, {
        email: "b@example.com",
        brand: "qron",
        plan: "starter",
        stripeSessionId: "cs_dup",
      });
      expect(first.updates[0].patch.generations_limit).toBe(200);
      // Second delivery: profile now at 200, same session id.
      const second = existing(200, "starter", sessions);
      await provisionPurchase(second.supabase, {
        email: "b@example.com",
        brand: "qron",
        plan: "starter",
        stripeSessionId: "cs_dup",
      });
      expect(second.updates[0].patch).not.toHaveProperty("generations_limit");
      expect(sessions.size).toBe(1);
    });

    it("one-time pack without a session id fails closed instead of granting unguarded", async () => {
      const { supabase, updates } = existing(100, "starter");
      await expect(
        provisionPurchase(supabase, {
          email: "b@example.com",
          brand: "qron",
          plan: "starter",
        })
      ).rejects.toThrow(/stripeSessionId/);
      expect(updates).toHaveLength(0);
    });

    it("one-time pack never downgrades a subscription plan", async () => {
      const { supabase, updates } = existing(100, "qron_launch");
      await provisionPurchase(supabase, {
        email: "b@example.com",
        brand: "qron",
        plan: "starter",
        stripeSessionId: "cs_s_over_sub",
      });
      expect(updates[0].patch.generations_limit).toBe(200);
      expect(updates[0].patch).not.toHaveProperty("subscription_plan");
    });

    it("new guest buying the passport gets the plan with 0 credits", async () => {
      const { supabase, updates } = fakeProfiles({ insertedId: "prof_new" });
      const r = await provisionPurchase(supabase, {
        email: "new@example.com",
        brand: "strainchain",
        plan: "strainchain_passport",
        stripeSessionId: "cs_pass_new",
      });
      expect(r.created).toBe(true);
      expect(updates[0].patch).toMatchObject({
        subscription_plan: "strainchain_passport",
        generations_limit: 0,
        generations_used: 0,
      });
    });

    it("new guest buying Starter gets exactly 100", async () => {
      const { supabase, updates } = fakeProfiles({ insertedId: "prof_new" });
      await provisionPurchase(supabase, {
        email: "new@example.com",
        brand: "qron",
        plan: "starter",
        stripeSessionId: "cs_starter_new",
      });
      expect(updates[0].patch).toMatchObject({
        subscription_plan: "starter",
        generations_limit: 100,
        generations_used: 0,
      });
    });

    it("subscription plans are unchanged: qron_launch over 500 sets 100 and resets usage", async () => {
      const { supabase, updates } = existing(500, "creator");
      await provisionPurchase(supabase, {
        email: "b@example.com",
        brand: "qron",
        plan: "qron_launch",
        stripeSessionId: "cs_sub_1",
      });
      expect(updates[0].patch).toMatchObject({
        subscription_plan: "qron_launch",
        generations_limit: 100,
        generations_used: 0,
      });
    });
  });
});
