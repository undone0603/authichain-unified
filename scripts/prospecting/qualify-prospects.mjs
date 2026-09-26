#!/usr/bin/env node
/**
 * Qualify outreach prospects from open data — no Apollo plan required.
 *
 *   node scripts/prospecting/qualify-prospects.mjs --segment ebike --eu-only --max 12
 *
 * Flags
 *   --segment <name>    preset from SEGMENTS (default: ebike)
 *   --qid Q123[,Q456]   Wikidata item(s) to use instead of a preset
 *   --eu-only           keep EU/EEA + CH/UK companies only
 *   --max <n>           companies to crawl for contacts (default 12)
 *   --cache-dir <dir>   read pages from <dir>/<sha1(url)>.html instead of the
 *                       network, and read the SPARQL result from <dir>/sparql.json.
 *                       For sandboxes that can't reach the web directly: fetch
 *                       the pages with any tool (curl, Firecrawl), then replay.
 *   --out <prefix>      write <prefix>.json and <prefix>.md (default: stdout JSON)
 *
 * Read-only. Sends nothing, writes nothing to the outreach queue. The output is a
 * shortlist for the manual outreach playbook, which works one prospect at a time.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  SEGMENTS,
  CONTACT_PATHS,
  EU_EEA,
  EU_ADJACENT,
  buildSparqlUrl,
  parseSparqlCompanies,
  extractPublishedEmails,
  scoreProspect,
} from "./lib/open-prospecting.mjs";

const UA =
  "AuthiChainProspecting/0.1 (+https://authichain.com; z@authichain.com)";

function parseArgs(argv) {
  const args = { segment: "ebike", max: 12, euOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--segment") args.segment = argv[++i];
    else if (a === "--qid") args.qids = argv[++i].split(",");
    else if (a === "--eu-only") args.euOnly = true;
    else if (a === "--max") args.max = Number(argv[++i]);
    else if (a === "--cache-dir") args.cacheDir = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else throw new Error(`unknown flag ${a}`);
  }
  return args;
}

export const cacheKey = url => createHash("sha1").update(url).digest("hex");

function makeFetcher(cacheDir) {
  if (cacheDir) {
    return async url => {
      const f = join(cacheDir, `${cacheKey(url)}.html`);
      return existsSync(f) ? readFileSync(f, "utf8") : null;
    };
  }
  return async url => {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };
}

async function loadCompanies(args, fetchPage) {
  const qids = args.qids ?? SEGMENTS[args.segment]?.qids;
  if (!qids) throw new Error(`unknown segment ${args.segment}; pass --qid`);
  const sparqlUrl = buildSparqlUrl(qids);
  const raw = args.cacheDir
    ? readFileSync(join(args.cacheDir, "sparql.json"), "utf8")
    : await fetchPage(sparqlUrl);
  if (!raw) throw new Error("Wikidata query failed");
  return { qids, sparqlUrl, companies: parseSparqlCompanies(JSON.parse(raw)) };
}

function toMarkdown(report) {
  const lines = [
    `# Prospect shortlist — ${report.segment} (${report.generatedAt.slice(0, 10)})`,
    "",
    `Source: Wikidata items ${report.qids.join(", ")} (product or industry), official website, not dissolved.`,
    "Contacts: only addresses published on the company's own domain, with the page they came from.",
    "Nothing here has been sent. Pick one for the manual outreach playbook.",
    "",
    "| # | Company | Country | Score | Published contacts | Why |",
    "|---|---|---|---|---|---|",
  ];
  report.prospects.forEach((p, i) => {
    const contacts = p.emails.length
      ? p.emails
          .map(
            e =>
              `${e.email}${e.roleInbox ? " (role)" : ""} — [source](${e.sourceUrl})`
          )
          .join("<br>")
      : `— (${p.pagesFetched}/${p.pagesTried} pages fetched)`;
    lines.push(
      `| ${i + 1} | [${p.name}](${p.site}) ([${p.qid}](https://www.wikidata.org/wiki/${p.qid})) | ${p.country ?? "?"} | ${p.score} | ${contacts} | ${p.reasons.join("; ")} |`
    );
  });
  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fetchPage = makeFetcher(args.cacheDir);
  const { qids, sparqlUrl, companies } = await loadCompanies(args, fetchPage);

  const pool = companies
    .filter(
      c => !args.euOnly || EU_EEA.has(c.country) || EU_ADJACENT.has(c.country)
    )
    .slice(0, args.max);

  const prospects = [];
  for (const c of pool) {
    const origin = new URL(c.site).origin;
    const emails = new Map();
    let pagesFetched = 0;
    for (const path of CONTACT_PATHS) {
      const url = origin + path;
      const html = await fetchPage(url);
      if (!html) continue;
      pagesFetched++;
      for (const e of extractPublishedEmails(html, url, c.domain)) {
        if (!emails.has(e.email)) emails.set(e.email, e);
      }
    }
    const list = [...emails.values()];
    prospects.push({
      ...c,
      emails: list,
      pagesTried: CONTACT_PATHS.length,
      pagesFetched,
      ...scoreProspect(c, list, { pagesFetched }),
    });
  }
  prospects.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const report = {
    generatedAt: new Date().toISOString(),
    segment: args.qids ? "custom" : args.segment,
    qids,
    sparqlUrl,
    mode: args.cacheDir ? "cache" : "network",
    discovered: companies.length,
    crawled: pool.length,
    prospects,
  };
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(`${args.out}.json`, JSON.stringify(report, null, 2) + "\n");
    writeFileSync(`${args.out}.md`, toMarkdown(report));
    console.error(
      `wrote ${args.out}.json and ${args.out}.md (${prospects.length} prospects)`
    );
  } else {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
