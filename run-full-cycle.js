#!/usr/bin/env node
/*
 * run-full-cycle.js — trigger ONE full autonomous business cycle on the
 * deployed app. Hits GET /api/automation/cron, which runs:
 *   runDailyMaintenance() -> AutonomousController.runDailyCycle() -> forced pipeline tick.
 *
 * It runs against the DEPLOYED app (Vercel/Cloudflare), where the secrets live —
 * not locally — so an ephemeral Codespace without a full .env is fine.
 *
 * Safe to run: outreach is held for approval (REQUIRE_OUTREACH_APPROVAL) and no
 * funds move unless PAYOUTS_ENABLED is on and a batch is human-approved.
 *
 * Usage:
 *   node run-full-cycle.js
 *   APP_URL=https://your-app CRON_SECRET=xxx node run-full-cycle.js
 * APP_URL / CRON_SECRET are read from the environment or a local .env if present.
 */
'use strict';
const fs = require('fs');

// Minimal .env loader (does not override already-exported vars).
try {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* no .env — rely on the environment */ }

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://authichain.com').replace(/\/$/, '');
const SECRET = process.env.CRON_SECRET;

if (!SECRET) {
  console.error('✘ CRON_SECRET is not set. Export it or add it to .env, then re-run.');
  console.error('  (CRON_SECRET is the bearer token /api/automation/cron checks.)');
  process.exit(1);
}

const url = `${APP_URL}/api/automation/cron`;
console.log(`▶ Triggering full cycle: GET ${url}`);

fetch(url, { headers: { Authorization: `Bearer ${SECRET}` } })
  .then(async (r) => {
    const text = await r.text();
    console.log(`HTTP ${r.status}`);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text.slice(0, 2000));
    }
    if (r.status === 401) {
      console.error('\n✘ 401 Unauthorized — CRON_SECRET does not match the deployed value.');
    }
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(`✘ Request failed: ${e.message}`);
    console.error('  Check APP_URL points at the live app (currently: ' + APP_URL + ').');
    process.exit(1);
  });
