/**
 * Hourly cron fan-out.
 *
 * The fault being guarded: ten jobs, five cron triggers available account-wide.
 * The dispatcher trades ten triggers for one hourly tick plus a schedule check,
 * which only works if the check is right — a wrong hour means a job silently
 * never runs, and nothing downstream would notice for a long time.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertDispatchable,
  CLEARED_JOBS,
  DISPATCH_CRON,
  dispatch,
  dueJobs,
  matchesCron,
  createScheduledHandler,
} from "./cron-dispatch.ts";

const utc = (iso: string) => new Date(iso);

test("matchesCron handles the field syntax GROUP A uses", () => {
  assert.equal(matchesCron("0 3 * * *", utc("2026-09-18T03:00:00Z")), true);
  assert.equal(matchesCron("0 3 * * *", utc("2026-09-18T04:00:00Z")), false);
  // */6 → 0, 6, 12, 18
  for (const h of [0, 6, 12, 18]) {
    assert.equal(matchesCron("0 */6 * * *", utc(`2026-09-18T${String(h).padStart(2, "0")}:00:00Z`)), true);
  }
  assert.equal(matchesCron("0 */6 * * *", utc("2026-09-18T07:00:00Z")), false);
  // 2026-09-21 is a Monday.
  assert.equal(matchesCron("0 8 * * 1", utc("2026-09-21T08:00:00Z")), true);
  assert.equal(matchesCron("0 8 * * 1", utc("2026-09-22T08:00:00Z")), false);
});

test("an unsupported cron field throws instead of silently never matching", () => {
  assert.throws(() => matchesCron("0 H * * *", utc("2026-09-18T00:00:00Z")));
  assert.throws(() => matchesCron("0 3 * *", utc("2026-09-18T00:00:00Z")), /5 cron fields/);
});

test("every cleared job is dispatchable from an hourly tick", () => {
  assert.doesNotThrow(() => assertDispatchable());
});

test("a sub-hourly job is rejected rather than silently dropped", () => {
  assert.throws(
    () => assertDispatchable([{ name: "too-often", schedule: "*/2 * * * *", rationale: "test" }]),
    /finer than hourly/,
  );
});

test("each hour fires exactly the jobs due that hour", () => {
  const at = (iso: string) => dueJobs(utc(iso)).map((j) => j.name);
  assert.deepEqual(at("2026-09-18T03:00:00Z"), ["database-cleanup"]);
  assert.deepEqual(at("2026-09-18T05:00:00Z"), ["customer-health-score"]);
  assert.deepEqual(at("2026-09-18T07:00:00Z"), ["certificate-expiry-check"]);
  // 12:00 is both token-metrics and the */6 fraud sweep.
  assert.deepEqual(at("2026-09-18T12:00:00Z"), ["token-metrics", "fraud-detection-sweep"]);
  // 09:00 has nothing cleared — GROUP B's 09:00 jobs are not dispatched here.
  assert.deepEqual(at("2026-09-18T09:00:00Z"), []);
});

test("the weekly digest fires on Monday only", () => {
  // 2026-09-21 Monday, 2026-09-22 Tuesday.
  assert.ok(dueJobs(utc("2026-09-21T08:00:00Z")).some((j) => j.name === "weekly-analytics-digest"));
  assert.ok(!dueJobs(utc("2026-09-22T08:00:00Z")).some((j) => j.name === "weekly-analytics-digest"));
  // dunning-escalation is daily at 08:00 and fires on both.
  for (const d of ["2026-09-21T08:00:00Z", "2026-09-22T08:00:00Z"]) {
    assert.ok(dueJobs(utc(d)).some((j) => j.name === "dunning-escalation"));
  }
});

test("a tick delivered late still fires that hour's jobs", () => {
  // Cloudflare does not guarantee the tick lands exactly on the minute.
  assert.deepEqual(dueJobs(utc("2026-09-18T03:04:37Z")).map((j) => j.name), ["database-cleanup"]);
});

test("one failing job does not cancel the rest of the tick", async () => {
  const ran: string[] = [];
  const result = await dispatch(utc("2026-09-18T12:00:00Z"), async (name) => {
    ran.push(name);
    if (name === "token-metrics") throw new Error("boom");
  });
  assert.deepEqual(ran, ["token-metrics", "fraud-detection-sweep"]);
  assert.deepEqual(result.ran, ["fraud-detection-sweep"]);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].name, "token-metrics");
});

test("the scheduled handler dispatches for the event's scheduled time", async () => {
  const ran: string[] = [];
  const handler = createScheduledHandler(async (name) => { ran.push(name); });
  await handler({ cron: DISPATCH_CRON, scheduledTime: utc("2026-09-18T03:00:00Z").getTime() }, {});
  assert.deepEqual(ran, ["database-cleanup"]);
});

test("waitUntil is used when an execution context is present", async () => {
  const pending: Promise<unknown>[] = [];
  const handler = createScheduledHandler(async () => {});
  await handler(
    { cron: DISPATCH_CRON, scheduledTime: utc("2026-09-18T03:00:00Z").getTime() },
    {},
    { waitUntil: (p) => { pending.push(p); } },
  );
  assert.equal(pending.length, 1, "work should be handed to waitUntil");
  await Promise.all(pending);
});

test("CLEARED_JOBS has not drifted from server/scheduled-jobs.ts", () => {
  // The schedules live in two files by necessity: the registry is Node-side and
  // imports the database, so the Worker cannot read it at runtime. This test is
  // what keeps the copy honest — edit one and it fails here, loudly, instead of
  // a job quietly firing at the wrong hour or never.
  const registryPath = fileURLToPath(new URL("../server/scheduled-jobs.ts", import.meta.url));
  const src = readFileSync(registryPath, "utf8");
  for (const job of CLEARED_JOBS) {
    const pattern = new RegExp(
      `name:\\s*"${job.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?schedule:\\s*"([^"]+)"`,
    );
    const match = src.match(pattern);
    assert.ok(match, `${job.name} is not registered in server/scheduled-jobs.ts`);
    assert.equal(
      match[1],
      job.schedule,
      `${job.name}: registry says "${match[1]}", dispatcher says "${job.schedule}"`,
    );
  }
});

test("the dispatcher covers exactly ten jobs", () => {
  assert.equal(CLEARED_JOBS.length, 10);
  assert.equal(new Set(CLEARED_JOBS.map((j) => j.name)).size, 10, "names must be unique");
});
