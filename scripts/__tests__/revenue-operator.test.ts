import { describe, expect, it } from "vitest";
import {
  checkMoneyRails,
  classifyRevenue,
  classifySend,
  decideOperatorAction,
  selectNextSendCandidate,
  moneyRailsSteps,
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

  it("counts a non-founder paid one-time charge without a payout (Starter path)", () => {
    const verdict = classifyRevenue(
      snap({
        charges: [
          {
            id: "ch_starter",
            amount: 2900,
            paid: true,
            email: "buyer@example.com",
          },
        ],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(true);
    expect(verdict.reason).toContain("ch_starter");
    expect(verdict.reason).toContain("buyer@example.com");
  });

  it("does not count zero-dollar paid-status charges as customer revenue", () => {
    const verdict = classifyRevenue(
      snap({
        charges: [
          { id: "ch_free", amount: 0, paid: true, email: "buyer@example.com" },
        ],
      }),
      founders
    );
    expect(verdict.qualifying).toBe(false);
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

  it("allows an operator-selected published inbox without named-this-turn", () => {
    const verdict = classifySend({
      namedInboxThisTurn: null,
      operatorSelectedInbox: "claire.stromboni@verkor.com",
      source: "published_contact",
    });
    expect(verdict.allowed).toBe(true);
    expect(verdict.to).toBe("claire.stromboni@verkor.com");
    expect(verdict.reason).toContain("operator-selected");
  });

  it("still refuses operator-selected guesses and role inboxes", () => {
    expect(
      classifySend({
        namedInboxThisTurn: null,
        operatorSelectedInbox: "ops@example.com",
        source: "pattern_guess",
      }).allowed
    ).toBe(false);
    expect(
      classifySend({
        namedInboxThisTurn: null,
        operatorSelectedInbox: "info@sfm-bikes.de",
        source: "published_contact",
      }).allowed
    ).toBe(false);
  });
});

describe("selectNextSendCandidate", () => {
  it("skips guesses and role inboxes, then picks the first published human", () => {
    const verdict = selectNextSendCandidate([
      { email: "info@guessed.com", source: "pattern_guess" },
      { email: "sales@ironfishdistillery.com", source: "published_contact" },
      { email: "claire.stromboni@verkor.com", source: "published_contact" },
      { email: "second@verkor.com", source: "published_contact" },
    ]);
    expect(verdict.allowed).toBe(true);
    expect(verdict.to).toBe("claire.stromboni@verkor.com");
  });

  it("returns no sendable published inbox when the list is only untrusted", () => {
    expect(
      selectNextSendCandidate([
        { email: "undone.k@gmail.com", source: "published_contact" },
        { email: "info@sfm-bikes.de", source: "published_contact" },
      ]).reason
    ).toBe("no sendable published inbox");
  });
});

describe("decideOperatorAction", () => {
  const railsOk = { ok: true, reason: "Starter $29 and DPP $299 checkout rails up" };

  it("returns fix_rails before anything else", () => {
    const decision = decideOperatorAction({
      rails: { ok: false, reason: "DPP HEAD 500" },
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

  it("selects one published candidate when no inbox was named this turn", () => {
    const decision = decideOperatorAction({
      rails: railsOk,
      snapshot: snap({}),
      candidates: [
        { email: "info@sfm-bikes.de", source: "published_contact" },
        { email: "claire.stromboni@verkor.com", source: "published_contact" },
      ],
    });
    expect(decision.action).toBe("send_one");
    expect(decision.to).toBe("claire.stromboni@verkor.com");
  });

  it("stays wait_buyer when candidates are only role or guessed inboxes", () => {
    const decision = decideOperatorAction({
      rails: railsOk,
      snapshot: snap({}),
      candidates: [
        { email: "info@sfm-bikes.de", source: "published_contact" },
        { email: "ops@example.com", source: "pattern_guess" },
      ],
    });
    expect(decision.action).toBe("wait_buyer");
    expect(decision.reason).toBe("no sendable published inbox");
  });
});

describe("money rails", () => {
  it("GET Starter and DPP confirm pages plus the Starter Payment Link; HEAD DPP; never GET anonymous dpp checkout", () => {
    const steps = moneyRailsSteps();
    expect(
      steps.some(
        s =>
          s.id === "starter_checkout" &&
          s.method === "GET" &&
          s.url.endsWith("/checkout/starter")
      )
    ).toBe(true);
    expect(
      steps.some(
        s =>
          s.id === "dpp_checkout" &&
          s.method === "GET" &&
          s.url.endsWith("/checkout/dpp_readiness")
      )
    ).toBe(true);
    expect(
      steps.some(
        s =>
          s.id === "starter_payment_link" &&
          s.method === "GET" &&
          s.url.includes("buy.stripe.com")
      )
    ).toBe(true);
    const dppHead = steps.find(s => s.id === "dpp_head");
    expect(dppHead?.method).toBe("HEAD");
    expect(dppHead?.url).toMatch(/\/api\/checkout\/dpp$/);
    expect(dppHead?.accept).toEqual([204]);
    expect(
      steps
        .filter(s => s.method === "GET")
        .every(s => !s.url.includes("/api/checkout/dpp") && s.method !== "POST")
    ).toBe(true);
    expect(
      steps.every(s => !s.url.includes("/api/checkout/plan/strainchain_farm"))
    ).toBe(true);
  });

  it("passes when Starter/DPP GET 200 and DPP HEAD 204", async () => {
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const status = method === "HEAD" ? 204 : 200;
      return { status } as Response;
    };
    const report = await checkMoneyRails("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(true);
    expect(report.reason).toMatch(/Starter \$29 and DPP \$299/);
  });

  it("fails when DPP HEAD is not 204", async () => {
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      return { status: method === "HEAD" ? 405 : 200 } as Response;
    };
    const report = await checkMoneyRails("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(false);
  });

  it("fails when Starter confirm is not 200", async () => {
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      if (method === "HEAD") return { status: 204 } as Response;
      if (url.endsWith("/checkout/starter")) return { status: 500 } as Response;
      return { status: 200 } as Response;
    };
    const report = await checkMoneyRails("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(false);
    expect(report.reason).toMatch(/starter_checkout/);
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

  it("keeps cold_outreach master switch off in autonomy.json", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const autonomy = JSON.parse(
      await readFile(join(root, ".github/autonomy.json"), "utf8")
    );
    expect(autonomy.cold_outreach.enabled).toBe(false);
    expect(autonomy.operator_hold.workflows).toEqual(
      expect.arrayContaining([
        "b2b-outreach.yml",
        "content-publish.yml",
        "gov-mint.yml",
        "marketing-autonomous.yml",
        "pipeline-tick.yml",
      ])
    );
  });

  it("defaults agent outbound email production_send to false", async () => {
    const { defaultOutboundPolicy } = await import(
      "../../workers/authichain-verify-worker/src/outbound-types"
    );
    expect(defaultOutboundPolicy().production_send).toBe(false);
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
          livemode: true,
          billing_details: { email: "ops@example.com" },
        },
      ],
    });
    expect(snapshot.charges[0].email).toBe("ops@example.com");
    expect(snapshot.charges[0].livemode).toBe(true);
  });

  it("keeps livemode false so a test-mode subscription cannot qualify", () => {
    const snapshot = snapshotFromStripeLike({
      subscriptions: [
        {
          id: "sub_test",
          status: "active",
          customer_email: "buyer@example.com",
          livemode: false,
        },
      ],
    });
    expect(snapshot.subscriptions[0].livemode).toBe(false);
    expect(classifyRevenue(snapshot).qualifying).toBe(false);
  });
});

describe("founder domain and test mode", () => {
  it("does not count an @authichain.com alias as a stranger subscription", () => {
    const verdict = classifyRevenue({
      subscriptions: [
        {
          id: "sub_ops",
          status: "active",
          customerEmail: "ops@authichain.com",
        },
      ],
      payouts: [],
      charges: [],
    });
    expect(verdict.qualifying).toBe(false);
  });

  it("does not let a test-mode paid charge unlock a payout", () => {
    const snapshot = snapshotFromStripeLike({
      payouts: [{ id: "po_test", amount: 2900, status: "paid" }],
      charges: [
        {
          id: "ch_test",
          amount: 2900,
          paid: true,
          livemode: false,
          billing_details: { email: "buyer@example.com" },
        },
      ],
    });
    expect(classifyRevenue(snapshot).qualifying).toBe(false);
  });
});

describe("manual desk addresses", () => {
  const desks = [
    "crew@canyon.com",
    "us@canyon.com",
    "webshop@sfm-bikes.de",
    "hi@northvolt.com",
    "dpo@verkor.com",
    "service.ebike@yamaha-ebike-systems.com",
  ];

  it("refuses published desk addresses unless allowRoleInbox is set", () => {
    for (const email of desks) {
      const refused = classifySend({
        namedInboxThisTurn: null,
        operatorSelectedInbox: email,
        source: "published_contact",
        allowRoleInbox: false,
      });
      expect(refused.allowed, email).toBe(false);
      expect(refused.reason, email).toContain("role_inbox");
    }
  });
});

describe("campaign candidate compliance", () => {
  it("selects a confirmed_reply candidate and refuses unknown provenance", () => {
    const allowed = selectNextSendCandidate(
      [
        {
          email: "robert@joinclab.com",
          source: "confirmed_reply",
          sourceUrl: "https://mail.google.com/",
        },
        {
          email: "scott.krupa@fastsigns.com",
          source: "unknown",
        },
      ],
      founders
    );
    expect(allowed.allowed).toBe(true);
    expect(allowed.to).toBe("robert@joinclab.com");

    const refused = selectNextSendCandidate(
      [
        {
          email: "scott.krupa@fastsigns.com",
          source: "unknown",
        },
        {
          email: "hannah.melotto@melottogroup.com",
          source: "unknown",
        },
      ],
      founders
    );
    expect(refused.allowed).toBe(false);
  });

  it("keeps decideOperatorAction on send_one for confirmed_reply without inventing revenue", () => {
    const decision = decideOperatorAction({
      rails: { ok: true, reason: "skipped", results: [] },
      snapshot: snap({}),
      candidates: [
        {
          email: "robert@joinclab.com",
          source: "confirmed_reply",
        },
      ],
      founderEmails: founders,
    });
    expect(decision.action).toBe("send_one");
    expect(decision.to).toBe("robert@joinclab.com");
    expect(decision.revenue.qualifying).toBe(false);
  });
});
