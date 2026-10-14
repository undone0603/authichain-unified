#!/usr/bin/env node
// Submit every indexable sitemap URL of the brand domains to IndexNow.
//
// IndexNow takes page URLs, not sitemap URLs, as a JSON POST per host with a
// key file served at https://<host>/<key>.txt (all four hosts serve it). This
// is inbound-only: it tells search engines which of our own public pages
// exist. It sends no email and posts nothing anywhere.
//
// Usage: node scripts/seo/indexnow-submit.mjs [--dry-run]

export const INDEXNOW_KEY = "authichain2026indexnow";
export const HOSTS = ["authichain.com", "qron.space", "strainchain.io", "govchain.us"];
const MAX_URLS = 10_000; // IndexNow per-request limit
const SITEMAP_LIMIT = 20;

/** Pure: <loc> values from a sitemap or sitemap index body. */
export function parseSitemap(xml) {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m =>
    m[1].replace(/&amp;/g, "&")
  );
  return { isIndex: /<sitemapindex[\s>]/.test(xml), locs };
}

/** Pure: keep same-host http(s) URLs without fragments, de-duplicated, capped. */
export function urlsForHost(host, locs) {
  const out = new Set();
  for (const loc of locs) {
    let u;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    if (u.host !== host || !/^https?:$/.test(u.protocol) || u.hash) continue;
    out.add(u.href);
    if (out.size >= MAX_URLS) break;
  }
  return [...out];
}

/** Pure: the IndexNow request body for one host. */
export function indexNowBody(host, urlList) {
  return {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

async function sitemapUrls(host) {
  const queue = [`https://${host}/sitemap.xml`];
  const seen = new Set();
  const locs = [];
  while (queue.length && seen.size < SITEMAP_LIMIT) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    const parsed = parseSitemap(await res.text());
    if (parsed.isIndex) queue.push(...parsed.locs);
    else locs.push(...parsed.locs);
  }
  return urlsForHost(host, locs);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  let failed = 0;
  for (const host of HOSTS) {
    try {
      const urls = await sitemapUrls(host);
      if (!urls.length) {
        console.log(`${host}: sitemap has no URLs, skipped`);
        continue;
      }
      if (dryRun) {
        console.log(`${host}: ${urls.length} URLs (dry run, not submitted)`);
        continue;
      }
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(indexNowBody(host, urls)),
        signal: AbortSignal.timeout(30_000),
      });
      // 200 = accepted, 202 = accepted pending key check.
      const ok = res.status === 200 || res.status === 202;
      console.log(`${host}: ${urls.length} URLs -> ${res.status}`);
      if (!ok) failed++;
    } catch (err) {
      console.log(`${host}: ${err.message}`);
      failed++;
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("indexnow-submit.mjs")) {
  await main();
}
