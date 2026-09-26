import { describe, expect, it } from "vitest";
import {
  checkFarmRails,
  classifyRevenue,
  classifySend,
  decideOperatorAction,
  farmRailsSteps,
  mayDisableOutreachApproval,
  mayDispatch,
  mayRunAgentzAuto,
  snapshotFromStripeLike,
  type RevenueSnapshot,
} from "../revenue-operator";

const founders = ["undone.k@gmail.com", "authichain@gmail.com"];

function snap(partial: Partial<RevenueSnapshot>): RevenueSnapshot {
  return {
    subscriptions: partial.subscriptions ?? [],
    payouts: partial.payouts ?? [],
    charges: partial.charges ?? [],
  };
}

describe("classifyRevenue", () => {
  it("does not treat an empty livemode account as revenue", () => {
    expect(classifyRevenue(snap({}), founders).qualifying).toBe(false);
  });

  it("does not count the founder $10 charge or a founder subscription", () => {
    const verdict = classifyRevenue(
      snap({
        subscriptions: [
          {
            id: "sub_founder",
            status: "active",
            customerEmail: "undone.k@gmail.com",
          },
        ],
        charges: [
          {
            id: "ch_10",
            amount: 1000,
            paid: true,
            email: "undone.k@gmail.com",
          },
        ],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(false);
  });

  it("counts an active subscription whose email is not a founder", () => {
    const verdict = classifyRevenue(
      snap({
        subscriptions: [
          {
            id: "sub_farm",
            status: "active",
            customerEmail: "ops@example.com",
          },
        ],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(true);
    expect(verdict.reason).toContain("sub_farm");
  });

  it("does not count a subscription with no email", () => {
    const verdict = classifyRevenue(
      snap({
        subscriptions: [
          { id: "sub_anon", status: "active", customerEmail: null },
        ],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(false);
    expect(verdict.reason).toContain("no customer email");
  });

  it("still counts a stranger sub when an anonymous sub is also present", () => {
    const verdict = classifyRevenue(
      snap({
        subscriptions: [
          { id: "sub_anon", status: "active", customerEmail: null },
          {
            id: "sub_farm",
            status: "active",
            customerEmail: "ops@example.com",
          },
        ],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(true);
    expect(verdict.reason).toContain("sub_farm");
  });

  it("counts past_due stranger subs and ignores cancelled ones", () => {
    expect(
      classifyRevenue(
        snap({
          subscriptions: [
            {
              id: "sub_due",
              status: "past_due",
              customerEmail: "ops@example.com",
            },
          ],
        }),
        founders
      ).qualifying
    ).toBe(true);
    expect(
      classifyRevenue(
        snap({
          subscriptions: [
            {
              id: "sub_dead",
              status: "canceled",
              customerEmail: "ops@example.com",
            },
          ],
        }),
        founders
      ).qualifying
    ).toBe(false);
  });

  it("counts a payout only when a non-founder charge was paid", () => {
    const blocked = classifyRevenue(
      snap({
        payouts: [{ id: "po_self", amount: 931, status: "pending" }],
        charges: [
          {
            id: "ch_10",
            amount: 1000,
            paid: true,
            email: "undone.k@gmail.com",
          },
        ],
      }),
      founders
    );
    expect(blocked.qualifying).toBe(false);

    const ok = classifyRevenue(
      snap({
        payouts: [{ id: "po_real", amount: 14900, status: "paid" }],
        charges: [
          {
            id: "ch_farm",
            amount: 14900,
            paid: true,
            email: "ops@example.com",
          },
        ],
      }),
      founders
    );
    expect(ok.qualifying).toBe(true);
  });

  it("does not treat a paid charge with no email as a stranger", () => {
    const verdict = classifyRevenue(
      snap({
        payouts: [{ id: "po_anon", amount: 14900, status: "paid" }],
        charges: [{ id: "ch_blank", amount: 14900, paid: true, email: null }],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(false);
  });

  it("does not unlock a payout with an unpaid stranger charge", () => {
    const verdict = classifyRevenue(
      snap({
        payouts: [{ id: "po_open", amount: 14900, status: "pending" }],
        charges: [
          {
            id: "ch_open",
            amount: 14900,
            paid: false,
            email: "ops@example.com",
          },
        ],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(false);
  });

  it("treats founder email case and whitespace as founder", () => {
    const verdict = classifyRevenue(
      snap({
        subscriptions: [
          {
            id: "sub_case",
            status: "active",
            customerEmail: "  Undone.K@gmail.com ",
          },
        ],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(false);
  });
});

describe("classifySend", () => {
  it("refuses when no inbox was named this turn", () => {
    expect(
      classifySend({
        namedInboxThisTurn: null,
        source: "published_contact",
      }).allowed
    ).toBe(false);
  });

  it("refuses guessed aliases and unknown provenance", () => {
    expect(
      classifySend({
        namedInboxThisTurn: "bernard.arnault@lvmh.com",
        source: "pattern_guess",
      }).reason
    ).toContain("untrusted_source:pattern_guess");
    expect(
      classifySend({
        namedInboxThisTurn: "ops@example.com",
        source: "unknown",
      }).reason
    ).toContain("untrusted_source:unknown");
  });

  it("refuses founder inboxes", () => {
    expect(
      classifySend({
        namedInboxThisTurn: "authichain@gmail.com",
        source: "published_contact",
      }).allowed
    ).toBe(false);
  });

  it("allows one published inbox named this turn", () => {
    const verdict = classifySend({
      namedInboxThisTurn: "press@permitflow.com",
      source: "published_contact",
    });
    expect(verdict.allowed).toBe(true);
    expect(verdict.to).toBe("press@permitflow.com");
  });

  it("blocks a published role inbox unless allowRoleInbox is set", () => {
    expect(
      classifySend({
        namedInboxThisTurn: "sales@ironfishdistillery.com",
        source: "published_contact",
      }).allowed
    ).toBe(false);
    expect(
      classifySend({
        namedInboxThisTurn: "sales@ironfishdistillery.com",
        source: "published_contact",
        allowRoleInbox: true,
      }).allowed
    ).toBe(true);
  });
});

describe("decideOperatorAction", () => {
  const railsOk = { ok: true, reason: "Farm rails ok" };

  it("returns fix_rails before anything else", () => {
    const decision = decideOperatorAction({
      rails: { ok: false, reason: "Farm HEAD 500" },
      snapshot: snap({
        subscriptions: [
          {
            id: "sub_farm",
            status: "active",
            customerEmail: "ops@example.com",
          },
        ],
      }),
    });
    expect(decision.action).toBe("fix_rails");
  });

  it("returns qualifying for a stranger sub and does not send", () => {
    const decision = decideOperatorAction({
      rails: railsOk,
      snapshot: snap({
        subscriptions: [
          {
            id: "sub_farm",
            status: "active",
            customerEmail: "ops@example.com",
          },
        ],
      }),
      send: {
        namedInboxThisTurn: "press@permitflow.com",
        source: "published_contact",
      },
    });
    expect(decision.action).toBe("qualifying");
  });

  it("returns wait_buyer on an empty account with no named send", () => {
    const decision = decideOperatorAction({
      rails: railsOk,
      snapshot: snap({}),
    });
    expect(decision.action).toBe("wait_buyer");
  });

  it("returns send_one only when classifySend allows", () => {
    const allowed = decideOperatorAction({
      rails: railsOk,
      snapshot: snap({}),
      send: {
        namedInboxThisTurn: "press@permitflow.com",
        source: "published_contact",
      },
    });
    expect(allowed.action).toBe("send_one");
    expect(allowed.to).toBe("press@permitflow.com");

    const refused = decideOperatorAction({
      rails: railsOk,
      snapshot: snap({}),
      send: {
        namedInboxThisTurn: "info@guessed.com",
        source: "pattern_guess",
      },
    });
    expect(refused.action).toBe("refuse_send");
  });
});

describe("farm rails", () => {
  it("GET the Payment Link and HEAD Farm checkout, never GET dpp", () => {
    const steps = farmRailsSteps();
    expect(
      steps.some(s => s.id === "farm_payment_link" && s.method === "GET")
    ).toBe(true);
    expect(steps.some(s => s.id === "farm_head" && s.method === "HEAD")).toBe(
      true
    );
    expect(
      steps.every(
        s => !s.url.includes("/api/checkout/dpp") && s.method !== "POST"
      )
    ).toBe(true);
    const farm = steps.find(s => s.id === "farm_head");
    expect(farm?.accept).toEqual([204]);
  });

  it("passes when Payment Link is 200 and Farm HEAD is 204", async () => {
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const status = method === "HEAD" ? 204 : 200;
      return { status } as Response;
    };
    const report = await checkFarmRails("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(true);
  });

  it("fails when Farm HEAD is not 204", async () => {
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      return { status: method === "HEAD" ? 405 : 200 } as Response;
    };
    const report = await checkFarmRails("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(false);
  });
});

describe("freeze gates", () => {
  it("refuses frozen workflow dispatch", () => {
    expect(mayDispatch("outreach-trigger.yml").allowed).toBe(false);
    expect(mayDispatch("b2b-outreach").allowed).toBe(false);
    expect(mayDispatch("gov-mint").allowed).toBe(false);
    expect(mayDispatch("deploy-authichain-com.yml").allowed).toBe(true);
  });

  it("refuses REQUIRE_OUTREACH_APPROVAL=false and AgentZ auto", () => {
    expect(mayDisableOutreachApproval("false").allowed).toBe(false);
    expect(mayDisableOutreachApproval(true).allowed).toBe(true);
    expect(mayRunAgentzAuto("auto").allowed).toBe(false);
    expect(mayRunAgentzAuto("confirm").allowed).toBe(true);
  });
});

describe("snapshotFromStripeLike", () => {
  it("reads Stripe snake_case charge emails", () => {
    const snapshot = snapshotFromStripeLike({
      charges: [
        {
          id: "ch_live",
          amount: 14900,
          paid: true,
          billing_details: { email: "ops@example.com" },
        },
      ],
    });
    expect(snapshot.charges[0].email).toBe("ops@example.com");
  });
});
