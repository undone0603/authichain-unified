import { describe, expect, it, vi } from "vitest";
import { DPP_OFFER_KEY } from "./plans";
import { DPP_PRICE_ID } from "./dpp-loop";

vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./billing-emails", () => ({
  renderBillingEmail: vi.fn().mockReturnValue({
    from: "billing@authichain.com",
    subject: "provisioned",
    html: "<p>ok</p>",
    text: "ok",
  }),
}));

const { fulfillDppPaidSession } = await import("./dpp-fulfill-checkout");

function fakeSupabase(opts?: { profileId?: string | null }) {
  const rows: Array<Record<string, unknown>> = [];
  const profileId = opts?.profileId === undefined ? "prof_1" : opts.profileId;
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    const builder: Record<string, unknown> = {
      insert: async (row: Record<string, unknown>) => {
        if (table === "funnel_events") rows.push(row);
        if (table === "profiles") {
          return { data: profileId ? { id: profileId } : null, error: null };
        }
        return { error: null };
      },
      update: () => builder,
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      maybeSingle: async () => {
        if (table === "profiles") {
          return { data: profileId ? { id: profileId } : null, error: null };
        }
        return { data: null, error: null };
      },
      limit: async () => ({
        data: rows.filter(r => filters.every(([c, v]) => r[c] === v)),
        error: null,
      }),
    };
    return builder;
  };
  return { supabase: { from }, rows };
}

const paidSession = {
  id: "cs_live_smoke_check",
  amount_total: 0,
  customer_details: { email: "buyer@example.com" },
  client_reference_id: "smoke_check_1",
  metadata: {
    offer: DPP_OFFER_KEY,
    plan: "dpp_readiness",
    visit_id: "smoke_check_1",
    source: "direct",
  },
};

describe("fulfillDppPaidSession", () => {
  it("no-ops when the session is not a DPP offer", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, {
      id: "cs_other",
      metadata: { plan: "starter" },
    });
    expect(result).toEqual({ handled: false, profileId: null });
    expect(rows).toHaveLength(0);
  });

  it("treats the catalog price id as a DPP offer without metadata.offer", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(
      supabase,
      {
        id: "cs_price_only",
        customer_details: { email: "buyer@example.com" },
        client_reference_id: "plink_visit",
        metadata: {},
      },
      DPP_PRICE_ID
    );
    expect(result.handled).toBe(true);
    expect(result.profileId).toBe("prof_1");
    expect(
      rows.map(r => (r.metadata as { loop_stage?: string }).loop_stage)
    ).toEqual(["payment_succeeded", "provisioned"]);
  });

  it("does not skip $0 DPP-SMOKE sessions (is_demo + smoke_* visit id)", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, {
      id: "cs_live_a1y4TuVXsdPVbXgPejLnXYpSWD5RvpmO273RUC3BxOHnAZ5JwlARbBMxQS",
      amount_total: 0,
      customer_details: { email: "authichain@gmail.com" },
      client_reference_id: "smoke_check_1789786486",
      metadata: {
        offer: DPP_OFFER_KEY,
        plan: "dpp_readiness",
        visit_id: "smoke_check_1789786486",
        prospect_id: "smoke_check_1789786486",
        is_demo: "true",
        promo: "DPP-SMOKE-E2E",
        source: "direct",
      },
    });
    expect(result.handled).toBe(true);
    expect(result.profileId).toBe("prof_1");
    expect(rows.map(r => r.event_type)).toEqual([
      "dpp_loop:payment_succeeded",
      "dpp_loop:provisioned",
    ]);
    expect(rows[0].prospect_id).toBe("smoke_check_1789786486");
  });

  it("writes payment_succeeded then provisioned for a paid smoke session", async () => {
    const { supabase, rows } = fakeSupabase();
    const result = await fulfillDppPaidSession(supabase, paidSession);
    expect(result).toEqual({ handled: true, profileId: "prof_1" });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      prospect_id: "smoke_check_1",
      event_type: "dpp_loop:payment_succeeded",
    });
    expect(rows[1]).toMatchObject({
      prospect_id: "smoke_check_1",
      event_type: "dpp_loop:provisioned",
    });
  });

  it("does not write provisioned when there is no buyer identity", async () => {
    const { supabase, rows } = fakeSupabase({ profileId: null });
    const result = await fulfillDppPaidSession(supabase, {
      ...paidSession,
      customer_details: null,
      customer_email: null,
      metadata: { ...paidSession.metadata, user_id: undefined },
    });
    expect(result).toEqual({ handled: true, profileId: null });
    expect(rows.map(r => r.event_type)).toEqual(["dpp_loop:payment_succeeded"]);
  });

  it("does not double-count payment or provision on webhook replay", async () => {
    const { supabase, rows } = fakeSupabase();
    await fulfillDppPaidSession(supabase, paidSession);
    await fulfillDppPaidSession(supabase, paidSession);
    expect(
      rows.filter(r => r.event_type === "dpp_loop:payment_succeeded")
    ).toHaveLength(1);
    expect(
      rows.filter(r => r.event_type === "dpp_loop:provisioned")
    ).toHaveLength(1);
  });
});
