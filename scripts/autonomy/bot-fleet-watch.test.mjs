import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateFleet,
  fetchFleetRows,
  fleetConfig,
  lookbackHours,
  monitorFleet,
} from "./bot-fleet-watch.mjs";
import { loadManifest } from "./reconcile.mjs";

const NOW = new Date("2026-11-05T06:00:00Z");
const hoursAgo = h => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const manifest = {
  bot_fleet: {
    bots: ["ai-adapt-research", "chief-of-staff", "independent-checker"],
    silence_hours: 36,
    heartbeat_bot: "ai-adapt-heartbeat",
    heartbeat_lookback_hours: 7,
  },
};
const config = fleetConfig(manifest);

test("fleetConfig returns null without a bot list and applies defaults", () => {
  assert.equal(fleetConfig({}), null);
  assert.equal(fleetConfig({ bot_fleet: { bots: [] } }), null);
  const c = fleetConfig({ bot_fleet: { bots: ["b", "a", "a"] } });
  assert.deepEqual(c.bots, ["a", "b"]);
  assert.equal(c.silenceHours, 36);
  assert.equal(c.heartbeatLookbackHours, 7);
  assert.equal(lookbackHours(c), 36);
});

test("a fleet that ran recently, in any status, is green", () => {
  const rows = [
    { bot: "ai-adapt-research", run_at: hoursAgo(2), status: "ok" },
    { bot: "chief-of-staff", run_at: hoursAgo(20), status: "warn" },
    { bot: "independent-checker", run_at: hoursAgo(35), status: "fail" },
  ];
  assert.deepEqual(evaluateFleet(config, rows, NOW), []);
});

test("a bot silent past the limit, or never seen, is red", () => {
  const rows = [
    { bot: "ai-adapt-research", run_at: hoursAgo(2), status: "ok" },
    { bot: "chief-of-staff", run_at: hoursAgo(37), status: "ok" },
  ];
  const problems = evaluateFleet(config, rows, NOW);
  assert.deepEqual(
    problems.map(p => `${p.bot}:${p.kind}`),
    ["chief-of-staff:silent", "independent-checker:silent"]
  );
  assert.match(problems[0].detail, /37h ago/);
  assert.match(problems[1].detail, /no ops_bot_log run/);
});

test("the whole fleet going quiet (Oct 9-13 outage shape) reports every bot", () => {
  assert.equal(evaluateFleet(config, [], NOW).length, 3);
});

test("a recent heartbeat fail row is red; an old one or an ok row is not", () => {
  const base = config.bots.map(bot => ({
    bot,
    run_at: hoursAgo(1),
    status: "ok",
  }));
  const fired = evaluateFleet(
    config,
    [
      ...base,
      { bot: "ai-adapt-heartbeat", run_at: hoursAgo(3), status: "fail" },
    ],
    NOW
  );
  assert.deepEqual(
    fired.map(p => p.kind),
    ["heartbeat"]
  );
  assert.deepEqual(
    evaluateFleet(
      config,
      [
        ...base,
        { bot: "ai-adapt-heartbeat", run_at: hoursAgo(8), status: "fail" },
      ],
      NOW
    ),
    []
  );
  assert.deepEqual(
    evaluateFleet(
      config,
      [
        ...base,
        { bot: "ai-adapt-heartbeat", run_at: hoursAgo(1), status: "ok" },
      ],
      NOW
    ),
    []
  );
});

test("malformed rows are ignored rather than counted as runs", () => {
  const problems = evaluateFleet(
    config,
    [{ bot: "chief-of-staff", run_at: "not a date" }, null, {}],
    NOW
  );
  assert.equal(problems.length, 3);
});

test("fetchFleetRows queries PostgREST read-only with the lookback window", async () => {
  let seen;
  const rows = await fetchFleetRows({
    supabaseUrl: "https://x.supabase.co/",
    supabaseKey: "k",
    hours: 36,
    now: NOW,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return { ok: true, json: async () => [{ bot: "a" }] };
    },
  });
  assert.deepEqual(rows, [{ bot: "a" }]);
  assert.match(
    seen.url,
    /^https:\/\/x\.supabase\.co\/rest\/v1\/ops_bot_log\?select=bot,run_at,status/
  );
  assert.match(seen.url, new RegExp(encodeURIComponent(hoursAgo(36))));
  assert.equal(seen.init.method, undefined);
  assert.equal(seen.init.headers.apikey, "k");
});

test("monitorFleet fails closed and never leaks error text", async () => {
  const missing = await monitorFleet({ manifest, now: NOW });
  assert.deepEqual(
    missing.problems.map(p => p.kind),
    ["unverified"]
  );

  const http = await monitorFleet({
    manifest,
    supabaseUrl: "https://x.supabase.co",
    supabaseKey: "secret-key",
    now: NOW,
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  assert.equal(http.problems[0].detail, "ops_bot_log read answered HTTP 401");

  const thrown = await monitorFleet({
    manifest,
    supabaseUrl: "https://x.supabase.co",
    supabaseKey: "secret-key",
    now: NOW,
    fetchImpl: async () => {
      throw new Error("ECONNRESET https://x.supabase.co?apikey=secret-key");
    },
  });
  assert.equal(thrown.problems[0].detail, "ops_bot_log read failed");
  assert.doesNotMatch(JSON.stringify(thrown), /secret-key/);
});

test("monitorFleet is a no-op when the manifest has no bot_fleet block", async () => {
  assert.deepEqual(await monitorFleet({ manifest: {} }), {
    configured: false,
    problems: [],
  });
});

test("the real manifest lists the fleet and the pg_cron heartbeat", () => {
  const c = fleetConfig(loadManifest());
  assert.ok(c, "bot_fleet block present in .github/autonomy.json");
  assert.ok(c.bots.includes("ai-adapt-research"));
  assert.ok(c.bots.includes("ai-adapt-archive"));
  assert.equal(c.heartbeatBot, "ai-adapt-heartbeat");
  assert.ok(
    !c.bots.includes(c.heartbeatBot),
    "the heartbeat only logs on failure, so it is not a silence target"
  );
});
