/**
 * Open-data prospect qualification — the free replacement for Apollo's
 * Organization Search, which the current Apollo plan does not include.
 *
 *   Discovery  → Wikidata SPARQL (CC0, no key): companies whose product
 *                (P1056) or industry (P452) is the segment item, with an
 *                official website (P856), not dissolved (P576).
 *   Contacts   → only addresses the company publishes on its own domain
 *                (homepage, imprint/Impressum, contact, legal pages). Each
 *                address carries the URL it was read from. Nothing is guessed:
 *                no first.last@ patterns, no third-party directories.
 *
 * This module never sends anything and never writes to the outreach queue.
 * Its output feeds the manual outreach playbook
 * (.claude/skills/manual-outreach-playbook/SKILL.md), which picks ONE prospect.
 */
import { isRoleInbox } from "../../dpp-outreach/lib/quality-gate.mjs";

/** Wikidata items per segment. `--qid` on the CLI overrides these. */
export const SEGMENTS = {
  ebike: { qids: ["Q924724"], label: "electric bicycle" },
};

/**
 * Countries whose market placement falls under EU Battery Regulation
 * 2023/1542 (EU + EEA). CH and UK sell heavily into the EU, so they count as
 * exposed but are flagged separately in the score.
 */
export const EU_EEA = new Set([
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Iceland",
  "Liechtenstein",
  "Norway",
]);
export const EU_ADJACENT = new Set(["Switzerland", "United Kingdom"]);

/** Pages where companies publish their own contact addresses. */
export const CONTACT_PATHS = [
  "/",
  "/impressum",
  "/imprint",
  "/contact",
  "/kontakt",
  "/contact-us",
  "/legal",
  "/legal-notice",
  "/mentions-legales",
  "/aviso-legal",
  "/colofon",
  // Press pages usually name a real person next to the press inbox
  // (r-m.de/de/presse: Benjamin Wenz, Corporate Communications & PR).
  "/presse",
  "/press",
  "/de/presse/",
  "/en/press/",
  "/newsroom",
  "/media",
];

export function buildSparqlQuery(qids, limit = 200) {
  const values = qids.map(q => `wd:${q}`).join(" ");
  return `SELECT ?c ?cLabel ?site ?countryLabel WHERE {
 VALUES ?seg { ${values} }
 { ?c wdt:P1056 ?seg } UNION { ?c wdt:P452 ?seg }
 ?c wdt:P856 ?site .
 OPTIONAL { ?c wdt:P17 ?country }
 FILTER NOT EXISTS { ?c wdt:P576 ?dissolved }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${limit}`;
}

export function buildSparqlUrl(qids, limit) {
  return `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(buildSparqlQuery(qids, limit))}`;
}

const SECOND_LEVEL = new Set([
  "co.uk",
  "org.uk",
  "co.nz",
  "com.au",
  "co.jp",
  "com.cn",
  "com.tw",
  "com.br",
]);

/** Registrable domain, e.g. "shop.r-m.de" → "r-m.de", "www.gtech.co.uk" → "gtech.co.uk". */
export function registrableDomain(hostOrUrl) {
  let host = String(hostOrUrl || "")
    .trim()
    .toLowerCase();
  try {
    if (host.includes("/")) host = new URL(host).hostname;
  } catch {
    return "";
  }
  const parts = host
    .replace(/^www\./, "")
    .split(".")
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  return SECOND_LEVEL.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

/**
 * SPARQL JSON → one record per company. Wikidata often lists several sites
 * (country storefronts); the first https one without a path is preferred.
 */
export function parseSparqlCompanies(json) {
  const byQid = new Map();
  for (const b of json?.results?.bindings ?? []) {
    const qid = String(b.c?.value ?? "")
      .split("/")
      .pop();
    const name = b.cLabel?.value ?? "";
    if (!qid || !name || name === qid) continue; // unlabeled items can't be pitched by name
    const rec = byQid.get(qid) ?? {
      qid,
      name,
      country: b.countryLabel?.value ?? null,
      sites: [],
    };
    if (!rec.country && b.countryLabel?.value)
      rec.country = b.countryLabel.value;
    if (b.site?.value && !rec.sites.includes(b.site.value))
      rec.sites.push(b.site.value);
    byQid.set(qid, rec);
  }
  return [...byQid.values()].map(rec => {
    const rank = s =>
      (s.startsWith("https") ? 0 : 1) +
      (new URL(s).pathname.length > 1 ? 2 : 0);
    const site = [...rec.sites].sort((a, b) => rank(a) - rank(b))[0];
    return { ...rec, site, domain: registrableDomain(site) };
  });
}

/**
 * The shared gate's role list is English-only; imprint pages are mostly not.
 * Kept local so the live send gate's behaviour doesn't change under it.
 */
const EXTRA_ROLE_LOCALPARTS = new Set([
  "kontakt",
  "service",
  "mail",
  "email",
  "order",
  "orders",
  "shop",
  "store",
  "dealer",
  "dealers",
  "haendler",
  "marketing",
  "presse",
  "privacy",
  "datenschutz",
  "gdpr",
  "dpo",
  "legal",
  "warranty",
  "returns",
  "b2b",
  "partners",
  "partner",
  "bonjour",
  "hallo",
  "hola",
  "servicio",
  "klantenservice",
  "customerservice",
  "customer.service",
  "customercare",
  "service.client",
  "accounting",
  "finance",
  "invoice",
  "invoices",
  "rechnung",
  "buchhaltung",
]);

export function isRoleAddress(email) {
  const local = String(email).toLowerCase().split("@")[0] ?? "";
  return isRoleInbox(email) || EXTRA_ROLE_LOCALPARTS.has(local);
}

const ENTITY_MAP = {
  "&#64;": "@",
  "&#x40;": "@",
  "&commat;": "@",
  "&#46;": ".",
  "&period;": ".",
  "&amp;": "&",
};
const EMAIL_IN_TEXT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const ASSET_SUFFIX = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;

/**
 * Addresses published on `pageUrl` that belong to the company's own domain
 * (or a subdomain of it). Anything on another domain — agencies, platforms,
 * Sentry DSNs — is dropped because it isn't the company speaking.
 */
export function extractPublishedEmails(html, pageUrl, companyDomain) {
  let text = String(html || "");
  for (const [k, v] of Object.entries(ENTITY_MAP)) text = text.split(k).join(v);
  const found = new Map();
  const add = (raw, via) => {
    const email = decodeURIComponent(raw)
      .trim()
      .toLowerCase()
      .replace(/^mailto:/, "")
      .split("?")[0];
    if (ASSET_SUFFIX.test(email)) return;
    const domain = email.split("@")[1] ?? "";
    if (!domain || registrableDomain(domain) !== companyDomain) return;
    const prev = found.get(email);
    if (!prev || (prev.via === "text" && via === "mailto")) {
      found.set(email, {
        email,
        via,
        sourceUrl: pageUrl,
        roleInbox: isRoleAddress(email),
      });
    }
  };
  for (const m of text.matchAll(/mailto:([^"'<>\s]+)/gi)) add(m[1], "mailto");
  for (const m of text.matchAll(EMAIL_IN_TEXT)) add(m[0], "text");
  return [...found.values()];
}

/**
 * Fit for a battery-passport pitch. Higher is better; reasons explain every point
 * so the owner can overrule the ranking without re-running anything.
 */
export function scoreProspect(company, emails, { pagesFetched = 1 } = {}) {
  const reasons = [];
  let score = 0;
  if (EU_EEA.has(company.country)) {
    score += 3;
    reasons.push("EU/EEA-based: Battery Regulation 2023/1542 applies directly");
  } else if (EU_ADJACENT.has(company.country)) {
    score += 2;
    reasons.push(`${company.country}-based, sells into the EU`);
  } else {
    reasons.push(
      `outside EU (${company.country ?? "country unknown"}): exposure only via EU sales`
    );
  }
  const named = emails.filter(e => !e.roleInbox);
  if (named.length) {
    score += 3;
    reasons.push("named-person address published on own domain");
  } else if (emails.length) {
    score += 1;
    reasons.push(
      "only role inboxes published (fine for a manual first touch, rejected by the automated gate)"
    );
  } else if (pagesFetched === 0) {
    reasons.push("not crawled yet: no contact page could be fetched");
  } else {
    reasons.push("no address published on own domain in the pages fetched");
  }
  return { score, reasons };
}
