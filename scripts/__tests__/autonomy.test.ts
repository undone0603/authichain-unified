import { describe, expect, it } from "vitest";
import {
  flatten,
  listWorkflowFiles,
  loadManifest,
  planReconcile,
  validateManifest,
} from "../autonomy/reconcile.mjs";
import { evaluate } from "../autonomy/deliverability-breaker.mjs";
import {
  decideIssueAction,
  evaluateWorkflows,
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

  it("ships with cold outreach switched off", () => {
    expect(loadManifest().cold_outreach.enabled).toBe(false);
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
