import { describe, expect, it } from "vitest";
import {
  classifyRevenue,
  decideOperatorAction,
  DEFAULT_FOUNDER_EMAILS,
} from "../revenue-operator";

describe("first-customer revenue detection", () => {
  it("does not qualify the founder $10 livemode charge", () => {
    const verdict = classifyRevenue(
      {
        subscriptions: [],
        payouts: [],
        charges: [
          {
            id: "ch_3UHcQfGqTruSqV8T1j4hdD7l",
            amount: 1000,
            paid: true,
            email: "undone.k@gmail.com",
          },
        ],
      },
      DEFAULT_FOUNDER_EMAILS
    );
    expect(verdict.qualifying).toBe(false);
  });

  it("qualifies a stranger Starter $29 paid charge and decide returns qualifying", () => {
    const snapshot = {
      subscriptions: [],
      payouts: [],
      charges: [
        {
          id: "ch_starter_buyer",
          amount: 2900,
          paid: true,
          email: "buyer@example.com",
        },
      ],
    };
    const verdict = classifyRevenue(snapshot, DEFAULT_FOUNDER_EMAILS);
    expect(verdict.qualifying).toBe(true);

    const decision = decideOperatorAction({
      rails: { ok: true, reason: "skipped", results: [] },
      snapshot,
      founderEmails: DEFAULT_FOUNDER_EMAILS,
    });
    expect(decision.action).toBe("qualifying");
    expect(decision.revenue.qualifying).toBe(true);
  });

  it("fulfillment evidence must name a non-founder buyer and granted entitlement", () => {
    function fulfillmentOk(f: {
      webhook_event_id?: string;
      session_id?: string;
      entitlement?: string;
      entitlement_granted?: boolean;
      buyer_email?: string;
    }): boolean {
      if (
        !f.webhook_event_id ||
        !f.session_id ||
        !f.buyer_email ||
        (f.entitlement !== "granted" && f.entitlement_granted !== true)
      ) {
        return false;
      }
      const email = f.buyer_email.toLowerCase();
      if (
        DEFAULT_FOUNDER_EMAILS.map(e => e.toLowerCase()).includes(email) ||
        email.endsWith("@authichain.com")
      ) {
        return false;
      }
      return true;
    }

    expect(
      fulfillmentOk({
        webhook_event_id: "evt_1",
        session_id: "cs_live_1",
        entitlement: "granted",
        buyer_email: "buyer@example.com",
      })
    ).toBe(true);
    expect(
      fulfillmentOk({
        webhook_event_id: "evt_1",
        session_id: "cs_live_1",
        entitlement: "granted",
        buyer_email: "undone.k@gmail.com",
      })
    ).toBe(false);
    expect(
      fulfillmentOk({
        webhook_event_id: "evt_1",
        session_id: "cs_live_1",
        entitlement: "pending",
        buyer_email: "buyer@example.com",
      })
    ).toBe(false);
  });
});
