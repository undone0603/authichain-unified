#!/usr/bin/env node
/**
 * Continuous outreach tick (research → gate → enqueue → optional run).
 *
 * Intended for systemd daily timer. Worker hourly cron still owns send/reply/follow-up.
 *
 * Research always runs. Promoting into the Worker send queue is opt-in
 * (OUTREACH_ENQUEUE=1 + CRON_SECRET): cold outreach stays off unless the
 * owner turns it on (#2412), and a missing or unreachable queue is reported
 * as skipped instead of failing the research run.
 *
 * Usage:
 *   node scripts/dpp-outreach/daily-tick.mjs
 *   OUTREACH_ENQUEUE=1 CRON_SECRET=... node scripts/dpp-outreach/daily-tick.mjs
 *   OUTREACH_ENQUEUE=1 CRON_SECRET=... RUN_CYCLE=1 node scripts/dpp-outreach/daily-tick.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const node = process.execPath;
const secret = process.env.CRON_SECRET;
const base = process.env.OUTREACH_WORKER_URL || 'https://authichain.undone-k.workers.dev';
const enqueue = process.env.OUTREACH_ENQUEUE === '1';

function run(script, extraEnv = {}) {
  const r = spawnSync(node, [path.join(__dirname, script)], {
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    throw new Error(`${script} exited ${r.status}`);
  }
  try {
    return JSON.parse((r.stdout || '').trim().split('\n').filter(Boolean).at(-1) || '{}');
  } catch {
    return {};
  }
}

async function status() {
  try {
    const res = await fetch(`${base}/admin/outreach/status`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return { unavailable: true, http: res.status };
    return await res.json();
  } catch (err) {
    return { unavailable: true, error: String(err?.message || err) };
  }
}

async function maybeRunCycle() {
  if (process.env.RUN_CYCLE !== '1') return { skipped: true };
  const res = await fetch(`${base}/admin/outreach/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });
  return res.json();
}

const research = run('research-dms.mjs');

let promote = { skipped: true, reason: 'OUTREACH_ENQUEUE is not 1' };
let st = { skipped: true };
let cycle = { skipped: true };
if (enqueue && !secret) {
  promote = { skipped: true, reason: 'CRON_SECRET missing' };
} else if (enqueue) {
  st = await status();
  if (st?.unavailable) {
    promote = { skipped: true, reason: 'outreach queue unavailable', queue: st };
  } else {
    promote = run('promote-and-enqueue.mjs');
    st = await status();
    cycle = await maybeRunCycle();
  }
}

const report = {
  ok: true,
  at: new Date().toISOString(),
  research,
  promote,
  status: st?.status
    ? {
        autonomous: st.status.autonomous,
        remainingToday: st.status.remainingToday,
        sentToday: st.status.sentToday,
        cap: st.status.cap,
        queueLength: st.status.queueLength,
        byStatus: st.status.byStatus,
      }
    : st,
  cycle,
};

console.log(JSON.stringify(report, null, 2));
