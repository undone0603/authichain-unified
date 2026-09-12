#!/usr/bin/env node
/**
 * Continuous outreach tick (research → gate → enqueue → optional run).
 *
 * Intended for systemd daily timer. Worker hourly cron still owns send/reply/follow-up.
 *
 * Usage:
 *   CRON_SECRET=... node scripts/dpp-outreach/daily-tick.mjs
 *   CRON_SECRET=... RUN_CYCLE=1 node scripts/dpp-outreach/daily-tick.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const node = process.execPath;
const secret = process.env.CRON_SECRET;
const base = process.env.OUTREACH_WORKER_URL || 'https://authichain.undone-k.workers.dev';

if (!secret) {
  console.error('CRON_SECRET required');
  process.exit(1);
}

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
  const res = await fetch(`${base}/admin/outreach/status`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  return res.json();
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
const promote = run('promote-and-enqueue.mjs');
const st = await status();
const cycle = await maybeRunCycle();

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
