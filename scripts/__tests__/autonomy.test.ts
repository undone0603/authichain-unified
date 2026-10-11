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
      "content-routine-pr.yml",
      "b2b-outreach.yml",
      "content-publish.yml",
      "gov-mint.yml",
      "marketing-autonomous.yml",
      "pipeline-tick.yml",
    ]) {
      expect([f, desired.get(f)]).toEqual([f, "off"]);
    }
    // autonomy-reconcile.yml is intentionally on (merge_autopilot enabled)
    expect(desired.get("autonomy-reconcile.yml")).toBe("on");
  });
});
