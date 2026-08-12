#!/usr/bin/env node
/**
 * Guardrail for autonomously published social content.
 *
 * Content Routines write bundles into content/social/ and content-publish.yml
 * posts them to LinkedIn, Reddit and X with no human in the loop. A prompt
 * instruction is not an enforcement mechanism — the model that writes the
 * bundle is the same kind of thing that wrote every claim removed on
 * 2026-08-07. This runs in CI and in the publisher, and a violation is a hard
 * stop, so a bad bundle fails to publish rather than publishing and being
 * retracted. A post cannot be unsent.
 *
 * Usage: node scripts/validate-social-bundle.mjs <file.json> [...]
 * Exits 0 if every bundle is publishable, 1 otherwise.
 */

export const ALLOWED_DOMAINS = new Set([
  'authichain.com',
  'qron.space',
  'govchain.us',
  'strainchain.io',
]);

/**
 * Routes that actually resolve, per domain.
 *
 * This has to be per-host, not a shared list. The brand workers
 * (workers/qron-space, workers/strainchain-io, workers/govchain-us) handle only
 * assets, sitemap.xml and robots.txt, then fall through to `return
 * new Response(HTML)` — so every other path on those domains silently serves
 * the homepage rather than 404ing. "qron.space/protocol" would look like a
 * working deep link and land the reader on a generic page, which is precisely
 * the failure this guardrail exists to catch.
 *
 * authichain.com is the only host with real routes: explicit handlers in
 * workers/authichain-com/src/index.ts plus the APP_PREFIXES it proxies to
 * Vercel. /about and /contact appear in its sitemap but have no handler, so
 * they fall through to the homepage too and are deliberately not listed.
 */
export const ALLOWED_PATHS_BY_HOST = {
  'authichain.com': new Set([
    '/', '/protocol', '/spec', '/anchor', '/digital-product-passport', '/dpp',
    '/pricing', '/book', '/eu-dpp', '/enterprise', '/verify',
  ]),
  'qron.space': new Set(['/']),
  'govchain.us': new Set(['/']),
  'strainchain.io': new Set(['/']),
};

export const REQUIRED_DISCLOSURE = 'Disclosure: I work on this project.';

const TWEET_LIMIT = 280;
const LINKEDIN_LIMIT = 3000;
const REDDIT_TITLE_LIMIT = 300;

// Requires an alphabetic TLD so version strings ("Apache-2.0") are not read as hosts.
const DOMAIN_TOKEN = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}/gi;

const BANNED_PATTERNS = [
  // Unmeasured performance and traction. This company has no traffic; any
  // percentage or currency figure in outbound copy is invented by construction.
  { re: /\d+\s*%/, why: 'percentage claim — nothing here is measured' },
  { re: /[$£€]\s?\d/, why: 'currency figure — no revenue or savings data exists' },
  { re: /\b\d[\d,.]*\s*(?:k|m|b|bn|billion|million|trillion)\b/i, why: 'large-number claim' },
  { re: /\b(?:trusted by|join the|used by)\s+[\d,]+/i, why: 'customer-count claim' },
  { re: /\b\d+\s*\+\s*(?:brands|customers|users|companies|clients|agencies)\b/i, why: 'customer-count claim' },

  // Latency claims. Deliberately scoped to sub-minute units next to a
  // performance verb, so commercial terms like "24-hour delivery" or a
  // "30-day pilot" still pass — those are offers, not measurements.
  { re: /\bsub-\s?\d+(?:\.\d+)?[- ]?(?:ms|millisecond|second|sec)\b/i, why: 'latency claim — nothing here is benchmarked' },
  {
    re: /\b(?:verif\w*|scan\w*|authenticat\w*|confirm\w*|generat\w*|respon\w*|latenc\w*)\b[\s\S]{0,60}?\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|secs?)\b/i,
    why: 'latency claim — nothing here is benchmarked',
  },
  {
    re: /\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|secs?)\b[\s\S]{0,60}?\b(?:verif\w*|scan\w*|authenticat\w*|confirm\w*|generat\w*|respon\w*|latenc\w*)\b/i,
    why: 'latency claim — nothing here is benchmarked',
  },

  // Certifications that require an auditor and a certificate number.
  { re: /\bSOC\s*2\b/i, why: 'SOC 2 is not held' },
  { re: /\bISO\s*27001\b(?!\s*aligned)/i, why: 'ISO 27001 is not certified' },
  { re: /\bFIPS\s*140\b/i, why: 'no CMVP-validated module exists' },
  { re: /\bHIPAA[- ]compliant\b/i, why: 'not a covered entity and no BAA is offered' },
  { re: /\bPCI[- ]?DSS\b(?![^.]*Stripe)/i, why: 'PCI-DSS belongs to Stripe, not to us' },

  // Factually wrong regardless of substantiation.
  { re: /quantum[- ]resistant|post[- ]quantum secure/i, why: 'Ed25519 is broken by Shor — this is false, not merely unproven' },
  { re: /\berror[- ]correction\s*(?:to\s*)?L4\b/i, why: 'QR error-correction levels are L/M/Q/H; L4 does not exist' },

  // Absolutes that cannot survive one counterexample.
  { re: /\b100%\s*(?:scannable|uptime|accurate|guaranteed)/i, why: 'unqualifiable absolute' },
  { re: /\b(?:guaranteed|proven|never fails|bulletproof|unhackable)\b/i, why: 'unbacked absolute' },
];

function checkText(text, label, failures) {
  for (const { re, why } of BANNED_PATTERNS) {
    const m = text.match(re);
    if (m) failures.push(`${label}: ${why} — found ${JSON.stringify(m[0])}`);
  }

  for (const token of text.match(DOMAIN_TOKEN) ?? []) {
    const host = token.toLowerCase().replace(/^www\./, '');
    if (!ALLOWED_DOMAINS.has(host)) {
      failures.push(`${label}: links to "${token}", which is not one of our domains`);
    }
  }

  // A CTA to a route that does not exist is worse than no CTA: the worker
  // serving authichain.com falls through to the homepage rather than 404ing,
  // so the reader gets a page that does not contain what was promised.
  const urlRe = /(?:https?:\/\/)?(?:www\.)?(authichain\.com|qron\.space|govchain\.us|strainchain\.io)((?:\/[\w\-./]*)?)/gi;
  for (const [, host, path] of text.matchAll(urlRe)) {
    const key = host.toLowerCase();
    const clean = (path || '/').replace(/[.,)]+$/, '') || '/';
    const allowed = ALLOWED_PATHS_BY_HOST[key];
    if (!allowed?.has(clean)) {
      failures.push(`${label}: links to "${key}${clean}", which is not a route that exists on that domain`);
    }
  }
}

export function validateBundle(bundle, name = 'bundle') {
  const failures = [];

  if (typeof bundle.linkedin !== 'string' || !bundle.linkedin.trim()) {
    failures.push(`${name}: missing linkedin text`);
  } else {
    if (bundle.linkedin.length > LINKEDIN_LIMIT) {
      failures.push(`${name}.linkedin: ${bundle.linkedin.length} chars exceeds ${LINKEDIN_LIMIT}`);
    }
    checkText(bundle.linkedin, `${name}.linkedin`, failures);
  }

  const reddit = bundle.reddit;
  if (!reddit || typeof reddit.title !== 'string' || typeof reddit.body !== 'string') {
    failures.push(`${name}: missing reddit.title or reddit.body`);
  } else {
    if (reddit.title.length > REDDIT_TITLE_LIMIT) {
      failures.push(`${name}.reddit.title: ${reddit.title.length} chars exceeds ${REDDIT_TITLE_LIMIT}`);
    }
    // Automation posting as a person, undisclosed, is astroturfing — it breaks
    // both r/supplychain and r/blockchain rules and loses the account.
    if (!reddit.body.includes(REQUIRED_DISCLOSURE)) {
      failures.push(`${name}.reddit.body: must contain ${JSON.stringify(REQUIRED_DISCLOSURE)}`);
    }
    if (!reddit.subreddit || !/^[A-Za-z0-9_]{2,21}$/.test(reddit.subreddit)) {
      failures.push(`${name}.reddit.subreddit: missing or malformed (bare name, no "r/")`);
    }
    checkText(reddit.title, `${name}.reddit.title`, failures);
    checkText(reddit.body, `${name}.reddit.body`, failures);
  }

  if (!Array.isArray(bundle.twitter) || bundle.twitter.length !== 3) {
    failures.push(`${name}: twitter must be an array of exactly 3 tweets`);
  } else {
    bundle.twitter.forEach((tweet, i) => {
      if (typeof tweet !== 'string' || !tweet.trim()) {
        failures.push(`${name}.twitter[${i}]: empty`);
        return;
      }
      if (tweet.length > TWEET_LIMIT) {
        failures.push(`${name}.twitter[${i}]: ${tweet.length} chars exceeds ${TWEET_LIMIT}`);
      }
      checkText(tweet, `${name}.twitter[${i}]`, failures);
    });
  }

  return failures;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { readFileSync } = await import('node:fs');
  const { basename } = await import('node:path');

  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: node scripts/validate-social-bundle.mjs <file.json> [...]');
    process.exit(2);
  }

  let failed = 0;
  for (const file of files) {
    let bundle;
    try {
      bundle = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`✗ ${file}: not valid JSON — ${err.message}`);
      failed++;
      continue;
    }
    const failures = validateBundle(bundle, basename(file));
    if (failures.length) {
      failed++;
      console.error(`✗ ${file}`);
      for (const f of failures) console.error(`    ${f}`);
    } else {
      console.log(`✓ ${file}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} bundle(s) failed validation. Nothing will be published.`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} bundle(s) publishable.`);
}
