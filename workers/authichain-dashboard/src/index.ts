// AuthiChain Command Center — Cloudflare Worker (dashboard.authichain.com)
//
// One screen for running the company hands-off. Every number on it is read
// live from its source; nothing is transcribed. A source that is not wired
// shows "not connected" with the secret to set, never a placeholder figure.
//
//   Money    Stripe (STRIPE_READ_KEY: restricted key, read-only on charges,
//            balance, subscriptions, checkout sessions)
//   Leads    Supabase lead_captures (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//   Loops    .github/autonomy.json + GitHub Actions state (public repo; optional
//            GITHUB_TOKEN raises the rate limit)
//   Sites    live probes
//   Alerts   the open `ops-alert` issue written by ops-pulse.yml
//
// Auth: cookie session from a form POST against env.ACCESS_TOKEN, and the
// hostname sits behind Cloudflare Access. Auto-refreshes every 60 seconds.

interface Env {
  ACCESS_TOKEN: string;
  STRIPE_READ_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  FOUNDER_EMAILS?: string;
}

const COOKIE_NAME = "ac_dash";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours
const DEFAULT_REPO = "undone0603/authichain-unified";

const HTML_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

// ---------------------------------------------------------------- auth

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function sessionCookie(token: string, remove = false): string {
  const value = remove ? "" : token;
  const maxAge = remove ? 0 : COOKIE_MAX_AGE;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

// ---------------------------------------------------------------- helpers

export function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );
}

export function maskEmail(e: string | null | undefined): string {
  if (!e || !e.includes("@")) return "—";
  const [user, domain] = e.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

export function usd(cents: number): string {
  return (
    "$" +
    (cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function ago(
  iso: string | number | null | undefined,
  now = Date.now()
): string {
  if (iso == null) return "—";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 129600) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

const memo = new Map<string, { exp: number; value: unknown }>();
async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = memo.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  const value = await fn();
  memo.set(key, { exp: Date.now() + ttlMs, value });
  return value;
}

async function getJson(
  url: string,
  headers: Record<string, string> = {}
): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "authichain-command-center", ...headers },
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------- sources

export interface Money {
  external30d: number;
  externalCount30d: number;
  founderTests30d: number;
  available: number;
  pending: number;
  activeSubs: number;
  mrr: number;
  openCheckouts7d: number;
  recent: { amount: number; when: number; what: string; external: boolean }[];
}

export function summarizeMoney(
  charges: any[],
  balance: any,
  subs: any[],
  sessions: any[],
  founderEmails: string[]
): Money {
  const founders = new Set(
    founderEmails.map(e => e.trim().toLowerCase()).filter(Boolean)
  );
  const paid = charges.filter(
    c => c.status === "succeeded" && c.paid && !c.refunded
  );
  // Founder entries are exact emails or "@domain" (covers smoke+x@ aliases).
  const isExternal = (c: any) => {
    const e = String(
      c.billing_details?.email ?? c.receipt_email ?? ""
    ).toLowerCase();
    const at = e.lastIndexOf("@");
    return !(founders.has(e) || (at >= 0 && founders.has(e.slice(at))));
  };
  const ext = paid.filter(isExternal);
  const sumUsd = (arr: any[]) =>
    arr.reduce(
      (n, x) =>
        n + (x.currency === "usd" ? x.amount - (x.amount_refunded ?? 0) : 0),
      0
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
  const pick = (arr: any[]) =>
    arr.filter(b => b.currency === "usd").reduce((n, b) => n + b.amount, 0);
  return {
    external30d: sumUsd(ext),
    externalCount30d: ext.length,
    founderTests30d: paid.length - ext.length,
    available: pick(balance?.available ?? []),
    pending: pick(balance?.pending ?? []),
    activeSubs: subs.length,
    mrr: Math.round(mrr),
    openCheckouts7d: sessions.filter(
      s =>
        s.status === "open" ||
        (s.status === "expired" && s.payment_status === "unpaid")
    ).length,
    recent: paid.slice(0, 6).map(c => ({
      amount: c.amount,
      when: c.created * 1000,
      what: c.description || "payment",
      external: isExternal(c),
    })),
  };
}

async function money(env: Env): Promise<Result<Money>> {
  if (!env.STRIPE_READ_KEY)
    return {
      ok: false,
      reason: "Set the STRIPE_READ_KEY secret (restricted key, read-only).",
    };
  try {
    return await cached("money", 60_000, async () => {
      const h = { Authorization: `Bearer ${env.STRIPE_READ_KEY}` };
      const now = Math.floor(Date.now() / 1000);
      const base = "https://api.stripe.com/v1";
      const [ch, bal, subs, cs] = await Promise.all([
        getJson(
          `${base}/charges?limit=100&created[gte]=${now - 30 * 86400}`,
          h
        ),
        getJson(`${base}/balance`, h),
        getJson(`${base}/subscriptions?status=active&limit=100`, h),
        getJson(
          `${base}/checkout/sessions?limit=100&created[gte]=${now - 7 * 86400}`,
          h
        ),
      ]);
      const founders = (env.FOUNDER_EMAILS ?? "").split(",");
      return {
        ok: true as const,
        data: summarizeMoney(
          ch.data ?? [],
          bal,
          subs.data ?? [],
          cs.data ?? [],
          founders
        ),
      };
    });
  } catch (e) {
    return { ok: false, reason: `Stripe unreachable: ${(e as Error).message}` };
  }
}

interface Leads {
  last7: number;
  last30: number;
  recent: { email: string; source: string; at: string }[];
}

async function leads(env: Env): Promise<Result<Leads>> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return {
      ok: false,
      reason: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets.",
    };
  try {
    return await cached("leads", 60_000, async () => {
      const h = {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      };
      const count = async (days: number) => {
        const since = new Date(Date.now() - days * 86400_000).toISOString();
        const res = await fetch(
          `${env.SUPABASE_URL}/rest/v1/lead_captures?select=id&created_at=gte.${since}`,
          {
            method: "HEAD",
            headers: { ...h, Prefer: "count=exact" },
          }
        );
        if (!res.ok) throw new Error(`supabase ${res.status}`);
        return (
          Number((res.headers.get("content-range") ?? "*/0").split("/")[1]) || 0
        );
      };
      const [last7, last30, rows] = await Promise.all([
        count(7),
        count(30),
        getJson(
          `${env.SUPABASE_URL}/rest/v1/lead_captures?select=email,source,created_at&order=created_at.desc&limit=6`,
          h
        ),
      ]);
      return {
        ok: true as const,
        data: {
          last7,
          last30,
          recent: (rows as any[]).map(r => ({
            email: maskEmail(r.email),
            source: r.source ?? "—",
            at: r.created_at,
          })),
        },
      };
    });
  } catch (e) {
    return {
      ok: false,
      reason: `Supabase unreachable: ${(e as Error).message}`,
    };
  }
}

export interface LoopRow {
  file: string;
  lane: string;
  desired: string;
  state: string;
  conclusion: string | null;
  at: string | null;
  url: string | null;
}
interface Loops {
  rows: LoopRow[];
  coldOutreach: { enabled: boolean; cap: number };
  alert: { url: string; body: string; at: string } | null;
  ship: { conclusion: string | null; at: string | null };
}

export function joinLoops(
  manifest: any,
  workflows: any[],
  runs: any[]
): LoopRow[] {
  const state = new Map(
    workflows.map(w => [String(w.path).split("/").pop(), w.state])
  );
  const latest = new Map<string, any>();
  for (const r of runs) {
    const f = String(r.path ?? "")
      .split("/")
      .pop()!
      .split("@")[0];
    if (r.status === "completed" && !latest.has(f)) latest.set(f, r);
  }
  const rows: LoopRow[] = [];
  for (const [lane, def] of Object.entries<any>(manifest.lanes ?? {})) {
    if (!def.managed || lane === "ship") continue;
    for (const [file, desired] of Object.entries<string>(def.workflows ?? {})) {
      const r = latest.get(file);
      rows.push({
        file,
        lane,
        desired,
        state: state.get(file) ?? "unregistered",
        conclusion: r?.conclusion ?? null,
        at: r?.updated_at ?? null,
        url: r?.html_url ?? null,
      });
    }
  }
  return rows;
}

async function loops(env: Env): Promise<Result<Loops>> {
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  try {
    // Unauthenticated GitHub allows 60 requests/hour; 4 calls per 5 minutes stays under it.
    return await cached(
      "loops",
      env.GITHUB_TOKEN ? 60_000 : 300_000,
      async () => {
        const [manifest, wf, runs, issues] = await Promise.all([
          getJson(
            `https://raw.githubusercontent.com/${repo}/main/.github/autonomy.json`
          ),
          getJson(
            `https://api.github.com/repos/${repo}/actions/workflows?per_page=100`,
            h
          ),
          getJson(
            `https://api.github.com/repos/${repo}/actions/runs?branch=main&per_page=100`,
            h
          ),
          getJson(
            `https://api.github.com/repos/${repo}/issues?state=open&labels=ops-alert&per_page=1`,
            h
          ),
        ]);
        const allRuns = runs.workflow_runs ?? [];
        const shipRun = allRuns.find(
          (r: any) =>
            String(r.path).endsWith("/main.yml") && r.status === "completed"
        );
        const alert = (issues as any[])[0];
        return {
          ok: true as const,
          data: {
            rows: joinLoops(manifest, wf.workflows ?? [], allRuns),
            coldOutreach: {
              enabled: manifest.cold_outreach?.enabled === true,
              cap: manifest.cold_outreach?.max_new_prospects_per_day ?? 0,
            },
            alert: alert
              ? {
                  url: alert.html_url,
                  body: String(alert.body ?? "").split("<!--")[0],
                  at: alert.updated_at,
                }
              : null,
            ship: {
              conclusion: shipRun?.conclusion ?? null,
              at: shipRun?.updated_at ?? null,
            },
          },
        };
      }
    );
  } catch (e) {
    return {
      ok: false,
      reason: `GitHub unreachable: ${(e as Error).message}${env.GITHUB_TOKEN ? "" : " (set GITHUB_TOKEN to lift the rate limit)"}`,
    };
  }
}

const PROBES = [
  ["authichain.com", "https://authichain.com/", 200],
  ["pricing", "https://authichain.com/pricing", 200],
  ["API health", "https://authichain.com/api/health", 200],
  ["qron.space", "https://qron.space/", 200],
  ["strainchain.io", "https://strainchain.io/", 200],
  ["govchain.us", "https://govchain.us/", 200],
] as const;

interface Probe {
  name: string;
  url: string;
  status: number;
  ms: number;
  ok: boolean;
}
async function sites(): Promise<Probe[]> {
  return cached("sites", 60_000, () =>
    Promise.all(
      PROBES.map(async ([name, url, want]) => {
        const t0 = Date.now();
        try {
          const r = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(8000),
            cf: { cacheTtl: 0 },
          } as RequestInit);
          return {
            name,
            url,
            status: r.status,
            ms: Date.now() - t0,
            ok: r.status === want,
          };
        } catch {
          return { name, url, status: 0, ms: Date.now() - t0, ok: false };
        }
      })
    )
  );
}

// ---------------------------------------------------------------- render

const dot = (tone: "ok" | "bad" | "off" | "warn") =>
  `<span class="dot ${tone}" aria-hidden="true"></span>`;

function notConnected(title: string, reason: string) {
  return `<section class="card"><h2>${esc(title)}</h2><p class="muted">Not connected. ${esc(reason)}</p></section>`;
}

function renderMoney(r: Result<Money>) {
  if (!r.ok) return notConnected("Money", r.reason);
  const m = r.data;
  const first = m.externalCount30d === 0;
  return `<section class="card span2"><h2>Money <span class="muted small">Stripe live, last 30 days</span></h2>
  <div class="kpis">
    <div class="kpi"><div class="k">Customer revenue</div><div class="v">${usd(m.external30d)}</div><div class="s">${m.externalCount30d} payment${m.externalCount30d === 1 ? "" : "s"} from customers${m.founderTests30d ? ` · ${m.founderTests30d} founder test${m.founderTests30d === 1 ? "" : "s"} excluded` : ""}</div></div>
    <div class="kpi"><div class="k">MRR</div><div class="v">${usd(m.mrr)}</div><div class="s">${m.activeSubs} active subscription${m.activeSubs === 1 ? "" : "s"}</div></div>
    <div class="kpi"><div class="k">Open or abandoned checkouts</div><div class="v">${m.openCheckouts7d}</div><div class="s">last 7 days</div></div>
    <div class="kpi"><div class="k">Balance</div><div class="v">${usd(m.available)}</div><div class="s">${usd(m.pending)} pending</div></div>
  </div>
  ${first ? '<p class="callout">No customer payment yet. The first one is the goal every loop serves.</p>' : ""}
  ${
    m.recent.length
      ? `<table><thead><tr><th>When</th><th>Amount</th><th>What</th><th>Who</th></tr></thead><tbody>${m.recent
          .map(
            c =>
              `<tr><td>${ago(c.when)}</td><td class="num">${usd(c.amount)}</td><td>${esc(c.what)}</td><td>${c.external ? "customer" : '<span class="muted">founder test</span>'}</td></tr>`
          )
          .join("")}</tbody></table>`
      : ""
  }
  </section>`;
}

function renderLeads(r: Result<Leads>) {
  if (!r.ok) return notConnected("Leads", r.reason);
  const l = r.data;
  return `<section class="card"><h2>Leads <span class="muted small">lead_captures</span></h2>
  <div class="kpis two"><div class="kpi"><div class="k">7 days</div><div class="v">${l.last7}</div></div><div class="kpi"><div class="k">30 days</div><div class="v">${l.last30}</div></div></div>
  ${l.recent.length ? `<ul class="list">${l.recent.map(x => `<li><span>${esc(x.email)}</span><span class="muted">${esc(x.source)} · ${ago(x.at)}</span></li>`).join("")}</ul>` : '<p class="muted">No leads captured yet.</p>'}
  </section>`;
}

function loopTone(r: LoopRow): "ok" | "bad" | "off" | "warn" {
  if (r.desired === "off") return "off";
  if (r.state !== "active") return "warn";
  if (
    r.conclusion &&
    ["failure", "timed_out", "startup_failure"].includes(r.conclusion)
  )
    return "bad";
  return "ok";
}

const LANE_TITLES: Record<string, string> = {
  health: "Health",
  revenue: "Revenue",
  growth: "Growth",
  repair: "Repair",
  retired: "Retired",
};

function renderLoops(r: Result<Loops>) {
  if (!r.ok) return notConnected("Loops", r.reason);
  const { rows, coldOutreach, ship } = r.data;
  const lanes = [...new Set(rows.map(x => x.lane))];
  const shipTone =
    ship.conclusion === "success" ? "ok" : ship.conclusion ? "bad" : "off";
  return `<section class="card span2"><h2>Loops <span class="muted small">from .github/autonomy.json</span></h2>
  <p class="line">${dot(shipTone)} Build and deploy on main: <b>${esc(ship.conclusion ?? "no run yet")}</b> <span class="muted">${ago(ship.at)}</span></p>
  <p class="line">${dot(coldOutreach.enabled ? "ok" : "off")} Cold outreach: <b>${coldOutreach.enabled ? `on, up to ${coldOutreach.cap} a day` : "off"}</b> <span class="muted">switch in autonomy.json; live send also needs OWNER_LIVE_SEND</span></p>
  <div class="lanes">${lanes
    .map(
      lane =>
        `<div class="lane"><h3>${esc(LANE_TITLES[lane] ?? lane)}</h3><ul class="list">${rows
          .filter(x => x.lane === lane)
          .map(x => {
            const t = loopTone(x);
            const label =
              x.desired === "off"
                ? "off"
                : x.state !== "active"
                  ? `should be on (${x.state})`
                  : (x.conclusion ?? "no run yet");
            const name = esc(x.file.replace(/\.ya?ml$/, ""));
            return `<li>${dot(t)}<span class="grow">${x.url ? `<a href="${esc(x.url)}">${name}</a>` : name}</span><span class="muted">${esc(label)} · ${ago(x.at)}</span></li>`;
          })
          .join("")}</ul></div>`
    )
    .join("")}</div></section>`;
}

function renderSites(p: Probe[]) {
  return `<section class="card"><h2>Sites</h2><ul class="list">${p
    .map(
      x =>
        `<li>${dot(x.ok ? "ok" : "bad")}<span class="grow"><a href="${esc(x.url)}">${esc(x.name)}</a></span><span class="muted num">${x.status || "down"} · ${x.ms}ms</span></li>`
    )
    .join("")}</ul></section>`;
}

function renderBanner(l: Result<Loops>, p: Probe[]) {
  const downSites = p.filter(x => !x.ok).length;
  const alert = l.ok ? l.data.alert : null;
  const badLoops = l.ok
    ? l.data.rows.filter(x => ["bad", "warn"].includes(loopTone(x))).length
    : 0;
  if (!alert && !downSites && !badLoops) {
    return `<div class="banner ok">${dot("ok")}<div><b>Nothing needs you.</b> <span class="muted">Sites up, loops green. You'll get a GitHub issue if that changes.</span></div></div>`;
  }
  const parts = [
    downSites && `${downSites} site${downSites > 1 ? "s" : ""} down`,
    badLoops && `${badLoops} loop${badLoops > 1 ? "s" : ""} need attention`,
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="banner bad">${dot("bad")}<div><b>${esc(parts || "Open ops alert")}</b>${alert ? ` · <a href="${esc(alert.url)}">open the alert</a> <span class="muted">updated ${ago(alert.at)}</span>` : ""}</div></div>`;
}

const CSS = `
:root{--bg:#0b0b0c;--card:#131315;--line:#222226;--ink:#e8e6e1;--muted:#8b8a86;--gold:#d4af37;--ok:#3ecf6e;--bad:#ef5b5b;--warn:#e5a33a;--off:#55555a}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f6f5f2;--card:#fff;--line:#e4e2dc;--ink:#1b1a18;--muted:#6d6b66;--gold:#9a7a12;--ok:#1f9d4c;--bad:#c93a3a;--warn:#b7791f;--off:#b5b3ad}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
a{color:inherit;text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px}a:hover{text-decoration-color:var(--gold)}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid var(--line)}
.brand{font-weight:700;letter-spacing:.14em;color:var(--gold)}.brand span{color:var(--muted);font-weight:400;letter-spacing:0;margin-left:10px}
main{max-width:1280px;margin:0 auto;padding:20px 16px 48px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.banner{grid-column:1/-1;display:flex;gap:12px;align-items:center;padding:14px 18px;border-radius:10px;border:1px solid var(--line);background:var(--card)}
.banner.bad{border-color:var(--bad)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;min-width:0}
.span2{grid-column:span 2}
h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;font-weight:600}
h3{font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.small{font-size:11px;letter-spacing:0;text-transform:none;font-weight:400}
.muted{color:var(--muted)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}.kpis.two{grid-template-columns:1fr 1fr}
.kpi{border:1px solid var(--line);border-radius:8px;padding:12px}
.k{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.v{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2;margin-top:4px}
.s{font-size:12px;color:var(--muted);margin-top:2px}
.callout{border-left:3px solid var(--gold);padding:8px 12px;margin:4px 0 12px;color:var(--ink)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:7px 8px;border-top:1px solid var(--line);font-size:13px}th{color:var(--muted);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.num{font-variant-numeric:tabular-nums}
.list{list-style:none}.list li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid var(--line);font-size:13px}.list li:first-child{border-top:0}
.grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lanes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 22px;margin-top:10px}
.line{margin-bottom:6px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none;background:var(--off)}.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}.dot.warn{background:var(--warn)}
.links{display:flex;flex-wrap:wrap;gap:8px}.links a{border:1px solid var(--line);border-radius:6px;padding:6px 10px;text-decoration:none;font-size:12px}.links a:hover{border-color:var(--gold)}
footer{grid-column:1/-1;color:var(--muted);font-size:12px;text-align:center;margin-top:8px}
@media(max-width:980px){main{grid-template-columns:1fr}.span2{grid-column:auto}.kpis{grid-template-columns:1fr 1fr}.lanes{grid-template-columns:1fr}}
`;

export async function renderPage(env: Env): Promise<string> {
  const [m, l, lp, p] = await Promise.all([
    money(env),
    leads(env),
    loops(env),
    sites(),
  ]);
  const repo = esc(env.GITHUB_REPO || DEFAULT_REPO);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AuthiChain Command Center</title><meta http-equiv="refresh" content="60"><style>${CSS}</style></head><body>
<header><div class="brand">AUTHICHAIN<span>Command Center</span></div><a class="muted" href="/logout">Sign out</a></header>
<main>
${renderBanner(lp, p)}
${renderMoney(m)}
${renderLeads(l)}
${renderLoops(lp)}
${renderSites(p)}
<section class="card span2"><h2>Controls</h2><div class="links">
<a href="https://github.com/${repo}/blob/main/.github/autonomy.json">Turn loops on or off</a>
<a href="https://github.com/${repo}/blob/main/docs/OPERATING_CHARTER.md">Operating charter</a>
<a href="https://github.com/${repo}/issues?q=is%3Aopen+label%3Aops-alert">Ops alerts</a>
<a href="https://github.com/${repo}/pulls">Pull requests</a>
<a href="https://github.com/${repo}/actions">Actions</a>
<a href="https://dashboard.stripe.com">Stripe</a>
<a href="https://dash.cloudflare.com">Cloudflare</a>
<a href="https://supabase.com/dashboard/project/nhdnkzhtadfkkluiulhs">Supabase</a>
</div></section>
<footer>Every figure is read live from its source. Refreshes every 60 seconds · ${esc(new Date().toISOString().replace("T", " ").slice(0, 16))} UTC</footer>
</main></body></html>`;
}

// ---------------------------------------------------------------- entry

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const html = (
      body: string,
      status = 200,
      extra: Record<string, string> = {}
    ) =>
      new Response(body, {
        status,
        headers: {
          ...HTML_SECURITY_HEADERS,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          ...extra,
        },
      });

    if (!env.ACCESS_TOKEN)
      return new Response(
        "Dashboard misconfigured: ACCESS_TOKEN secret not set",
        { status: 500 }
      );

    if (url.pathname === "/login" && request.method === "POST") {
      const form = await request.formData();
      const submitted = String(form.get("k") || "");
      if (!timingSafeEqual(submitted, env.ACCESS_TOKEN))
        return html(loginPage(true), 401);
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/",
          "Set-Cookie": sessionCookie(env.ACCESS_TOKEN),
        },
      });
    }
    if (url.pathname === "/logout")
      return html(loginPage(false), 200, {
        "Set-Cookie": sessionCookie("", true),
      });

    const cookie = getCookie(request, COOKIE_NAME);
    if (!cookie || !timingSafeEqual(cookie, env.ACCESS_TOKEN))
      return html(loginPage(false), 401);

    if (url.pathname === "/status.json") {
      const [m, l, lp, p] = await Promise.all([
        money(env),
        leads(env),
        loops(env),
        sites(),
      ]);
      return new Response(
        JSON.stringify(
          {
            at: new Date().toISOString(),
            money: m,
            leads: l,
            loops: lp,
            sites: p,
          },
          null,
          2
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }
    return html(await renderPage(env));
  },
};

function loginPage(error: boolean) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AuthiChain Command Center</title><style>${CSS}
.login{max-width:360px;margin:18vh auto;padding:0 16px;text-align:center}.login p{margin:6px 0 24px}form{display:flex;gap:8px}input{flex:1;min-width:0;padding:11px 14px;background:var(--card);border:1px solid var(--line);border-radius:6px;color:var(--ink);font-size:14px}input:focus{outline:none;border-color:var(--gold)}button{padding:11px 18px;background:var(--gold);color:#111;border:0;border-radius:6px;font-weight:600;cursor:pointer}.err{color:var(--bad);margin-bottom:14px}</style></head>
<body><div class="login"><div class="brand">AUTHICHAIN</div><p class="muted">Command Center</p>${error ? '<div class="err">Invalid access key.</div>' : ""}<form method="POST" action="/login"><input name="k" type="password" placeholder="Access key" autocomplete="current-password" autofocus><button type="submit">Enter</button></form></div></body></html>`;
}
