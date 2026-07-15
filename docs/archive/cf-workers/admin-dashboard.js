--9b34b152b25098b76d3345caa908c75c311003d30b4781173bab3af5da09
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.ts
var index_default = {
  async fetch(req, env) {
    if (!checkAuth(req, env)) {
      return new Response("auth required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="dashboard"' }
      });
    }
    const url = new URL(req.url);
    if (url.pathname === "/data.json") {
      const data2 = await collect(env);
      return json(data2);
    }
    const data = await collect(env);
    return new Response(renderHtml(data), {
      headers: {
        "content-type": "text/html;charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
function checkAuth(req, env) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return false;
  const decoded = atob(auth.slice(6));
  const [user, pass] = decoded.split(":");
  if (user !== "admin") return false;
  if (!env.DASHBOARD_PASSWORD || pass.length !== env.DASHBOARD_PASSWORD.length) return false;
  let diff = 0;
  for (let i = 0; i < pass.length; i++) diff |= pass.charCodeAt(i) ^ env.DASHBOARD_PASSWORD.charCodeAt(i);
  return diff === 0;
}
__name(checkAuth, "checkAuth");
async function collect(env) {
  const cached = await env.DASHBOARD_CACHE.get("dash:v1", "json");
  if (cached) return { ...cached, stale: false };
  const [mrr, customers, leads, recentLeads, recentEvents] = await Promise.all([
    fetchMrr(env),
    fetchCustomerCount(env),
    fetchLeadsLast7Days(env),
    fetchRecentLeads(env),
    fetchRecentEvents(env)
  ]);
  const data = {
    mrrUsd: mrr,
    customers,
    leadsLast7d: leads,
    recentLeads,
    recentEvents,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    stale: false
  };
  await env.DASHBOARD_CACHE.put("dash:v1", JSON.stringify(data), { expirationTtl: 60 });
  return data;
}
__name(collect, "collect");
async function fetchMrr(env) {
  let total = 0;
  let starting_after;
  for (let i = 0; i < 5; i++) {
    const params = new URLSearchParams({ status: "active", limit: "100", "expand[]": "data.items.data.price" });
    if (starting_after) params.set("starting_after", starting_after);
    const res = await stripeGet(`subscriptions?${params}`, env);
    if (!res?.data) break;
    for (const sub of res.data) {
      for (const item of sub.items?.data ?? []) {
        const price = item.price;
        if (!price?.unit_amount || !price?.recurring) continue;
        const monthly = normalizeToMonthly(price.unit_amount * (item.quantity ?? 1), price.recurring.interval, price.recurring.interval_count ?? 1);
        total += monthly;
      }
    }
    if (!res.has_more) break;
    starting_after = res.data[res.data.length - 1]?.id;
  }
  return total / 100;
}
__name(fetchMrr, "fetchMrr");
function normalizeToMonthly(amountCents, interval, count) {
  switch (interval) {
    case "day":
      return amountCents / count * 30;
    case "week":
      return amountCents / count * 4.333;
    case "month":
      return amountCents / count;
    case "year":
      return amountCents / count / 12;
    default:
      return amountCents;
  }
}
__name(normalizeToMonthly, "normalizeToMonthly");
async function fetchCustomerCount(env) {
  const res = await stripeGet(`customers/search?query=created>0&limit=1`, env);
  return res?.total_count ?? 0;
}
__name(fetchCustomerCount, "fetchCustomerCount");
async function fetchRecentEvents(env) {
  const res = await stripeGet("events?limit=10", env);
  if (!res?.data) return [];
  return res.data.map((e) => ({
    type: e.type,
    created: e.created,
    livemode: e.livemode,
    id: e.id
  }));
}
__name(fetchRecentEvents, "fetchRecentEvents");
async function stripeGet(path, env) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
  });
  return r.ok ? r.json() : null;
}
__name(stripeGet, "stripeGet");
async function fetchLeadsLast7Days(env) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1e3;
  const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: hubspotHeaders(env),
    body: JSON.stringify({
      filterGroups: [{
        filters: [
          { propertyName: "createdate", operator: "GTE", value: String(since) }
        ]
      }],
      limit: 1
    })
  });
  if (!r.ok) return 0;
  const j = await r.json();
  return j.total ?? 0;
}
__name(fetchLeadsLast7Days, "fetchLeadsLast7Days");
async function fetchRecentLeads(env) {
  const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: hubspotHeaders(env),
    body: JSON.stringify({
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      properties: ["email", "firstname", "last_brand_purchased", "lifecyclestage", "createdate"],
      limit: 10
    })
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.results ?? []).map((c) => ({
    email: c.properties.email ?? "",
    firstname: c.properties.firstname ?? "",
    brand: c.properties.last_brand_purchased ?? "",
    lifecycle: c.properties.lifecyclestage ?? "",
    createdAt: c.properties.createdate ?? ""
  }));
}
__name(fetchRecentLeads, "fetchRecentLeads");
function hubspotHeaders(env) {
  return {
    Authorization: `Bearer ${env.HUBSPOT_TOKEN}`,
    "Content-Type": "application/json"
  };
}
__name(hubspotHeaders, "hubspotHeaders");
function json(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json" }
  });
}
__name(json, "json");
function renderHtml(d) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AuthiChain ops</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root{--ink:#0a1628;--paper:#f4f1ea;--rule:#0a1628;--ok:#0f7a4b;--warn:#c08b00;--err:#b03a2e;--soft:rgba(10,22,40,.55)}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:var(--paper);color:var(--ink);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;line-height:1.45}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 24px 96px}
  header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--ink);padding-bottom:16px;margin-bottom:32px}
  h1{font-size:22px;font-weight:700;letter-spacing:-0.02em}
  h1 span{color:var(--soft);font-weight:400}
  .meta{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--soft)}
  .meta a{color:inherit;margin-left:16px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--ink);margin-bottom:32px}
  .stat{padding:24px;border-right:1px solid var(--ink)}
  .stat:last-child{border-right:none}
  .stat .num{font-size:48px;font-weight:300;letter-spacing:-0.04em;line-height:1;margin-bottom:8px;color:var(--ink)}
  .stat .lab{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft)}
  .stat .sub{font-size:11px;color:var(--soft);margin-top:4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:32px}
  section h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(10,22,40,.15)}
  table{width:100%;border-collapse:collapse;font-size:12px}
  td{padding:10px 8px;border-bottom:1px solid rgba(10,22,40,.08);vertical-align:top;word-break:break-all}
  tr:last-child td{border-bottom:none}
  td.r{text-align:right;color:var(--soft);white-space:nowrap}
  .pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;background:rgba(10,22,40,.08)}
  .pill.ok{background:rgba(15,122,75,.15);color:var(--ok)}
  .pill.warn{background:rgba(192,139,0,.15);color:var(--warn)}
  .pill.err{background:rgba(176,58,46,.15);color:var(--err)}
  .empty{padding:24px 8px;color:var(--soft);font-size:12px;font-style:italic}
  footer{margin-top:48px;font-size:11px;color:var(--soft);letter-spacing:.06em}
  @media(max-width:760px){.stats{grid-template-columns:1fr}.stats .stat{border-right:none;border-bottom:1px solid var(--ink)}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>AuthiChain<span> ops</span></h1>
    <div class="meta">
      fetched ${new Date(d.fetchedAt).toLocaleString()}
      <a href="?_=${Date.now()}">refresh</a>
      <a href="/data.json">json</a>
    </div>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="num">${"$" + Math.round(d.mrrUsd).toLocaleString()}</div>
      <div class="lab">MRR</div>
      <div class="sub">${d.mrrUsd > 0 ? "" : "no active subscriptions yet"}</div>
    </div>
    <div class="stat">
      <div class="num">${d.customers.toLocaleString()}</div>
      <div class="lab">Stripe customers</div>
      <div class="sub">all-time</div>
    </div>
    <div class="stat">
      <div class="num">${d.leadsLast7d.toLocaleString()}</div>
      <div class="lab">leads last 7 days</div>
      <div class="sub">HubSpot contacts created</div>
    </div>
  </div>

  <div class="grid">
    <section>
      <h2>Recent leads</h2>
      ${d.recentLeads.length === 0 ? '<div class="empty">No leads yet. Drive traffic to the landing pages.</div>' : `<table>
            ${d.recentLeads.map((l) => `
              <tr>
                <td>
                  <strong>${escapeHtml(l.email)}</strong>
                  ${l.firstname ? `<div style="color:var(--soft);font-size:11px">${escapeHtml(l.firstname)}</div>` : ""}
                </td>
                <td>${l.brand ? `<span class="pill">${escapeHtml(l.brand)}</span>` : ""}</td>
                <td>${l.lifecycle ? `<span class="pill ${l.lifecycle === "customer" ? "ok" : ""}">${escapeHtml(l.lifecycle)}</span>` : ""}</td>
                <td class="r">${formatRelative(l.createdAt)}</td>
              </tr>`).join("")}
          </table>`}
    </section>

    <section>
      <h2>Recent Stripe events</h2>
      ${d.recentEvents.length === 0 ? '<div class="empty">No events yet.</div>' : `<table>
            ${d.recentEvents.map((e) => `
              <tr>
                <td>${escapeHtml(e.type)}</td>
                <td>${e.livemode ? '<span class="pill ok">live</span>' : '<span class="pill warn">test</span>'}</td>
                <td class="r">${formatRelative(new Date(e.created * 1e3).toISOString())}</td>
              </tr>`).join("")}
          </table>`}
    </section>
  </div>

  <footer>
    Cached for 60s. Hit /data.json for the same data as JSON.
  </footer>
</div>
</body>
</html>`;
}
__name(renderHtml, "renderHtml");
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
__name(escapeHtml, "escapeHtml");
function formatRelative(iso) {
  if (!iso) return "";
  const t = typeof iso === "string" ? Date.parse(iso) : iso;
  if (!t) return "";
  const sec = Math.floor((Date.now() - t) / 1e3);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
__name(formatRelative, "formatRelative");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--9b34b152b25098b76d3345caa908c75c311003d30b4781173bab3af5da09--
