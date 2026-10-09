import { describe, expect, it } from "vitest";
import {
  flatten,
  listWorkflowFiles,
  loadManifest,
  operatorHold,
  planReconcile,
  validateManifest,
} from "../autonomy/reconcile.mjs";
import {
  evaluate,
  outreachSenders,
} from "../autonomy/deliverability-breaker.mjs";
import {
  MAX_WINDOW_DAYS,
  launchMode,
  validateLaunchMode,
} from "../autonomy/launch-mode.mjs";
import {
  decideIssueAction,
  evaluateWorkflows,
  isCallOnly,
  isQueuedCancellation,
  pickLatestCompletedRun,
  runProbes,
  signature,
} from "../autonomy/ops-pulse.mjs";

const mini = () => ({
  lanes: {
    ship: { managed: true, workflows: { "ci.yml": "on" } },
    growth: { managed: true, workflows: { "a.yml": "on", "b.yml": "off" } },
    manual: { managed: false, workflows: { "m.yml": "manual" } },
  },
  cold_outreach: {
    enabled: false,
    max_new_prospects_per_day: 10,
    segments: ["qron"],
    breaker: {
      window_days: 7,
      max_bounce_rate: 0.05,
      max_complaints: 0,
      min_sample: 10,
    },
  },
});

describe("autonomy manifest", () => {
  it("the real manifest classifies every workflow file exactly once", () => {
    expect(validateManifest(loadManifest(), listWorkflowFiles())).toEqual([]);
  });

  it("has cold outreach switched off (containment, 2026-10-09), a cap, and a strict breaker", () => {
    const co = loadManifest().cold_outreach;
    expect(co.enabled).toBe(false);
    expect(co.max_new_prospects_per_day).toBeLessThanOrEqual(10);
    expect(co.breaker.max_bounce_rate).toBeLessThanOrEqual(0.03);
    expect(co.breaker.max_complaints).toBe(0);
  });

  it("flags unclassified, duplicate, stale and invalid entries", () => {
    const m = mini();
    (m.lanes.growth.workflows as Record<string, string>)["ci.yml"] = "on";
    (m.lanes.manual.workflows as Record<string, string>)["x.yml"] = "on";
    const errs = validateManifest(m, [
      "ci.yml",
      "a.yml",
      "b.yml",
      "m.yml",
      "new.yml",
    ]);
    expect(errs.join("\n")).toMatch(/ci.yml is listed in both/);
    expect(errs.join("\n")).toMatch(/new.yml exists .* not classified/);
    expect(errs.join("\n")).toMatch(/x.yml is in .* no such workflow file/);
    expect(errs.join("\n")).toMatch(/x.yml: lane "manual" is unmanaged/);
  });

  it("rejects an outreach cap above 50", () => {
    const m = mini();
    m.cold_outreach.max_new_prospects_per_day = 500;
    expect(
      validateManifest(m, ["ci.yml", "a.yml", "b.yml", "m.yml"]).join()
    ).toMatch(/0-50/);
  });
});

describe("launch mode", () => {
  const NOW = new Date("2026-09-27T12:00:00Z");
  const withLaunch = (launch_mode: Record<string, unknown>) => ({
    ...mini(),
    launch_mode,
  });

  it("is active until the end of its expiry day, with its own cap", () => {
    const m = withLaunch({
      enabled: true,
      expires: "2026-10-31",
      cold_outreach_cap: 25,
    });
    expect(launchMode(m, NOW)).toEqual({
      active: true,
      expires: "2026-10-31",
      daysLeft: 35,
      coldOutreachCap: 25,
    });
    expect(launchMode(m, new Date("2026-10-31T23:00:00Z")).active).toBe(true);
  });

  it("tightens back on its own after expiry", () => {
    const m = withLaunch({
      enabled: true,
      expires: "2026-10-31",
      cold_outreach_cap: 25,
    });
    const after = launchMode(m, new Date("2026-11-01T00:00:01Z"));
    expect(after.active).toBe(false);
    expect(after.coldOutreachCap).toBe(10);
  });

  it("is inactive when absent, disabled or malformed", () => {
    expect(launchMode(mini(), NOW).active).toBe(false);
    expect(
      launchMode(withLaunch({ enabled: false, expires: "2026-10-31" }), NOW)
        .active
    ).toBe(false);
    expect(
      launchMode(withLaunch({ enabled: true, expires: "soon" }), NOW).active
    ).toBe(false);
    expect(
      launchMode(withLaunch({ enabled: "yes", expires: "2026-10-31" }), NOW)
        .active
    ).toBe(false);
  });

  it("falls back to the normal cap when no launch cap is set", () => {
    expect(
      launchMode(withLaunch({ enabled: true, expires: "2026-10-31" }), NOW)
        .coldOutreachCap
    ).toBe(10);
  });

  it(`rejects a window over ${MAX_WINDOW_DAYS} days, a bad date and a cap over 50`, () => {
    expect(
      validateLaunchMode(
        withLaunch({ enabled: true, expires: "2027-06-01" }),
        NOW
      ).join()
    ).toMatch(/within 90 days/);
    expect(
      validateLaunchMode(
        withLaunch({ enabled: true, expires: "31/10/2026" }),
        NOW
      ).join()
    ).toMatch(/YYYY-MM-DD/);
    expect(
      validateLaunchMode(
        withLaunch({
          enabled: true,
          expires: "2026-10-31",
          cold_outreach_cap: 500,
        }),
        NOW
      ).join()
    ).toMatch(/0-50/);
    expect(
      validateLaunchMode(
        withLaunch({ enabled: false, expires: "2027-06-01" }),
        NOW
      )
    ).toEqual([]);
    expect(validateLaunchMode(mini(), NOW)).toEqual([]);
  });

  it("the real manifest's launch window is within bounds", () => {
    expect(validateLaunchMode(loadManifest())).toEqual([]);
  });

  it("holds the 2026-10-08 manual disables and still classifies every file", () => {
    const manifest = loadManifest();
    expect([...(manifest.operator_hold?.workflows ?? [])].sort()).toEqual([
      "b2b-outreach.yml",
      "content-publish.yml",
      "gov-mint.yml",
      "marketing-autonomous.yml",
      "pipeline-tick.yml",
    ]);
    expect(validateManifest(manifest, listWorkflowFiles())).toEqual([]);
  });

  it("keeps the CFA-150 containment set off in the manifest, not only via operator_hold", () => {
    const desired = new Map(
      flatten(loadManifest()).map(r => [r.file, r.desired])
    );
    for (const f of [
      "autonomy-reconcile.yml",
      "content-routine-pr.yml",
      "b2b-outreach.yml",
      "content-publish.yml",
      "gov-mint.yml",
      "marketing-autonomous.yml",
      "pipeline-tick.yml",
    ]) {
      expect([f, desired.get(f)]).toEqual([f, "off"]);
    }
  });
});

describe("planReconcile", () => {
  const remote = [
    { id: 1, path: ".github/workflows/ci.yml", state: "active" },
    { id: 2, path: ".github/workflows/a.yml", state: "disabled_manually" },
    { id: 3, path: ".github/workflows/b.yml", state: "active" },
    { id: 4, path: ".github/workflows/m.yml", state: "disabled_manually" },
    { id: 5, path: ".github/workflows/ghost.yml", state: "active" },
  ];

  it("enables desired-on, disables desired-off, never touches manual", () => {
    const { changes, unknownRemote } = planReconcile(mini(), remote);
    expect(changes).toEqual([
      {
        file: "a.yml",
        id: 2,
        lane: "growth",
        from: "disabled_manually",
        to: "enable",
      },
      { file: "b.yml", id: 3, lane: "growth", from: "active", to: "disable" },
    ]);
    expect(unknownRemote).toEqual(["ghost.yml"]);
  });

  it("does not re-enable a workflow on the operator hold", () => {
    const manifest = { ...mini(), operator_hold: { workflows: ["a.yml"] } };
    const held = remote.map(w =>
      w.id === 3 ? { ...w, state: "disabled_manually" } : w
    );
    expect(planReconcile(manifest, held).changes).toEqual([]);
  });

  it("is a no-op when GitHub already matches", () => {
    const synced = remote.map(w =>
      w.id === 2
        ? { ...w, state: "active" }
        : w.id === 3
          ? { ...w, state: "disabled_manually" }
          : w
    );
    expect(planReconcile(mini(), synced).changes).toEqual([]);
  });
});

describe("deliverability breaker", () => {
  const cfg = mini().cold_outreach.breaker;
  const now = Date.parse("2026-09-23T12:00:00Z");
  const mk = (
    n: number,
    ev: string,
    daysAgo = 1,
    from = "hello@authichain.com"
  ) =>
    Array.from({ length: n }, () => ({
      created_at: new Date(now - daysAgo * 86_400_000).toISOString(),
      last_event: ev,
      from,
    }));

  it("stays clear under the bounce limit", () => {
    const v = evaluate([...mk(19, "delivered"), ...mk(1, "bounced")], cfg, {
      now,
    });
    expect(v.tripped).toBe(false);
    expect(v.stats.bounce_rate).toBe(0.05);
  });

  it("trips above the bounce limit", () => {
    expect(
      evaluate([...mk(18, "delivered"), ...mk(2, "bounced")], cfg, { now })
        .tripped
    ).toBe(true);
  });

  it("trips on any spam complaint regardless of sample size", () => {
    const v = evaluate([...mk(2, "delivered"), ...mk(1, "complained")], cfg, {
      now,
    });
    expect(v.tripped).toBe(true);
    expect(v.reason).toMatch(/complaint/);
  });

  it("does not trip on a tiny sample below min_sample", () => {
    expect(
      evaluate([...mk(3, "delivered"), ...mk(2, "bounced")], cfg, { now })
        .tripped
    ).toBe(false);
  });

  it("ignores sends outside the window and from other senders", () => {
    const v = evaluate(
      [
        ...mk(20, "bounced", 30),
        ...mk(20, "bounced", 1, "receipts@stripe.com"),
        ...mk(12, "delivered"),
      ],
      cfg,
      {
        now,
        senders: ["authichain.com"],
      }
    );
    expect(v.stats.sent).toBe(12);
    expect(v.tripped).toBe(false);
  });

  it("counts each Resend email id once when both keys return it", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `em_${i}`,
      created_at: new Date(now - 86_400_000).toISOString(),
      last_event: i === 0 ? "bounced" : "delivered",
      from: "hello@authichain.com",
    }));
    const v = evaluate([...rows, ...rows], cfg, { now });
    expect(v.stats.sent).toBe(10);
    expect(v.stats.bounces).toBe(1);
  });

  it("uses OUTREACH_SENDERS, else the per-segment outreach from-addresses", () => {
    expect(
      outreachSenders({
        OUTREACH_SENDERS: " a@x.test , ",
        OUTREACH_FROM_QRON: "q@x.test",
      })
    ).toEqual(["a@x.test"]);
    expect(
      outreachSenders({
        OUTREACH_FROM_GOVCHAIN: "g@x.test",
        OUTREACH_FROM_STRAINCHAIN: "",
        OUTREACH_FROM_QRON: "q@x.test",
      })
    ).toEqual(["g@x.test", "q@x.test"]);
    expect(outreachSenders({})).toEqual([]);
  });
});

describe("ops pulse", () => {
  const rows = flatten(mini());
  const remote = [
    { id: 2, path: ".github/workflows/a.yml", state: "active" },
    { id: 3, path: ".github/workflows/b.yml", state: "disabled_manually" },
  ];

  it("reports failing and wrongly-disabled loops, ignores ship lane and off loops", () => {
    const runs = new Map([
      ["a.yml", { conclusion: "failure", html_url: "u", created_at: "" }],
      ["ci.yml", { conclusion: "failure", html_url: "u", created_at: "" }],
    ]);
    expect(
      evaluateWorkflows(rows, remote, runs).map(p => `${p.file}:${p.kind}`)
    ).toEqual(["a.yml:failing"]);
    const disabled = [
      { id: 2, path: ".github/workflows/a.yml", state: "disabled_manually" },
    ];
    expect(
      evaluateWorkflows(rows, disabled, new Map()).map(p => p.kind)
    ).toEqual(["disabled"]);
    expect(
      evaluateWorkflows(
        rows,
        disabled,
        new Map(),
        new Set(),
        new Set(["a.yml"])
      )
    ).toEqual([]);
    expect(operatorHold({ operator_hold: { workflows: ["a.yml"] } })).toEqual(
      new Set(["a.yml"])
    );
  });

  it("keeps the newest completed run on main when the branch query is stale", () => {
    const picked = pickLatestCompletedRun([
      {
        head_branch: "feat",
        conclusion: "failure",
        created_at: "2026-10-05T00:00:00Z",
        html_url: "pr",
      },
      {
        head_branch: "main",
        conclusion: "success",
        created_at: "2026-10-04T15:59:22Z",
        html_url: "new",
      },
      {
        head_branch: "main",
        conclusion: "failure",
        created_at: "2026-09-01T13:20:33Z",
        html_url: "old",
      },
    ]);
    expect(picked.html_url).toBe("new");
    expect(picked.conclusion).toBe("success");
    expect(pickLatestCompletedRun([])).toBeNull();
  });

  it("does not page when the only jobs were cancelled before they started", () => {
    const runs = new Map([
      [
        "a.yml",
        {
          conclusion: "failure",
          html_url: "u",
          created_at: "",
          queued_cancellation: true,
        },
      ],
    ]);
    expect(evaluateWorkflows(rows, remote, runs)).toEqual([]);
    expect(
      isQueuedCancellation([
        { conclusion: "cancelled", steps: [] },
        { conclusion: "cancelled" },
      ])
    ).toBe(true);
    expect(
      isQueuedCancellation([{ conclusion: "failure", steps: [{ name: "x" }] }])
    ).toBe(false);
    expect(isQueuedCancellation([])).toBe(false);
  });

  it("skips a queued cancellation and keeps the older real run", () => {
    const picked = pickLatestCompletedRun(
      [
        {
          id: 2,
          head_branch: "main",
          conclusion: "failure",
          created_at: "2026-10-06T00:00:00Z",
          html_url: "cancelled",
        },
        {
          id: 1,
          head_branch: "main",
          conclusion: "success",
          created_at: "2026-10-05T00:00:00Z",
          html_url: "ok",
        },
      ],
      "main",
      run => run.id === 2
    );
    expect(picked?.html_url).toBe("ok");
  });

  it("skips the stale run history of reusable (workflow_call-only) loops", () => {
    const runs = new Map([
      ["a.yml", { conclusion: "failure", html_url: "u", created_at: "" }],
    ]);
    expect(evaluateWorkflows(rows, remote, runs, new Set(["a.yml"]))).toEqual(
      []
    );
    expect(
      isCallOnly(
        "name: x\non:\n  workflow_call:\n    inputs:\n      a:\n        type: string\njobs:\n  j: {}\n"
      )
    ).toBe(true);
    expect(
      isCallOnly("on:\n  workflow_dispatch:\n  workflow_call:\njobs: {}\n")
    ).toBe(false);
    expect(isCallOnly('on:\n  schedule:\n    - cron: "0 6 * * *"\n')).toBe(
      false
    );
  });

  const red = {
    at: "t",
    probes: [{ name: "site", url: "u", expect: [200], ok: false, status: 502 }],
    workflows: [],
  };
  const green = {
    at: "t",
    probes: [{ name: "site", url: "u", expect: [200], ok: true, status: 200 }],
    workflows: [],
  };

  it("creates one issue when red, stays quiet when unchanged, updates when changed, closes when green", () => {
    const created = decideIssueAction(null, red);
    expect(created.action).toBe("create");
    expect(
      decideIssueAction({ number: 1, body: created.body }, red).action
    ).toBe("none");
    const redder = {
      ...red,
      workflows: [
        { file: "a.yml", lane: "growth", kind: "failing", detail: "x" },
      ],
    };
    expect(
      decideIssueAction({ number: 1, body: created.body }, redder).action
    ).toBe("update");
    expect(
      decideIssueAction({ number: 1, body: created.body }, green).action
    ).toBe("close");
    expect(decideIssueAction(null, green).action).toBe("none");
    expect(signature(green)).toBe("");
  });

  it("retries a failed probe once before calling it red", async () => {
    let calls = 0;
    const flaky = async () =>
      ({ status: ++calls === 1 ? 503 : 200 }) as Response;
    const [r] = await runProbes(
      [{ name: "x", url: "https://x", expect: [200] }],
      { fetchImpl: flaky, retryDelayMs: 1 }
    );
    expect(r.ok).toBe(true);
    expect(calls).toBe(2);
  });
});

describe("fulfilment watchdog", async () => {
  const { findUnfulfilled } = await import("../autonomy/revenue-watch.mjs");
  const now = Date.parse("2026-09-23T12:00:00Z");
  const s = (
    id: string,
    minsAgo: number,
    extra: Record<string, unknown> = {}
  ) => ({
    id,
    status: "complete",
    payment_status: "paid",
    created: Math.floor((now - minsAgo * 60_000) / 1000),
    customer_details: { email: `${id}@buyer.com` },
    ...extra,
  });

  it("flags paid sessions with no successful webhook record, never fresh or founder ones", () => {
    const sessions = [
      s("cs_ok", 60),
      s("cs_missing", 60),
      s("cs_error", 60),
      s("cs_fresh", 5),
      s("cs_founder", 60, { customer_details: { email: "Me@Founder.com" } }),
      s("cs_unpaid", 60, { payment_status: "unpaid" }),
      s("cs_demo", 60, { metadata: { is_demo: "true" } }),
      s("cs_smoke", 60, {
        customer_details: { email: "smoke+dpp@authichain.com" },
      }),
    ];
    const events = [
      {
        session_id: "cs_ok",
        event_type: "checkout.session.completed",
        status: "received",
      },
      {
        session_id: "cs_ok",
        event_type: "checkout.session.completed",
        status: "success",
      },
      {
        session_id: "cs_error",
        event_type: "checkout.session.completed",
        status: "error",
      },
    ];
    const out = findUnfulfilled(sessions, events, {
      now,
      founderEmails: ["me@founder.com", "@authichain.com"],
    });
    expect(
      out.map(
        (p: { session: string; reason: string }) => `${p.session}:${p.reason}`
      )
    ).toEqual([
      "cs_missing:no webhook record",
      "cs_error:webhook ran but did not succeed",
    ]);
  });

  it("puts unfulfilled payments into the alert signature", () => {
    const report = {
      at: "t",
      probes: [],
      workflows: [],
      revenue: [{ session: "cs_x", reason: "r", paid_at: "p" }],
    };
    expect(signature(report)).toBe("pay:cs_x");
    expect(decideIssueAction(null, report).body).toContain(
      "Paid but not fulfilled"
    );
  });
});

describe("approval queue", async () => {
  const { decide, latchHeld, latchSearchQuery } =
    await import("../autonomy/approvals.mjs");
  const issue = (labels: string[]) => ({
    labels: labels.map(name => ({ name })),
  });
  const ev = (login: string, name: string) => ({
    event: "labeled",
    actor: { login },
    label: { name },
  });

  it("counts only the owner's label, and only while it is still on the issue", () => {
    expect(
      decide(issue(["approved"]), [ev("someone", "approved")], "undone0603")
    ).toBe("pending");
    expect(
      decide(issue(["approved"]), [ev("Undone0603", "approved")], "undone0603")
    ).toBe("approved");
    expect(
      decide(issue([]), [ev("undone0603", "approved")], "undone0603")
    ).toBe("pending");
    expect(
      decide(
        issue(["approved", "denied"]),
        [ev("undone0603", "approved"), ev("undone0603", "denied")],
        "undone0603"
      )
    ).toBe("denied");
    expect(decide(null, [], "undone0603")).toBe("absent");
  });

  it("a latch holds while any request is pending or denied", () => {
    expect(latchHeld([])).toBe(false);
    expect(latchHeld(["approved"])).toBe(false);
    expect(latchHeld(["approved", "pending"])).toBe(true);
    expect(latchHeld(["denied"])).toBe(true);
  });

  it("still finds a decided latch after approval-needed is removed", () => {
    const q = latchSearchQuery(
      "undone0603/authichain-unified",
      "cold-outreach-resume"
    );
    expect(q).toContain("is:issue");
    expect(q).toContain("is:open");
    expect(q).toContain('in:body "approval-key:cold-outreach-resume"');
    expect(q).not.toContain("label:approval-needed");
  });
});

describe("owner digest", async () => {
  const { buildDigest, summarize } =
    await import("../autonomy/owner-digest.mjs");
  const base = {
    money: null,
    leads7: 2,
    approvals: [],
    alerts: [],
    prs: [],
    setup: [],
  };

  it("stays quiet mid-week with nothing waiting, sends on Mondays", () => {
    expect(
      buildDigest({ ...base, date: "2026-09-23T12:30:00Z" }).shouldSend
    ).toBe(false);
    expect(
      buildDigest({ ...base, date: "2026-09-28T12:30:00Z" }).shouldSend
    ).toBe(true);
  });

  it("sends any day an approval or alert is waiting, and leads with it", () => {
    const d = buildDigest({
      ...base,
      date: "2026-09-23T12:30:00Z",
      approvals: [{ title: "Approval needed: resume outreach", url: "u" }],
    });
    expect(d.shouldSend).toBe(true);
    expect(d.subject).toBe("AuthiChain: 1 thing needs you");
    expect(d.text.split("\n")[0]).toBe("WAITING ON YOU");
  });

  it("excludes founder charges from revenue", () => {
    const m = summarize(
      {
        charges: [
          {
            status: "succeeded",
            paid: true,
            amount: 1000,
            currency: "usd",
            billing_details: { email: "me@x.com" },
          },
          {
            status: "succeeded",
            paid: true,
            amount: 4900,
            currency: "usd",
            billing_details: { email: "buyer@farm.com" },
          },
        ],
      },
      new Set(["me@x.com"])
    );
    expect(m).toMatchObject({ revenue: 4900, payments: 1 });
  });
});

describe("owner digest scoreboard", async () => {
  const {
    buildDigest,
    isRealCheckout,
    hasBuyerEmail,
    campaignCheckouts,
    countReplies,
    failingWorkflows,
    sumVisitors,
  } = await import("../autonomy/owner-digest.mjs");
  const founders = new Set(["me@x.com", "@authichain.com"]);

  it("counts only checkouts a stranger started", () => {
    const real = { livemode: true, customer_details: { email: "b@farm.com" } };
    expect(isRealCheckout(real, founders)).toBe(true);
    expect(isRealCheckout({ ...real, livemode: false }, founders)).toBe(false);
    expect(
      isRealCheckout({ ...real, metadata: { is_demo: "true" } }, founders)
    ).toBe(false);
    expect(
      isRealCheckout(
        { ...real, client_reference_id: "dpp_smoke_1789918869" },
        founders
      )
    ).toBe(false);
    expect(
      isRealCheckout(
        { ...real, metadata: { purpose: "paid_smoke_10" } },
        founders
      )
    ).toBe(false);
    expect(
      isRealCheckout(
        { livemode: true, customer_email: "smoke+dpp@authichain.com" },
        founders
      )
    ).toBe(false);
    expect(
      isRealCheckout({ ...real, metadata: { utm_source: "contest" } }, founders)
    ).toBe(true);
  });

  it("counts a checkout as started only with a real buyer email", () => {
    const live = { livemode: true };
    // no email at all: link previews, scanners, prefetch
    expect(hasBuyerEmail(live)).toBe(false);
    expect(isRealCheckout(live, founders)).toBe(false);
    expect(
      isRealCheckout({ ...live, customer_details: { email: null } }, founders)
    ).toBe(false);
    expect(isRealCheckout({ ...live, customer_email: "   " }, founders)).toBe(
      false
    );
    // walkthrough / fixture emails
    expect(
      isRealCheckout(
        { ...live, customer_details: { email: "walkthrough+1@example.com" } },
        founders
      )
    ).toBe(false);
    expect(
      isRealCheckout({ ...live, customer_email: "QA@Example.COM" }, founders)
    ).toBe(false);
    // our own domain, even when not in the founders list
    expect(
      isRealCheckout(
        { ...live, customer_email: "ops@authichain.com" },
        new Set()
      )
    ).toBe(false);
    expect(hasBuyerEmail({ customer_email: "x@mail.authichain.com" })).toBe(
      false
    );
    // real buyers, from either field
    expect(
      isRealCheckout(
        { ...live, customer_details: { email: "buyer@farm.com" } },
        founders
      )
    ).toBe(true);
    expect(
      isRealCheckout(
        {
          ...live,
          customer_details: { email: null },
          customer_email: "buyer@ebike.eu",
        },
        founders
      )
    ).toBe(true);
    // lookalike domains are still buyers
    expect(hasBuyerEmail({ customer_email: "a@notexample.com" })).toBe(true);
    expect(hasBuyerEmail({ customer_email: "a@authichain.com.au" })).toBe(true);
    // count over a batch like the Sep 20-25 sample
    const batch = [
      live,
      live,
      { ...live, customer_email: "t@example.com" },
      { ...live, customer_email: "z@authichain.com" },
      { ...live, customer_details: { email: "real@brand.co" } },
    ];
    expect(batch.filter(s => isRealCheckout(s, new Set())).length).toBe(1);
  });

  it("counts outside Re: emails inside the window", () => {
    const since = Date.parse("2026-09-16T00:00:00Z");
    const mail = [
      {
        subject: "Re: pilot",
        from: "Kalee <k@trulieve.com>",
        created_at: "2026-09-20T00:00:00Z",
      },
      {
        subject: "Re: pilot",
        from: "me@x.com",
        created_at: "2026-09-20T00:00:00Z",
      },
      {
        subject: "Invoice",
        from: "billing@v.com",
        created_at: "2026-09-20T00:00:00Z",
      },
      {
        subject: "RE: old",
        from: "a@b.com",
        created_at: "2026-09-01T00:00:00Z",
      },
    ];
    expect(countReplies(mail, founders, since)).toBe(1);
  });

  it("lists only enabled workflows whose latest run failed", () => {
    const manifest = {
      lanes: {
        ship: { workflows: { "ci.yml": "on", "old.yml": "off" } },
        growth: { workflows: { "agentz.yml": "on" } },
      },
    };
    const runs = [
      {
        path: ".github/workflows/agentz.yml",
        name: "AgentZ",
        conclusion: "failure",
        html_url: "u1",
      },
      {
        path: ".github/workflows/agentz.yml",
        name: "AgentZ",
        conclusion: "success",
      },
      { path: ".github/workflows/ci.yml", name: "CI", conclusion: "success" },
      { path: ".github/workflows/old.yml", name: "Old", conclusion: "failure" },
    ];
    expect(failingWorkflows(runs, manifest)).toEqual([
      { title: "AgentZ", url: "u1" },
    ]);
  });

  it("counts real checkouts per tracked campaign, zero when quiet", () => {
    const s = (campaign, extra = {}) => ({
      livemode: true,
      customer_details: { email: "buyer@ebike.eu" },
      metadata: { utm_campaign: campaign },
      ...extra,
    });
    expect(
      campaignCheckouts(
        [
          s("battery-passport"),
          s("battery-passport", { payment_status: "paid" }),
          s("battery-passport", { livemode: false }),
          s("battery-passport", {
            customer_details: { email: "me@x.com" },
          }),
          s("other-page", { payment_status: "paid" }),
          { livemode: true, metadata: {} },
        ],
        founders
      )
    ).toEqual({ "battery-passport": { started: 2, paid: 1 } });
    expect(campaignCheckouts([], founders)).toEqual({
      "battery-passport": { started: 0, paid: 0 },
    });
  });

  it("renders all five numbers, and 'not connected' instead of zero", () => {
    expect(
      sumVisitors([{ uniq: { uniques: 3 } }, { uniq: { uniques: 4 } }])
    ).toBe(7);
    const base = {
      date: "2026-09-28T12:30:00Z",
      money: { revenue: 4900, payments: 1, mrr: 0, subs: 0, abandoned: 0 },
      leads7: 0,
      approvals: [],
      alerts: [],
      prs: [],
      setup: [],
    };
    const full = buildDigest({
      ...base,
      board: {
        visitors: 120,
        checkouts: 2,
        campaigns: { "battery-passport": { started: 1, paid: 0 } },
        starterFunnel: {
          views: 25,
          unauthenticated: 4,
          sessions: 2,
          abandoned: 1,
          purchases: 1,
        },
        checkoutWebhookFailures: 0,
        replies: 1,
        failing: [{ title: "AgentZ", url: "u" }],
      },
    }).text;
    expect(full).toContain("SCOREBOARD, LAST 7 DAYS");
    expect(full).toContain("Unique visitors: 120");
    expect(full).toContain("Checkouts started by real visitors: 2");
    expect(full).toContain(
      "battery-passport page: 1 checkouts started, 0 paid"
    );
    expect(full).toContain(
      "QRON Starter funnel, last 7 days: 25 views, 4 unauthenticated attempts, 2 checkout sessions, 1 abandoned, 1 non-founder fulfilled purchase"
    );
    expect(full).toContain("Checkout webhook failures, last 7 days: 0");
    expect(full).toContain("Paid by customers: $49.00");
    expect(full).toContain("Replies received: 1");
    expect(full).toContain("Systems failing: 1");
    const empty = buildDigest({ ...base, money: null }).text;
    expect(empty).toContain("Unique visitors: not connected");
    expect(empty).toContain("Paid by customers: not connected");
    expect(empty).toContain("battery-passport page: not connected");
    expect(empty).toContain("QRON Starter funnel events: not connected");
    expect(empty).toContain("Checkout webhook failures: not connected");
    expect(empty).toContain("Systems failing: not connected");
  });
});

describe("stripe webhook reconcile", async () => {
  const { planEndpoint } = await import("../autonomy/stripe-webhooks.mjs");
  const declared = {
    id: "we_1",
    url: "https://authichain.com/api/stripe/webhook",
    ensure_events: ["checkout.session.expired"],
  };
  const live = {
    id: "we_1",
    url: declared.url,
    status: "enabled",
    enabled_events: ["checkout.session.completed"],
  };

  it("adds only missing declared events", () => {
    expect(planEndpoint(declared, live)).toEqual({
      missing: ["checkout.session.expired"],
    });
    expect(
      planEndpoint(declared, {
        ...live,
        enabled_events: ["checkout.session.expired"],
      })
    ).toEqual({ missing: [] });
    expect(planEndpoint(declared, { ...live, enabled_events: ["*"] })).toEqual({
      missing: [],
    });
  });

  it("refuses a URL mismatch, a disabled endpoint, or a missing one", () => {
    expect(
      planEndpoint(declared, { ...live, url: "https://evil.example/hook" })
        .error
    ).toMatch(/points at/);
    expect(
      planEndpoint(declared, { ...live, status: "disabled" }).error
    ).toMatch(/disabled/);
    expect(planEndpoint(declared, null).error).toMatch(/not found/);
  });

  it("the manifest declares the authichain.com endpoint", () => {
    const hooks = loadManifest().stripe_webhooks;
    expect(hooks[0]).toMatchObject({
      url: "https://authichain.com/api/stripe/webhook",
      ensure_events: [
        "checkout.session.completed",
        "checkout.session.expired",
        "invoice.paid",
        "invoice.payment_failed",
        "invoice.voided",
        "charge.refunded",
        "customer.subscription.deleted",
        "customer.subscription.updated",
        "customer.subscription.trial_will_end",
      ],
    });
  });
});
