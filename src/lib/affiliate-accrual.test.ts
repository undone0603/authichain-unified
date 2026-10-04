import { describe, it, expect, vi } from "vitest";
import { accrueAffiliateCommission } from "./affiliate-accrual";

describe("accrueAffiliateCommission", () => {
  it("delegates atomic event-keyed crediting to the database", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { credited: true, affiliate_id: "a1", commission: 9.8 },
      error: null,
    });
    const client = { rpc };
    const r = await accrueAffiliateCommission(client, {
      affiliateCode: "CUP20",
      amountCents: 4900,
      conversion: true,
      eventId: "evt_checkout_1",
    });
    expect(r).toEqual({ credited: true, affiliateId: "a1", commission: 9.8 });
    expect(rpc).toHaveBeenCalledWith("accrue_affiliate_commission", {
      p_event_id: "evt_checkout_1",
      p_affiliate_code: "CUP20",
      p_amount_cents: 4900,
      p_conversion: true,
    });
  });

  it("returns database errors so the webhook can request delivery retry", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "database unavailable" },
      }),
    };
    expect(
      await accrueAffiliateCommission(client, {
        affiliateCode: "CUP20",
        amountCents: 4900,
        conversion: true,
        eventId: "evt_renewal_1",
      })
    ).toEqual({ credited: false, reason: "rpc: database unavailable" });
  });
});
