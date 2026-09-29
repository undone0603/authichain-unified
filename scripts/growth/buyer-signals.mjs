#!/usr/bin/env node
// scripts/growth/buyer-signals.mjs
// Weekly, read-only lead finder. Pulls public buying signals, maps each one to
// a live offer, and writes ONE GitHub issue labelled `buyer-signal` holding the
// leads and a draft opener per lead. It never sends anything: every send still
// waits for the owner's go (docs/OPERATING_CHARTER.md).
//
// Sources:
//   ted   EU tenders (TED Search API v3, keyless)          -> dpp_readiness
//   ftc   FTC consumer-protection press releases (RSS)     -> musa_claim_file
//   jobs  Remotive + Arbeitnow public job APIs (keyless)   -> dpp_readiness | musa_claim_file
//   dcc   California cannabis licences (DCA iServices)     -> strainchain_passport
//         Needs DCC_APP_ID + DCC_APP_KEY; skipped without them.

import { appendFileSync } from "node:fs";

export const LABEL = "buyer-signal";
const MARKER = "<!-- buyer-signal-ids:";
const UA = "authichain-buyer-signals/1.0 (+https://authichain.com)";

// Prices are checked against src/lib/plans.ts by the test; do not edit one side only.
// Links go to the selling page, never a raw Payment Link.
export const OFFERS = {
  dpp_readiness: {
    price: 299,
    label: "EU DPP Readiness, $299",
    url: "https://authichain.com/dpp-check",
  },
  musa_claim_file: {
    price: 299,
    label: "Made in USA Claim File, $299 per SKU",
    url: "https://authichain.com/made-in-usa-claim-file",
  },
  strainchain_passport: {
    price: 49,
    label: "StrainChain genetics passport, $49 per cultivar",
    url: "https://strainchain.io/passport",
  },
};

// Anyone who declined or withdrew. Matched against every lead's name and text.
export const EXCLUDED = [/mendo\s*love/i];

export const DPP_TERMS =
  /digital product passport|product passport|battery passport|\bESPR\b|ecodesign|battery regulation|2023\/1542|anti-?counterfeit/i;
export const MUSA_TERMS =
  /made in (the )?u\.?s\.?a?\b|made in america|country[- ]of[- ]origin|domestic content|\busmca\b/i;

// ---------- helpers ----------

export function daysAgo(n, now = new Date()) {
  return new Date(now.getTime() - n * 86_400_000);
}

function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** TED returns strings, arrays, or {lang: value | [value]} maps. */
export function pickText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(pickText).filter(Boolean)[0] ?? "";
  if (typeof v === "object") {
    for (const k of ["eng", "ENG", "en", "EN"])
      if (v[k] != null) return pickText(v[k]);
    const first = Object.values(v)[0];
    return pickText(first);
  }
  return "";
}

function stripHtml(s) {
  // RSS descriptions are often entity-escaped HTML, so decode before stripping.
  return String(s ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function isExcluded(lead) {
  const hay = `${lead.org ?? ""} ${lead.title ?? ""} ${lead.detail ?? ""}`;
  return EXCLUDED.some(re => re.test(hay));
}

async function getJson(url, { fetchImpl = fetch, init = {} } = {}) {
  const res = await fetchImpl(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function getText(url, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return text;
}

// ---------- TED ----------

export const TED_PHRASES = [
  "digital product passport",
  "product passport",
  "battery passport",
  "anti-counterfeiting",
  "product traceability",
];

export function tedQuery(since) {
  const ft = TED_PHRASES.map(p => `FT ~ ("${p}")`).join(" OR ");
  return `(${ft}) AND PD >= ${ymd(since)}`;
}

export function parseTed(data) {
  return (data?.notices ?? []).map(n => {
    const id = pickText(n["publication-number"]);
    const title = pickText(n["notice-title"]);
    return {
      source: "ted",
      id: `ted:${id}`,
      org: pickText(n["buyer-name"]),
      country: pickText(n["buyer-country"]),
      title,
      date: pickText(n["publication-date"]).slice(0, 10),
      deadline: pickText(n["deadline-receipt-tender-date-lot"]).slice(0, 10),
      url: `https://ted.europa.eu/en/notice/-/detail/${id}`,
      offer: "dpp_readiness",
      detail: pickText(n["notice-type"]),
    };
  });
}

export async function fetchTed({ since, fetchImpl } = {}) {
  const data = await getJson("https://api.ted.europa.eu/v3/notices/search", {
    fetchImpl,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: tedQuery(since),
        fields: [
          "publication-number",
          "notice-title",
          "buyer-name",
          "buyer-country",
          "publication-date",
          "deadline-receipt-tender-date-lot",
          "notice-type",
        ],
        limit: 50,
        page: 1,
        scope: "ACTIVE",
        paginationMode: "PAGE_NUMBER",
        checkQuerySyntax: false,
      }),
    },
  });
  return parseTed(data);
}

// ---------- FTC ----------

export const FTC_FEED =
  "https://www.ftc.gov/feeds/press-release-consumer-protection.xml";

export function parseRss(xml) {
  const items = [];
  for (const m of String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const block = m[0];
    const tag = t => {
      const r = block.match(
        new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`, "i")
      );
      return r
        ? stripHtml(r[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
        : "";
    };
    items.push({
      title: tag("title"),
      link: tag("link"),
      date: tag("pubDate"),
      description: tag("description"),
    });
  }
  return items;
}

export function ftcLeads(items, since) {
  return items
    .filter(i => MUSA_TERMS.test(`${i.title} ${i.description}`))
    .filter(i => {
      const t = Date.parse(i.date);
      return Number.isNaN(t) || t >= since.getTime();
    })
    .map(i => ({
      source: "ftc",
      id: `ftc:${i.link || i.title}`,
      org: "FTC action (see release for named companies)",
      title: i.title,
      date: Number.isNaN(Date.parse(i.date))
        ? ""
        : new Date(i.date).toISOString().slice(0, 10),
      url: i.link,
      offer: "musa_claim_file",
      detail: i.description.slice(0, 280),
    }));
}

export async function fetchFtc({ since, fetchImpl } = {}) {
  return ftcLeads(parseRss(await getText(FTC_FEED, { fetchImpl })), since);
}

// ---------- jobs ----------

export const JOB_SEARCHES = [
  "product passport",
  "ESPR",
  "ecodesign",
  "battery regulation",
  "country of origin",
  "made in usa",
];

export function jobLead({ company, title, url, date, text }, source) {
  const hay = `${title} ${text}`;
  const dpp = DPP_TERMS.test(hay);
  const musa = MUSA_TERMS.test(hay);
  if (!dpp && !musa) return null;
  const term = (hay.match(dpp ? DPP_TERMS : MUSA_TERMS) ?? [""])[0];
  return {
    source: "jobs",
    id: `jobs:${url}`,
    org: company,
    title: `Hiring: ${title}`,
    date: date ? String(date).slice(0, 10) : "",
    url,
    offer: dpp ? "dpp_readiness" : "musa_claim_file",
    detail: `Posting mentions "${term}" (${source})`,
  };
}

export function parseRemotive(data) {
  return (data?.jobs ?? [])
    .map(j =>
      jobLead(
        {
          company: j.company_name,
          title: j.title,
          url: j.url,
          date: j.publication_date,
          text: stripHtml(j.description),
        },
        "Remotive"
      )
    )
    .filter(Boolean);
}

export function parseArbeitnow(data) {
  return (data?.data ?? [])
    .map(j =>
      jobLead(
        {
          company: j.company_name,
          title: j.title,
          url: j.url,
          date: j.created_at ? new Date(j.created_at * 1000).toISOString() : "",
          text: stripHtml(j.description),
        },
        "Arbeitnow"
      )
    )
    .filter(Boolean);
}

export async function fetchJobs({ since, fetchImpl } = {}) {
  const leads = [];
  const errors = [];
  for (const q of JOB_SEARCHES) {
    try {
      const d = await getJson(
        `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=50`,
        { fetchImpl }
      );
      leads.push(...parseRemotive(d));
    } catch (e) {
      errors.push(`remotive "${q}": ${e.message}`);
    }
  }
  for (let page = 1; page <= 5; page++) {
    try {
      const d = await getJson(
        `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
        { fetchImpl }
      );
      leads.push(...parseArbeitnow(d));
      if (!d?.links?.next) break;
    } catch (e) {
      errors.push(`arbeitnow p${page}: ${e.message}`);
      break;
    }
  }
  const fresh = leads.filter(
    l => !l.date || Date.parse(l.date) >= since.getTime()
  );
  if (!fresh.length && errors.length === JOB_SEARCHES.length + 1) {
    throw new Error(errors.join("; "));
  }
  return fresh;
}

// ---------- DCC (credential-gated) ----------

export async function fetchDcc({ env = process.env } = {}) {
  if (!env.DCC_APP_ID || !env.DCC_APP_KEY)
    return {
      skipped: "needs DCC_APP_ID and DCC_APP_KEY (free DCA iServices sign-up)",
    };
  // Endpoint and field names are wired once the iServices guide is confirmed
  // against a live response; until then report instead of guessing.
  return { skipped: "credentials present; licence endpoint not wired yet" };
}

// ---------- assemble ----------

export function dedupe(leads, seenIds = new Set()) {
  const out = [];
  const ids = new Set();
  for (const l of leads) {
    if (!l || !l.id || ids.has(l.id) || seenIds.has(l.id) || isExcluded(l))
      continue;
    ids.add(l.id);
    out.push(l);
  }
  return out;
}

export function opener(lead) {
  const o = OFFERS[lead.offer];
  switch (lead.source) {
    case "ted":
      return `Saw ${lead.org || "your"} tender "${lead.title}". If passport readiness is in scope, a written gap map is ${o.label}: ${o.url}`;
    case "ftc":
      return `After "${lead.title}", brands in the same category are checking their own origin claims. One SKU's claim file is ${o.label}: ${o.url}`;
    case "jobs":
      return `Saw ${lead.org} is hiring for "${lead.title.replace(/^Hiring: /, "")}". While the seat is open, ${o.label} covers the first pass: ${o.url}`;
    default:
      return `${o.label}: ${o.url}`;
  }
}

const SOURCE_NAMES = {
  ted: "EU tenders",
  ftc: "Made in USA enforcement",
  jobs: "Hiring signals",
  dcc: "California cannabis licences",
};

export function render(leads, status, weekOf) {
  const lines = [
    `Buyer signals for the week of ${weekOf}. **Drafts only: nothing here has been sent.** Each send needs the owner's go.`,
    "",
    "| Source | Result |",
    "| --- | --- |",
    ...Object.entries(SOURCE_NAMES).map(
      ([k, name]) => `| ${name} | ${status[k] ?? "not run"} |`
    ),
    "",
  ];
  for (const [k, name] of Object.entries(SOURCE_NAMES)) {
    const group = leads.filter(l => l.source === k);
    if (!group.length) continue;
    lines.push(`### ${name}`, "");
    for (const l of group) {
      const bits = [
        l.org,
        l.country,
        l.date && `published ${l.date}`,
        l.deadline && `deadline ${l.deadline}`,
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(`- **[${l.title}](${l.url})**${bits ? ` (${bits})` : ""}`);
      lines.push(`  - Offer: ${OFFERS[l.offer].label}`);
      lines.push(`  - Draft opener: ${opener(l)}`);
    }
    lines.push("");
  }
  if (!leads.length) lines.push("No new signals this week.");
  return lines.join("\n");
}

export function idsFromBody(body) {
  const raw =
    String(body ?? "")
      .split(MARKER)[1]
      ?.split(" -->")[0] ?? "";
  return raw ? raw.split("\n").filter(Boolean) : [];
}

export function withMarker(md, leads) {
  return `${md}\n\n${MARKER}${leads.map(l => l.id).join("\n")} -->`;
}

// ---------- GitHub ----------

async function gh(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": UA,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(
      `${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`
    );
  return res.status === 204 ? null : res.json();
}

function out(md) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

export async function collect({
  now = new Date(),
  windowDays = 8,
  fetchImpl,
  env = process.env,
} = {}) {
  const since = daysAgo(windowDays, now);
  const status = {};
  const leads = [];
  const run = async (key, fn) => {
    try {
      const got = await fn();
      leads.push(...got);
      status[key] = `${got.length} found`;
    } catch (e) {
      status[key] = `error: ${String(e.message).slice(0, 160)}`;
    }
  };
  await run("ted", () => fetchTed({ since, fetchImpl }));
  await run("ftc", () => fetchFtc({ since, fetchImpl }));
  await run("jobs", () => fetchJobs({ since, fetchImpl }));
  const dcc = await fetchDcc({ env });
  status.dcc = dcc.skipped ? `skipped: ${dcc.skipped}` : `${dcc.length} found`;
  if (Array.isArray(dcc)) leads.push(...dcc);
  return { leads, status };
}

async function main() {
  const now = new Date();
  const weekOf = now.toISOString().slice(0, 10);
  const { leads: raw, status } = await collect({ now });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const dry = process.env.BUYER_SIGNALS_DRY_RUN === "true" || !token || !repo;

  let seen = new Set();
  if (!dry) {
    const recent = await gh(
      `/repos/${repo}/issues?state=all&labels=${LABEL}&per_page=4`,
      { token }
    );
    seen = new Set(recent.flatMap(i => idsFromBody(i.body)));
  }
  const leads = dedupe(raw, seen);
  const md = render(leads, status, weekOf);
  out(`## Buyer signals${dry ? " (dry run)" : ""}\n\n${md}`);

  if (dry || !leads.length) return;
  await gh(`/repos/${repo}/labels`, {
    method: "POST",
    token,
    body: {
      name: LABEL,
      color: "0e8a16",
      description: "Weekly public buying signals; drafts only",
    },
  }).catch(() => {});
  await gh(`/repos/${repo}/issues`, {
    method: "POST",
    token,
    body: {
      title: `Buyer signals: week of ${weekOf}`,
      body: withMarker(md, leads),
      labels: [LABEL],
    },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
