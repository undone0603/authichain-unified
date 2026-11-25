import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  gapReportIntakeEmail,
  gapReportOrder,
  gapReportPaidAlert,
  notifyGapReportPaid,
} from "./gap-report-paid";
import { planById } from "../plans";

const GAP_PRICE = planById("battery_gap_report")!.stripe_price_id!;
const EXTRA_PRICE = planById("battery_gap_report_extra")!.stripe_price_id!;
const DPP_PRICE = planById("dpp_readiness")!.stripe_price_id!;

function session(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_live_test123",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    amount_total: 95000,
    livemode: true,
    customer_details: { email: "buyer@example.com" },
    metadata: { plan: "battery_gap_report", stripe_price_id: GAP_PRICE },
    ...over,
  } as unknown as Stripe.Checkout.Session;
}

describe("gapReportOrder", () => {
  it("matches a paid gap report by exact price ID", () => {
    const o = gapReportOrder(session(), GAP_PRICE)!;
    expect(o.planId).toBe("battery_gap_report");
    expect(o.amountUsd).toBe(950);
    expect(o.email).toBe("buyer@example.com");
  });

  it("matches the extra-model plan", () => {
    const s = session({ amount_total: 35000, metadata: { plan: "battery_gap_report_extra" } });
    expect(gapReportOrder(s, EXTRA_PRICE)!.planId).toBe("battery_gap_report_extra");
  });

  it("ignores unpaid, subscription and demo sessions", () => {
    expect(gapReportOrder(session({ payment_status: "unpaid" }), GAP_PRICE)).toBeNull();
    expect(gapReportOrder(session({ mode: "subscription" }), GAP_PRICE)).toBeNull();
    expect(
      gapReportOrder(session({ metadata: { plan: "battery_gap_report", is_demo: "true" } }), GAP_PRICE)
    ).toBeNull();
  });

  it("never lets metadata override a different plan's price", () => {
    // A DPP price with gap-report metadata is a DPP sale, not a gap report.
    expect(gapReportOrder(session(), DPP_PRICE)).toBeNull();
  });

  it("falls back to metadata.plan only when the price is unknown", () => {
    expect(gapReportOrder(session(), null)!.planId).toBe("battery_gap_report");
    expect(gapReportOrder(session({ metadata: { plan: "starter" } }), null)).toBeNull();
  });

  it("never matches by amount alone", () => {
    expect(gapReportOrder(session({ metadata: {} }), null)).toBeNull();
  });
});

describe("gapReportPaidAlert", () => {
  it("names the buyer, the session and the next step", () => {
    const a = gapReportPaidAlert(gapReportOrder(session(), GAP_PRICE)!);
    expect(a.subject).toContain("buyer@example.com");
    expect(a.text).toContain("cs_live_test123");
    expect(a.text).toContain("$950.00");
    expect(a.text).toContain("intake questionnaire");
    expect(a.click).toBe("https://dashboard.stripe.com/checkout/sessions/cs_live_test123");
  });

  it("flags test-mode sessions", () => {
    const a = gapReportPaidAlert(gapReportOrder(session({ livemode: false }), GAP_PRICE)!);
    expect(a.title).toContain("TEST MODE");
    expect(a.click).toContain("/test/");
  });
});

describe("notifyGapReportPaid", () => {
  it("publishes once for a paid order", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const order = await notifyGapReportPaid(session(), GAP_PRICE, publish);
    expect(order?.planId).toBe("battery_gap_report");
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("publishes nothing for other sales", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    expect(await notifyGapReportPaid(session(), DPP_PRICE, publish)).toBeNull();
    expect(publish).not.toHaveBeenCalled();
  });

  it("never throws when the alert fails", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("ntfy down"));
    const order = await notifyGapReportPaid(session(), GAP_PRICE, publish);
    expect(order?.planId).toBe("battery_gap_report");
  });
});

describe("gap report intake email", () => {
  const order = () => gapReportOrder(session(), GAP_PRICE)!;

  it("sends the questionnaire to the buyer with replies to the founder inbox", () => {
    const e = gapReportIntakeEmail({ ...order(), email: "buyer@example.com" });
    expect(e.to).toBe("buyer@example.com");
    expect(e.replyTo).toBe("authichain@gmail.com");
    expect(e.body).toContain("Model designation");
    expect(e.body).toContain("EU declaration of conformity");
    expect(e.body).toContain("cs_live_test123");
    expect(e.body).toContain("Not a conformity assessment");
    // No delivery date is promised anywhere in the email.
    expect(e.body).not.toMatch(/business days|within \d+ days/i);
    // Team rule: no street address in outbound email.
    expect(e.body).not.toMatch(/\b\d{1,6} [\w. ]+ (St|Ave|Rd|Blvd|Dr|Ln)\b|\b[A-Z]{2} \d{5}\b/);
  });

  it("emails the buyer before alerting, and reports the outcome", async () => {
    const calls: string[] = [];
    const send = vi.fn(async () => {
      calls.push("send");
      return { status: "sent" };
    });
    const publish = vi.fn(async (a: { text: string }) => {
      calls.push("publish");
      expect(a.text).toContain("Intake questionnaire emailed");
    });
    const o = await notifyGapReportPaid(session(), GAP_PRICE, publish, send);
    expect(o?.intake).toBe("sent");
    expect(send).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["send", "publish"]);
  });

  it("tells the founder to send by hand when the email is not accepted", async () => {
    for (const [result, expected] of [
      [{ status: "skipped" }, "skipped"],
      [{ status: "suppressed" }, "suppressed"],
      [{ status: "weird" }, "error"],
    ] as const) {
      const publish = vi.fn().mockResolvedValue(undefined);
      const o = await notifyGapReportPaid(session(), GAP_PRICE, publish, async () => result);
      expect(o?.intake).toBe(expected);
      expect(publish.mock.calls[0][0].text).toContain("NOT sent");
      expect(publish.mock.calls[0][0].text).toContain("--questions");
    }
  });

  it("never throws when the send throws", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockRejectedValue(new Error("resend down"));
    const o = await notifyGapReportPaid(session(), GAP_PRICE, publish, send);
    expect(o?.intake).toBe("error");
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("skips the send without a buyer email", async () => {
    const send = vi.fn();
    const s = session({ customer_details: null, customer_email: null });
    const o = await notifyGapReportPaid(s, GAP_PRICE, vi.fn().mockResolvedValue(undefined), send);
    expect(o?.intake).toBe("no_buyer_email");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing for other sales", async () => {
    const send = vi.fn();
    expect(await notifyGapReportPaid(session(), DPP_PRICE, vi.fn(), send)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
