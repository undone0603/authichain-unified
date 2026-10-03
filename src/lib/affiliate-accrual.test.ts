import { describe, it, expect, vi } from "vitest";
import { accrueAffiliateCommission } from "./affiliate-accrual";

function fakeClient(
  row: Record<string, unknown> | null,
  updatedRows = [{ id: "a1" }]
) {
  const update = vi.fn();
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
      update: (values: Record<string, unknown>) => {
        update(values);
        return {
          eq: () => ({
            eq: () => ({
              select: async () => ({ data: updatedRows, error: null }),
            }),
          }),
        };
      },
    }),
  };
  return { client, update };
}

const active = {
  id: "a1",
  pending_payout: 10,
  total_referrals: 2,
  total_conversions: 1,
  commission_rate: null,
  status: "active",
};

describe("accrueAffiliateCommission", () => {
  it("credits the base rate when the row has none, and counts a conversion", async () => {
    const { client, update } = fakeClient(active);
    const r = await accrueAffiliateCommission(client, {
      affiliateCode: "CUP20",
      amountCents: 4900,
      conversion: true,
    });
    expect(r).toEqual({ credited: true, affiliateId: "a1", commission: 9.8 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        pending_payout: 19.8,
        total_referrals: 3,
        total_conversions: 2,
      })
    );
  });

  it("leaves the counters alone on a renewal", async () => {
    const { client, update } = fakeClient({ ...active, commission_rate: 0.25 });
    await accrueAffiliateCommission(client, {
      affiliateCode: "CUP20",
      amountCents: 10000,
      conversion: false,
    });
    const values = update.mock.calls[0][0];
    expect(values.pending_payout).toBe(35);
    expect(values).not.toHaveProperty("total_conversions");
  });

  it("skips inactive and unknown affiliates", async () => {
    expect(
      await accrueAffiliateCommission(
        fakeClient({ ...active, status: "paused" }).client,
        {
          affiliateCode: "X",
          amountCents: 100,
          conversion: true,
        }
      )
    ).toEqual({ credited: false, reason: "inactive" });
    expect(
      await accrueAffiliateCommission(fakeClient(null).client, {
        affiliateCode: "X",
        amountCents: 100,
        conversion: true,
      })
    ).toEqual({ credited: false, reason: "unknown_code" });
  });

  it("reports a lost race instead of claiming a credit", async () => {
    const r = await accrueAffiliateCommission(fakeClient(active, []).client, {
      affiliateCode: "CUP20",
      amountCents: 4900,
      conversion: true,
    });
    expect(r).toEqual({ credited: false, reason: "concurrent_update" });
  });

  it("never throws", async () => {
    const client = {
      from: () => {
        throw new Error("boom");
      },
    };
    expect(
      await accrueAffiliateCommission(client, {
        affiliateCode: "CUP20",
        amountCents: 4900,
        conversion: true,
      })
    ).toEqual({ credited: false, reason: "boom" });
  });
});
