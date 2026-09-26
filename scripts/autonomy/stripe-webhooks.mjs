#!/usr/bin/env node
// scripts/autonomy/stripe-webhooks.mjs
//
// Keeps Stripe webhook endpoints subscribed to the events declared in
// .github/autonomy.json -> stripe_webhooks. Declaring an event there and
// merging is the owner's approval; this only applies it.
//
// It only ever ADDS missing events to an endpoint whose URL matches the
// manifest. It never removes events, never touches other endpoints, and
// never changes URLs or secrets.
//
// Runs after a successful "Deploy to Cloudflare" on main, so an event is
// re-enabled only once the handler that serves it is live.
//
// Env: STRIPE_SECRET_KEY. --plan prints without writing.

import { appendFileSync } from "node:fs";
import { loadManifest } from "./reconcile.mjs";

/** Pure. Returns {missing, error} for one declared endpoint. */
export function planEndpoint(declared, live) {
  if (!live) return { missing: [], error: `endpoint ${declared.id} not found` };
  if (live.url !== declared.url)
    return {
      missing: [],
      error: `endpoint ${declared.id} points at ${live.url}, manifest says ${declared.url}`,
    };
  if (live.status !== "enabled")
    return {
      missing: [],
      error: `endpoint ${declared.id} is ${live.status}; not re-enabling it`,
    };
  if ((live.enabled_events ?? []).includes("*")) return { missing: [] };
  const have = new Set(live.enabled_events ?? []);
  return { missing: (declared.ensure_events ?? []).filter(e => !have.has(e)) };
}

async function stripe(path, key, { method = "GET", form } = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? form.toString() : undefined,
  });
  const body = await res.json();
  if (!res.ok)
    throw new Error(
      `${method} ${path} -> ${res.status} ${body?.error?.message ?? ""}`
    );
  return body;
}

function say(md) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

async function main(argv) {
  const key = process.env.STRIPE_SECRET_KEY;
  const declared = loadManifest().stripe_webhooks ?? [];
  if (!declared.length) return (say("No stripe_webhooks declared."), 0);
  if (!key) return (say("STRIPE_SECRET_KEY not set: skipping."), 0);
  let failed = 0;
  for (const d of declared) {
    let live = null;
    try {
      live = await stripe(`webhook_endpoints/${d.id}`, key);
    } catch (e) {
      live = null;
    }
    const p = planEndpoint(d, live);
    if (p.error) {
      failed++;
      say(`- ${d.id}: ${p.error}`);
      continue;
    }
    if (!p.missing.length) {
      say(`- ${d.id}: in sync`);
      continue;
    }
    say(
      `- ${d.id}: adding ${p.missing.join(", ")}${argv.includes("--plan") ? " (plan only)" : ""}`
    );
    if (argv.includes("--plan")) continue;
    const form = new URLSearchParams();
    for (const e of [...live.enabled_events, ...p.missing])
      form.append("enabled_events[]", e);
    // Clear the pause note left when the event was removed.
    for (const k of ["paused_at", "paused_event", "paused_reason"])
      if (live.metadata?.[k]) form.append(`metadata[${k}]`, "");
    await stripe(`webhook_endpoints/${d.id}`, key, { method: "POST", form });
  }
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    c => process.exit(c),
    e => {
      console.error(e);
      process.exit(1);
    }
  );
}
