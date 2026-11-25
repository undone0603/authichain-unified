#!/usr/bin/env node
// scripts/autonomy/bot-fleet-watch.mjs
//
// Out-of-band alarm for the scheduled Claude bot fleet (AI Adapt archive v2
// hardening, 2026-10-14). The bots log every run to `public.ops_bot_log`. If
// the whole fleet stops (a usage limit, an outage), no bot inside it can
// report that. This check runs in Loop 1 (`ops-pulse`, GitHub Actions) and
// turns silence into the existing `ops-alert` issue, which GitHub emails to the
// owner. That alert path does not depend on Resend.
//
// Red when:
//   - a bot listed in `.github/autonomy.json` -> `bot_fleet.bots` has no
//     ops_bot_log row in the last `silence_hours` (default 36), or
//   - the pg_cron heartbeat (`bot_fleet.heartbeat_bot`) logged a `fail` row in
//     the last `heartbeat_lookback_hours` (default 7; the cron runs every 6h).
//
// Read-only: one PostgREST GET. Fails closed: if the read is not possible,
// that is reported as its own finding, never as "healthy".
//
// Standalone: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/autonomy/bot-fleet-watch.mjs

import { loadManifest } from "./reconcile.mjs";

const HOUR_MS = 3_600_000;

/** Pure. Normalise the `bot_fleet` manifest block. Returns null when absent. */
export function fleetConfig(manifest) {
  const cfg = manifest?.bot_fleet;
  if (!cfg || !Array.isArray(cfg.bots) || cfg.bots.length === 0) return null;
  return {
    bots: [...new Set(cfg.bots.map(String))].sort(),
    silenceHours:
      Number(cfg.silence_hours) > 0 ? Number(cfg.silence_hours) : 36,
    heartbeatBot: cfg.heartbeat_bot ? String(cfg.heartbeat_bot) : null,
    heartbeatLookbackHours:
      Number(cfg.heartbeat_lookback_hours) > 0
        ? Number(cfg.heartbeat_lookback_hours)
        : 7,
  };
}

/** Pure. How far back the read must go to answer both questions. */
export function lookbackHours(config) {
  return Math.max(config.silenceHours, config.heartbeatLookbackHours);
}

/**
 * Pure. rows: [{bot, run_at, status}] from ops_bot_log, newest first or not.
 * Returns [{bot, kind: "silent"|"heartbeat", detail}] sorted by bot.
 */
export function evaluateFleet(config, rows, now = new Date()) {
  const nowMs = now.getTime();
  const lastSeen = new Map();
  let heartbeatFail = null;
  for (const row of rows ?? []) {
    const at = Date.parse(row?.run_at);
    if (!row?.bot || Number.isNaN(at)) continue;
    if (!lastSeen.has(row.bot) || at > lastSeen.get(row.bot))
      lastSeen.set(row.bot, at);
    if (
      config.heartbeatBot &&
      row.bot === config.heartbeatBot &&
      row.status === "fail" &&
      nowMs - at <= config.heartbeatLookbackHours * HOUR_MS &&
      (!heartbeatFail || at > heartbeatFail)
    )
      heartbeatFail = at;
  }
  const problems = [];
  for (const bot of config.bots) {
    const at = lastSeen.get(bot);
    if (at === undefined || nowMs - at > config.silenceHours * HOUR_MS)
      problems.push({
        bot,
        kind: "silent",
        detail:
          at === undefined
            ? `no ops_bot_log run in the last ${config.silenceHours}h`
            : `last ops_bot_log run ${new Date(at).toISOString()} (${Math.floor((nowMs - at) / HOUR_MS)}h ago, limit ${config.silenceHours}h)`,
      });
  }
  if (heartbeatFail !== null)
    problems.push({
      bot: config.heartbeatBot,
      kind: "heartbeat",
      detail: `pg_cron heartbeat fired at ${new Date(heartbeatFail).toISOString()} (a fleet bot went quiet)`,
    });
  return problems.sort(
    (a, b) => a.bot.localeCompare(b.bot) || a.kind.localeCompare(b.kind)
  );
}

/** Read ops_bot_log rows newer than `hours` through PostgREST. Throws on non-2xx. */
export async function fetchFleetRows({
  supabaseUrl,
  supabaseKey,
  hours,
  now = new Date(),
  fetchImpl = fetch,
}) {
  const since = new Date(now.getTime() - hours * HOUR_MS).toISOString();
  const url =
    `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/ops_bot_log` +
    `?select=bot,run_at,status&run_at=gte.${encodeURIComponent(since)}&order=run_at.desc&limit=5000`;
  const res = await fetchImpl(url, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (!res.ok) throw new Error(`Supabase ops_bot_log -> ${res.status}`);
  return res.json();
}

/**
 * Fail-closed wrapper for ops-pulse. Never puts exception text (which could
 * carry a URL or key) into the public alert issue.
 * Returns {configured, problems}.
 */
export async function monitorFleet({
  manifest,
  supabaseUrl,
  supabaseKey,
  now = new Date(),
  fetchImpl,
} = {}) {
  const config = fleetConfig(manifest);
  if (!config) return { configured: false, problems: [] };
  if (!supabaseUrl || !supabaseKey)
    return {
      configured: true,
      problems: [
        {
          bot: "bot_fleet",
          kind: "unverified",
          detail:
            "Supabase read credentials are missing; fleet silence cannot be checked",
        },
      ],
    };
  try {
    const rows = await fetchFleetRows({
      supabaseUrl,
      supabaseKey,
      hours: lookbackHours(config),
      now,
      fetchImpl,
    });
    return { configured: true, problems: evaluateFleet(config, rows, now) };
  } catch (error) {
    const status = String(error?.message ?? "").match(/-> (\d{3})$/)?.[1];
    return {
      configured: true,
      problems: [
        {
          bot: "bot_fleet",
          kind: "unverified",
          detail: status
            ? `ops_bot_log read answered HTTP ${status}`
            : "ops_bot_log read failed",
        },
      ],
    };
  }
}

async function main() {
  const result = await monitorFleet({
    manifest: loadManifest(),
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!result.configured) {
    console.log("bot_fleet: not configured in .github/autonomy.json");
    return;
  }
  if (!result.problems.length) console.log("bot_fleet: green");
  for (const p of result.problems)
    console.log(`bot_fleet: ${p.kind} ${p.bot}: ${p.detail}`);
  process.exitCode = result.problems.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
