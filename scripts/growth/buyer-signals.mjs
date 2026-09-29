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
//   boards Greenhouse / Lever / Ashby boards of seeded makers -> same mapping as jobs
//   dcc   California cannabis licences (DCC public search API, keyless)
//                                                          -> strainchain_passport

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

// Job posts are long and generic, so they must name the regulation or the
// claim itself; a passing "anti-counterfeit" or "country of origin" in a
// pharma QA posting is noise.
export const JOB_DPP_TERMS =
  /digital product passport|battery passport|\bESPR\b|battery regulation|2023\/1542/i;
export const JOB_MUSA_TERMS =
  /made in (the )?usa\b|made in america|country[- ]of[- ]origin (marking|labell?ing|claims?|compliance)/i;

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
  const dpp = JOB_DPP_TERMS.test(hay);
  const musa = JOB_MUSA_TERMS.test(hay);
  if (!dpp && !musa) return null;
  const term = (hay.match(dpp ? JOB_DPP_TERMS : JOB_MUSA_TERMS) ?? [""])[0];
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

// ---------- company career boards (Greenhouse, Lever, Ashby) ----------

// Makers that sell physical goods into the EU (batteries, e-bikes, apparel,
// electronics) or make US-origin claims. Each slug is tried on Greenhouse,
// then Lever, then Ashby; a slug on none of them is reported, not fatal.
// Prune or add here; the weekly status line says how many boards resolved.
export const ATS_SEEDS = [
  // batteries, e-mobility, energy storage
  "northvolt",
  "lyten",
  "sila",
  "formenergy",
  "redwoodmaterials",
  "ascendelements",
  "ourNextEnergy",
  "ionblox",
  "natron",
  "fluenceenergy",
  "cowboy",
  "vanmoof",
  "rad-power-bikes",
  "specialized",
  "voi",
  "tier",
  "lime",
  "zeromotorcycles",
  "ecoflow",
  "anker",
  "sonnen",
  "1komma5",
  "enpal",
  "zolar",
  // apparel, footwear, home goods
  "allbirds",
  "onrunning",
  "everlane",
  "rothys",
  "bombas",
  "vinted",
  "zalando",
  "gymshark",
  "veja",
  "patagonia",
  "pangaia",
  "ganni",
  "mejuri",
  "brooklinen",
  "parachute",
  "caraway",
  "ourplace",
  "yeti",
  "stanley1913",
  "hydroflask",
  // electronics and devices
  "fairphone",
  "framework",
  "nothing",
  "teenageengineering",
  "sonos",
  "ouraring",
];

export function parseGreenhouse(data, company) {
  return (data?.jobs ?? [])
    .map(j =>
      jobLead(
        {
          company,
          title: j.title,
          url: j.absolute_url,
          date: j.updated_at,
          text: stripHtml(j.content),
        },
        "Greenhouse"
      )
    )
    .filter(Boolean);
}

export function parseLever(data, company) {
  return (Array.isArray(data) ? data : [])
    .map(j =>
      jobLead(
        {
          company,
          title: j.text,
          url: j.hostedUrl,
          date: j.createdAt ? new Date(j.createdAt).toISOString() : "",
          text: `${j.descriptionPlain ?? ""} ${(j.lists ?? [])
            .map(l => stripHtml(l.content))
            .join(" ")}`,
        },
        "Lever"
      )
    )
    .filter(Boolean);
}

export function parseAshby(data, company) {
  return (data?.jobs ?? [])
    .map(j =>
      jobLead(
        {
          company,
          title: j.title,
          url: j.jobUrl,
          date: j.publishedAt,
          text: j.descriptionPlain ?? stripHtml(j.descriptionHtml),
        },
        "Ashby"
      )
    )
    .filter(Boolean);
}

const ATS = [
  {
    url: s =>
      `https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`,
    parse: (d, c) => parseGreenhouse(d, c),
    company: (d, s) => d?.meta?.company_name ?? s,
  },
  {
    url: s => `https://api.lever.co/v0/postings/${s}?mode=json`,
    parse: (d, c) => parseLever(d, c),
    company: (_d, s) => s,
  },
  {
    url: s => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    parse: (d, c) => parseAshby(d, c),
    company: (_d, s) => s,
  },
];

/**
 * @param {{ since: Date, fetchImpl?: typeof fetch, seeds?: string[] }} opts
 */
export async function fetchAts({ since, fetchImpl, seeds = ATS_SEEDS }) {
  /** @type {any[]} */
  const leads = [];
  let resolved = 0;
  for (const slug of seeds) {
    for (const ats of ATS) {
      let d;
      try {
        d = await getJson(ats.url(encodeURIComponent(slug)), { fetchImpl });
      } catch {
        continue;
      }
      // Lever answers an unknown slug with an empty array, not a 404.
      if (Array.isArray(d) && !d.length) continue;
      resolved++;
      leads.push(...ats.parse(d, ats.company(d, slug)));
      break;
    }
  }
  const fresh = leads.filter(
    l => !l.date || Date.parse(l.date) >= since.getTime()
  );
  return Object.assign(fresh, { resolved, seeds: seeds.length });
}

// ---------- DCC ----------

// The backend behind search.cannabis.ca.gov (its /config.js names CANNA_API).
// Keyless; the DCA iServices keys are not needed for it.
export const DCC_API =
  "https://as-dcc-pub-cann-w-p-002.azurewebsites.net/licenses/AdvancedSearch";
const DCC_PAGE = 50;

// Processors dry and trim other people's plants; they hold no cultivars.
const DCC_SKIP_TYPES = /processor/i;

/**
 * One lead per business: a farm issued several licences in the window is one
 * conversation. Only public registry fields go into the lead, because the
 * digest is a public issue: no owner names, emails or phone numbers.
 */
export function dccLeads(rows, since) {
  /** @type {Map<string, any>} */
  const byOrg = new Map();
  for (const r of rows ?? []) {
    const issued = Date.parse(r.issueDate ?? "");
    if (!issued || issued < since.getTime()) continue;
    if (r.licenseStatus !== "Active") continue;
    const type = String(r.licenseType ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!/^cultivation/i.test(type) || DCC_SKIP_TYPES.test(type)) continue;
    const org = String(r.businessLegalName ?? "").trim();
    if (!org) continue;
    const key = org.toLowerCase();
    const county =
      r.premiseCounty && r.premiseCounty !== "Data Not Available"
        ? `${r.premiseCounty} County`
        : "";
    const prev = byOrg.get(key);
    if (prev) {
      prev.licences.push(r.licenseNumber);
      continue;
    }
    byOrg.set(key, {
      id: `dcc:${r.licenseNumber}`,
      source: "dcc",
      org,
      title: `New cultivation licence ${r.licenseNumber}: ${type.replace(/^Cultivation - /i, "")}`,
      detail: county,
      country: county,
      date: new Date(issued).toISOString().slice(0, 10),
      url: "https://search.cannabis.ca.gov/",
      offer: "strainchain_passport",
      licences: [r.licenseNumber],
    });
  }
  return [...byOrg.values()];
}

export async function fetchDcc({ since, fetchImpl } = {}) {
  /** @type {any[]} */
  const rows = [];
  for (let page = 1; page <= 4; page++) {
    const q = new URLSearchParams({
      licenseType: "Cultivation",
      licenseStatus: "Active",
      sortOrder: "issueDate desc",
      pageSize: String(DCC_PAGE),
      pageNumber: String(page),
    });
    const d = await getJson(`${DCC_API}?${q}`, { fetchImpl });
    const data = d?.data ?? [];
    rows.push(...data);
    const oldest = Date.parse(data.at(-1)?.issueDate ?? "");
    if (!d?.metadata?.hasNext || !oldest || oldest < since.getTime()) break;
  }
  return dccLeads(rows, since);
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
      // A tender is a bid decision for the owner, not a cold pitch.
      return `Bid decision, not a pitch: does ${o.label.split(",")[0]} work fit this tender${lead.deadline ? ` before ${lead.deadline}` : ""}? Notice: ${lead.url}`;
    case "ftc":
      return `After "${lead.title}", brands in the same category are checking their own origin claims. One SKU's claim file is ${o.label}: ${o.url}`;
    case "dcc":
      return `Congratulations on the new California cultivation licence. If you breed or hold cultivars worth proving, ${o.label} gives each cultivar a verifiable provenance record: ${o.url}`;
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
  boards: "Company career boards",
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

/**
 * @param {{ now?: Date, windowDays?: number, fetchImpl?: typeof fetch }} [opts]
 */
export async function collect({
  now = new Date(),
  windowDays = 8,
  fetchImpl,
} = {}) {
  const since = daysAgo(windowDays, now);
  /** @type {Record<string, string>} */
  const status = {};
  /** @type {any[]} */
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
  try {
    const ats = await fetchAts({ since, fetchImpl });
    leads.push(...ats);
    status.boards = `${ats.length} found on ${ats.resolved} of ${ats.seeds} company boards`;
  } catch (e) {
    status.boards = `error: ${String(e.message).slice(0, 160)}`;
  }
  await run("dcc", () => fetchDcc({ since, fetchImpl }));
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
  // Printed to the job log only; the issue is the record.
  console.log(`## Buyer signals${dry ? " (dry run)" : ""}\n\n${md}`);

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
