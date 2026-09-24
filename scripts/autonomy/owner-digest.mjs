#!/usr/bin/env node
// scripts/autonomy/owner-digest.mjs
//
// The owner's inbox view of the company. One private email:
//   - Mondays: the weekly numbers (customer revenue, MRR, checkouts, leads)
//   - any day something is waiting on the owner: the list of decisions
// Quiet days send nothing. Email, not an issue, because it carries money.
//
// Env: RESEND_API_KEY, OWNER_EMAIL (falls back to SALES_NOTIFY_EMAIL),
//      DIGEST_FROM (default "AuthiChain Ops <hello@authichain.com>"),
//      STRIPE_READ_KEY|STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      FOUNDER_EMAILS, GITHUB_TOKEN, GITHUB_REPOSITORY,
//      CLOUDFLARE_API_TOKEN (Analytics read) + optional CLOUDFLARE_ZONE_ID,
//      DIGEST_FORCE=true to send regardless of day, DIGEST_DRY_RUN=true to print only.

import { isFounder } from "./revenue-watch.mjs";
import { flatten, loadManifest } from "./reconcile.mjs";

const usd = c =>
  "$" +
  (c / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const esc = s =>
  String(s ?? "").replace(
    /[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );

// One-time setup the owner still owes, as [env flag, text]. The workflow sets
// each flag to "true" once done. Empty now: founder/owner emails live in
// .github/autonomy.json, money falls back to STRIPE_SECRET_KEY, and the app
// Worker writes subscriptions over Supabase REST.
export const SETUP_ITEMS = [];

/** Pure. money inputs are raw Stripe lists; returns summary numbers. */
export function summarize(
  { charges = [], subs = [], sessions = [] },
  founders
) {
  const paid = charges.filter(
    c => c.status === "succeeded" && c.paid && !c.refunded
  );
  const ext = paid.filter(
    c => !isFounder(c.billing_details?.email ?? c.receipt_email, founders)
  );
  const mrr = subs.reduce((n, s) => {
    for (const it of s.items?.data ?? []) {
      const p = it.price ?? {};
      if (p.currency !== "usd" || !p.recurring) continue;
      const per = p.unit_amount * (it.quantity ?? 1);
      const i = p.recurring.interval_count || 1;
      n +=
        p.recurring.interval === "year"
          ? per / (12 * i)
          : p.recurring.interval === "week"
            ? (per * 52) / (12 * i)
            : per / i;
    }
    return n;
  }, 0);
  return {
    revenue: ext.reduce(
      (n, c) =>
        n + (c.currency === "usd" ? c.amount - (c.amount_refunded ?? 0) : 0),
      0
    ),
    payments: ext.length,
    mrr: Math.round(mrr),
    subs: subs.length,
    abandoned: sessions.filter(
      s => s.status === "expired" && s.payment_status === "unpaid"
    ).length,
  };
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
// Five numbers, each null when its source is not connected (shown as such,
// never as zero): unique visitors, real checkout starts, customer revenue,
// replies received, and systems failing. Plus one line per tracked offer page
// (TRACKED_CAMPAIGNS), from the same Stripe checkout sessions.

const SMOKE = /smoke|\be2e\b|\btest\b/i;

/** Pure. A checkout session a stranger started: live, not a demo, smoke test or founder. */
export function isRealCheckout(s, founders) {
  if (s.livemode === false) return false;
  const m = s.metadata ?? {};
  if (m.is_demo === "true") return false;
  const tags = [
    s.client_reference_id,
    m.visit_id,
    m.prospect_id,
    m.purpose,
    m.promo,
    m.utm_source,
  ];
  if (tags.some(t => t && SMOKE.test(String(t)))) return false;
  const email = s.customer_details?.email ?? s.customer_email;
  return !isFounder(email, founders);
}

/** Offer pages whose checkouts are counted on their own scoreboard line. */
export const TRACKED_CAMPAIGNS = ["battery-passport"];

/**
 * Pure. Real checkouts per tracked utm_campaign: {campaign: {started, paid}}.
 * Every tracked campaign is present, so a quiet week reads 0, not missing.
 */
export function campaignCheckouts(
  sessions,
  founders,
  campaigns = TRACKED_CAMPAIGNS
) {
  const out = Object.fromEntries(
    campaigns.map(c => [c, { started: 0, paid: 0 }])
  );
  for (const s of sessions) {
    const row = out[s.metadata?.utm_campaign];
    if (!row || !isRealCheckout(s, founders)) continue;
    row.started += 1;
    if (s.payment_status === "paid") row.paid += 1;
  }
  return out;
}

/** Pure. Received emails that look like replies from someone outside the company. */
export function countReplies(received, founders, since) {
  return received.filter(
    e =>
      /^re:/i.test(String(e.subject ?? "").trim()) &&
      Date.parse(e.created_at) >= since &&
      !isFounder(
        String(e.from ?? "")
          .replace(/^.*</, "")
          .replace(/>.*$/, "")
          .trim(),
        founders
      )
  ).length;
}

/**
 * Pure. Workflows switched "on" in the manifest whose latest completed run on
 * main failed. runs: GitHub workflow runs, newest first.
 */
export function failingWorkflows(runs, manifest) {
  const on = new Set(
    flatten(manifest)
      .filter(r => r.desired === "on")
      .map(r => r.file)
  );
  const seen = new Set();
  const failing = [];
  for (const r of runs) {
    const file = String(r.path ?? "")
      .split("/")
      .pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    if (on.has(file) && r.conclusion === "failure")
      failing.push({ title: r.name ?? file, url: r.html_url ?? "" });
  }
  return failing;
}

/** Pure. Sum of daily unique visitors from Cloudflare httpRequests1dGroups. */
export function sumVisitors(groups) {
  return groups.reduce((n, g) => n + (g?.uniq?.uniques ?? 0), 0);
}

/**
 * Pure. Decide whether to send and render the email.
 * d = {date, money|null, leads7|null, approvals:[{title,url}], alerts:[{title,url}], prs:[{title,url,draft}], setup:[text],
 *      board?: {visitors|null, checkouts|null, campaigns:{[c]:{started,paid}}|null, replies|null, failing:[{title,url}]|null}}
 */
export function buildDigest(d, { force = false } = {}) {
  const waiting = d.approvals.length + d.alerts.length;
  const monday = new Date(d.date).getUTCDay() === 1;
  const shouldSend = force || monday || waiting > 0;
  const subject = waiting
    ? `AuthiChain: ${waiting} thing${waiting > 1 ? "s" : ""} need${waiting > 1 ? "" : "s"} you`
    : `AuthiChain weekly: ${d.money ? `${usd(d.money.revenue)} from customers` : "numbers"}, nothing needs you`;

  const t = [];
  const h = [];
  const section = title => {
    t.push("", title.toUpperCase());
    h.push(
      `<h3 style="margin:22px 0 6px;font:600 12px/1.4 sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9a7a12">${esc(title)}</h3>`
    );
  };
  const item = (text, url) => {
    t.push(`- ${text}${url ? ` ${url}` : ""}`);
    h.push(
      `<li style="margin:4px 0">${url ? `<a href="${esc(url)}">${esc(text)}</a>` : esc(text)}</li>`
    );
  };
  const list = fn => {
    h.push('<ul style="padding-left:18px;margin:0">');
    fn();
    h.push("</ul>");
  };

  section(waiting ? "Waiting on you" : "Waiting on you: nothing");
  if (waiting)
    list(() =>
      [...d.approvals, ...d.alerts].forEach(x => item(x.title, x.url))
    );

  const b = d.board ?? {};
  const n = (v, label) => (v == null ? `${label}: not connected` : null);
  section("Scoreboard, last 7 days");
  list(() => {
    item(
      n(b.visitors, "Unique visitors") ??
        `Unique visitors: ${b.visitors.toLocaleString("en-US")} (sum of daily uniques, Cloudflare)`
    );
    item(
      n(b.checkouts, "Checkouts started") ??
        `Checkouts started by real visitors: ${b.checkouts} (tests and founders excluded)`
    );
    if (b.campaigns == null)
      TRACKED_CAMPAIGNS.forEach(c => item(`${c} page: not connected`));
    else
      Object.entries(b.campaigns).forEach(([c, v]) =>
        item(`${c} page: ${v.started} checkouts started, ${v.paid} paid`)
      );
    item(
      d.money
        ? `Paid by customers: ${usd(d.money.revenue)} (Stripe-confirmed)`
        : "Paid by customers: not connected"
    );
    item(
      n(b.replies, "Replies") ??
        `Replies received: ${b.replies} ("Re:" emails from outside the company; read them before counting them as interest)`
    );
    if (b.failing == null) item("Systems failing: not connected");
    else {
      item(`Systems failing: ${b.failing.length}`);
      b.failing.forEach(f => item(`  ${f.title}`, f.url));
    }
  });

  section("Last 7 days");
  list(() => {
    if (d.money) {
      item(
        `Customer revenue: ${usd(d.money.revenue)} (${d.money.payments} payment${d.money.payments === 1 ? "" : "s"})`
      );
      item(
        `MRR: ${usd(d.money.mrr)} across ${d.money.subs} subscription${d.money.subs === 1 ? "" : "s"}`
      );
      item(`Abandoned checkouts: ${d.money.abandoned}`);
    } else item("Money: not connected (see setup below)");
    item(d.leads7 == null ? "Leads: not connected" : `New leads: ${d.leads7}`);
  });

  const ready = d.prs.filter(p => !p.draft);
  if (ready.length) {
    section(`Pull requests ready for review (${ready.length})`);
    list(() => ready.slice(0, 10).forEach(p => item(p.title, p.url)));
  }
  if (d.setup.length) {
    section("One-time setup still open");
    list(() => d.setup.forEach(s => item(s)));
  }
  t.push(
    "",
    "Command Center: https://dashboard.authichain.com  ·  Switchboard: .github/autonomy.json"
  );
  const html = `<div style="max-width:560px;font:14px/1.55 -apple-system,Segoe UI,sans-serif;color:#1b1a18">${h.join("")}<p style="margin-top:24px;color:#6d6b66;font-size:12px"><a href="https://dashboard.authichain.com">Command Center</a> · Sent by the ops digest. Quiet days send nothing.</p></div>`;
  return { shouldSend, subject, text: t.join("\n").trim(), html };
}

async function getJson(url, headers) {
  const r = await fetch(url, {
    headers: { "User-Agent": "authichain-owner-digest", ...headers },
  });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

async function collect(env) {
  const d = {
    date: new Date().toISOString(),
    money: null,
    leads7: null,
    approvals: [],
    alerts: [],
    prs: [],
    setup: [],
    board: {
      visitors: null,
      checkouts: null,
      campaigns: null,
      replies: null,
      failing: null,
    },
  };
  const manifest = loadManifest();
  const founders = new Set(
    [
      ...(manifest.founder_emails ?? []),
      ...(env.FOUNDER_EMAILS ?? "").split(","),
    ]
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
  );
  const key = env.STRIPE_READ_KEY || env.STRIPE_SECRET_KEY;
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  if (key) {
    try {
      const h = { Authorization: `Bearer ${key}` };
      const [ch, subs, cs] = await Promise.all([
        getJson(
          `https://api.stripe.com/v1/charges?limit=100&created[gte]=${since}`,
          h
        ),
        getJson(
          "https://api.stripe.com/v1/subscriptions?status=active&limit=100",
          h
        ),
        getJson(
          `https://api.stripe.com/v1/checkout/sessions?limit=100&created[gte]=${since}`,
          h
        ),
      ]);
      d.money = summarize(
        { charges: ch.data, subs: subs.data, sessions: cs.data },
        founders
      );
      d.board.checkouts = cs.data.filter(s =>
        isRealCheckout(s, founders)
      ).length;
      d.board.campaigns = campaignCheckouts(cs.data, founders);
    } catch (e) {
      console.log(`money skipped: ${e.message}`);
    }
  }
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const r = await fetch(
        `${env.SUPABASE_URL}/rest/v1/lead_captures?select=id&created_at=gte.${new Date(since * 1000).toISOString()}`,
        {
          method: "HEAD",
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: "count=exact",
          },
        }
      );
      if (r.ok)
        d.leads7 =
          Number((r.headers.get("content-range") ?? "*/0").split("/")[1]) || 0;
    } catch (e) {
      console.log(`leads skipped: ${e.message}`);
    }
  }
  if (env.CLOUDFLARE_API_TOKEN) {
    try {
      const h = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` };
      let zone = env.CLOUDFLARE_ZONE_ID;
      if (!zone) {
        const z = await getJson(
          "https://api.cloudflare.com/client/v4/zones?name=authichain.com",
          h
        );
        zone = z.result?.[0]?.id;
      }
      if (zone) {
        const day = t => new Date(t).toISOString().slice(0, 10);
        const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({
            query:
              "query($zone:String!,$since:Date!,$until:Date!){viewer{zones(filter:{zoneTag:$zone}){httpRequests1dGroups(limit:8,filter:{date_geq:$since,date_lt:$until}){uniq{uniques}}}}}",
            variables: {
              zone,
              since: day(since * 1000),
              until: day(Date.now()),
            },
          }),
        });
        const j = await r.json();
        const groups = j?.data?.viewer?.zones?.[0]?.httpRequests1dGroups;
        if (r.ok && Array.isArray(groups))
          d.board.visitors = sumVisitors(groups);
        else
          console.log(
            `visitors skipped: ${JSON.stringify(j?.errors ?? r.status).slice(0, 200)}`
          );
      }
    } catch (e) {
      console.log(`visitors skipped: ${e.message}`);
    }
  }
  if (env.RESEND_API_KEY) {
    try {
      const rec = await getJson(
        "https://api.resend.com/emails/receiving?limit=100",
        {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
        }
      );
      d.board.replies = countReplies(rec.data ?? [], founders, since * 1000);
    } catch (e) {
      console.log(`replies skipped: ${e.message}`);
    }
  }
  if (env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) {
    try {
      // One request per "on" workflow: the repo-wide run list only covers a
      // few hours, which would miss daily and weekly jobs.
      const gh = {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      };
      const files = flatten(manifest)
        .filter(r => r.desired === "on")
        .map(r => r.file);
      const latest = await Promise.all(
        files.map(f =>
          getJson(
            `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${f}/runs?branch=main&status=completed&per_page=1`,
            gh
          )
            .then(j => j.workflow_runs?.[0])
            .catch(() => undefined)
        )
      );
      d.board.failing = failingWorkflows(latest.filter(Boolean), manifest);
    } catch (e) {
      console.log(`failing workflows skipped: ${e.message}`);
    }
    try {
      const h = {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      };
      const repo = env.GITHUB_REPOSITORY;
      const [appr, alerts, prs] = await Promise.all([
        getJson(
          `https://api.github.com/repos/${repo}/issues?state=open&labels=approval-needed&per_page=20`,
          h
        ),
        getJson(
          `https://api.github.com/repos/${repo}/issues?state=open&labels=ops-alert&per_page=5`,
          h
        ),
        getJson(
          `https://api.github.com/repos/${repo}/pulls?state=open&per_page=30`,
          h
        ),
      ]);
      d.approvals = appr.map(i => ({ title: i.title, url: i.html_url }));
      d.alerts = alerts.map(i => ({ title: i.title, url: i.html_url }));
      d.prs = prs.map(p => ({
        title: p.title,
        url: p.html_url,
        draft: p.draft,
      }));
    } catch (e) {
      // Never let GitHub hide the numbers: say so in the email instead.
      d.alerts.push({
        title: `Could not read GitHub approvals/alerts (${e.message})`,
        url: "",
      });
    }
  }
  d.setup = SETUP_ITEMS.filter(([flag]) => env[flag] === "false").map(
    ([, text]) => text
  );
  return d;
}

async function main() {
  const env = process.env;
  const digest = buildDigest(await collect(env), {
    force: env.DIGEST_FORCE === "true",
  });
  console.log(`${digest.subject}\n\n${digest.text}`);
  if (!digest.shouldSend) return console.log("\nQuiet day: not sending.");
  const to =
    env.OWNER_EMAIL || loadManifest().owner_email || env.SALES_NOTIFY_EMAIL;
  if (env.DIGEST_DRY_RUN === "true" || !env.RESEND_API_KEY || !to) {
    return console.log(
      "\nDry run or missing RESEND_API_KEY / OWNER_EMAIL: not sending."
    );
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.DIGEST_FROM || "AuthiChain Ops <hello@authichain.com>",
      to: [to],
      subject: digest.subject,
      text: digest.text,
      html: digest.html,
    }),
  });
  if (!r.ok)
    throw new Error(
      `Resend send -> ${r.status} ${(await r.text()).slice(0, 200)}`
    );
  console.log("\nDigest sent.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
