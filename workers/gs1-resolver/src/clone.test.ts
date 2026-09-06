import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextStatus,
  scoreBurst,
  regionKey,
  STATUS_COPY,
  DEFAULT_CLONE_CONFIG,
  type ScanEvent,
  type SealStatus,
} from "./clone.ts";

const T0 = 1_800_000_000_000;
const scan = (country: string, minutesAgo: number, region?: string): ScanEvent => ({
  country,
  region,
  at: T0 - minutesAgo * 60_000,
});

test("regionKey normalizes country and region into one bucket", () => {
  assert.equal(regionKey({ country: "de", at: T0 }), "DE");
  assert.equal(regionKey({ country: "us", region: "California", at: T0 }), "US-CALIFORN");
  assert.equal(regionKey({ country: "", at: T0 }), "ZZ", "missing country falls back, not throws");
});

test("scoreBurst only counts scans inside the window", () => {
  const history = [scan("DE", 5), scan("FR", 10), scan("IT", 60 * 24)];
  const burst = scoreBurst(history, T0);
  assert.equal(burst.windowedScans, 2, "the 24h-old scan is outside the 6h window");
  assert.equal(burst.distinctRegions, 2);
});

test("first scan of an issued seal activates it", () => {
  const t = nextStatus("issued", [], scan("DE", 0));
  assert.equal(t.next, "active");
  assert.equal(t.reason, "first_activation");
});

test("a consistent single-region seal stays active", () => {
  const t = nextStatus("active", [scan("DE", 30), scan("DE", 10)], scan("DE", 0));
  assert.equal(t.next, "active");
  assert.equal(t.score, 0);
});

test("three regions in the window raises clone_suspected", () => {
  const history = [scan("DE", 30), scan("FR", 20)];
  const t = nextStatus("active", history, scan("IT", 0));
  assert.equal(t.next, "clone_suspected");
  assert.ok(t.reason.startsWith("multi_region:"));
});

test("five regions escalates to cloned", () => {
  const history = [scan("DE", 40), scan("FR", 30), scan("IT", 20), scan("ES", 10)];
  const t = nextStatus("clone_suspected", history, scan("PL", 0));
  assert.equal(t.next, "cloned");
  assert.ok(t.score > 0.9);
});

test("high scan volume in one region also escalates to cloned", () => {
  const history = Array.from({ length: DEFAULT_CLONE_CONFIG.hardCloneScans }, (_, i) =>
    scan("DE", i),
  );
  const t = nextStatus("active", history, scan("DE", 0));
  assert.equal(t.next, "cloned");
});

test("terminal states are never silently downgraded to authentic", () => {
  for (const terminal of ["revoked", "cloned"] as SealStatus[]) {
    const t = nextStatus(terminal, [scan("DE", 30)], scan("DE", 0));
    assert.equal(t.next, terminal, `${terminal} must stay ${terminal}`);
  }
  assert.equal(nextStatus("not_found", [], scan("DE", 0)).next, "not_found");
});

test("every status carries both a proves and a doesNot claim", () => {
  const statuses: SealStatus[] = [
    "issued",
    "active",
    "clone_suspected",
    "cloned",
    "revoked",
    "not_found",
  ];
  for (const s of statuses) {
    assert.ok(STATUS_COPY[s].proves.length > 0, `${s} missing proves`);
    assert.ok(STATUS_COPY[s].doesNot.length > 0, `${s} missing doesNot`);
  }
  // The absence of a record must never be stated as proof of counterfeit.
  assert.match(STATUS_COPY.not_found.doesNot, /not proof of counterfeit/i);
});
