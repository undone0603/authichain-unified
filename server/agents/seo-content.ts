// server/agents/seo-content.ts
// Autonomous programmatic-SEO agent. Generates SEO-optimized landing-page content
// for a brand + target keyword, with code-constructed JSON-LD schema (the signal
// AI search engines use for citations). Owned-property content = no platform ToS
// gate, so this is safe to run fully autonomously (e.g. from /api/automation/cron).
import { invokeLLM, parseLLMContent } from '../_core/llm.js';
import { logActivity, upsertSeoPage, type Db } from './db-helpers.js';
import { checkAndReserve, recordEvent } from '../../src/lib/guardrail.js';
import sanitizeHtml from 'sanitize-html';

export interface BrandSeoConfig {
  brand: string;
  domain: string;   // e.g. "strainchain.io"
  facts: string;    // verified selling points only — no invented stats
}

export interface SeoPage {
  slug: string;
  keyword: string;
  brand: string;
  domain: string;
  title: string;          // <=60 chars
  metaDescription: string; // <=155 chars
  h1: string;
  bodyHtml: string;
  jsonLd: Record<string, unknown>;
}

export const BRAND_SEO: Record<string, BrandSeoConfig> = {
  authichain: {
    brand: 'AuthiChain',
    domain: 'authichain.com',
    facts:
      'AI + blockchain product authentication. 5-agent AI consensus, Bitcoin L1 anchoring, ' +
      'W3C Verifiable Credentials, sub-2-second verification, EU DPP compliant. Verticals: ' +
      'luxury, pharma (DSCSA), electronics, agriculture, art, cannabis. From $49/mo.',
  },
  strainchain: {
    brand: 'StrainChain',
    domain: 'strainchain.io',
    facts:
      'Consumer-facing blockchain provenance for cannabis. Integrates with METRC and BioTrack, ' +
      'lab certs anchored to Bitcoin Ordinals, QR scan shows verified chain of custody. For ' +
      'dispensaries and MSOs. From $199/mo.',
  },
  govchain: {
    brand: 'GovChain',
    domain: 'govchain.us',
    facts:
      'On-chain government document verification. Bitcoin-anchored hashes for permits, ' +
      'certificates and RFP awards. 2-second QR verification, works offline, no central ' +
      'authority. SBIR/SVIP eligible.',
  },
  qron: {
    brand: 'QRON',
    domain: 'qron.space',
    facts:
      'AI "living QR art" generator. ControlNet-generated scannable art QR codes, Ed25519-signed ' +
      'and Polygon-anchored, editable redirects (no reprinting), built-in scan analytics. ' +
      'From $5 one-off to $99/mo.',
  },
};

/**
 * Keyword targets for programmatic SEO, one entry per landing page. Mixes
 * informational ("what is X") and buyer-intent ("X software"/"X compliance")
 * phrasing per brand's vertical — the two search-intent categories that
 * convert into organic traffic for a B2B SaaS product. Consumed gradually by
 * /api/automation/cron (a handful of new, not-yet-published entries per
 * run, gated by the content.publish guardrail's daily cap) rather than all
 * at once — append new keywords here as they're identified.
 */
export const SEO_KEYWORD_POOL: { brandKey: keyof typeof BRAND_SEO; keyword: string }[] = [
  // AuthiChain — blockchain product authentication (luxury, pharma DSCSA, electronics, agriculture, art, cannabis)
  { brandKey: 'authichain', keyword: 'blockchain product authentication' },
  { brandKey: 'authichain', keyword: 'anti-counterfeit qr verification' },
  { brandKey: 'authichain', keyword: 'digital product passport software' },
  { brandKey: 'authichain', keyword: 'dscsa compliance software' },
  { brandKey: 'authichain', keyword: 'luxury goods authentication blockchain' },
  { brandKey: 'authichain', keyword: 'product traceability software' },
  { brandKey: 'authichain', keyword: 'how to verify product authenticity online' },
  { brandKey: 'authichain', keyword: 'supply chain verification blockchain' },
  { brandKey: 'authichain', keyword: 'counterfeit protection for brands' },
  { brandKey: 'authichain', keyword: 'eu digital product passport compliance' },
  // StrainChain — cannabis blockchain provenance (METRC/BioTrack, dispensaries, MSOs)
  { brandKey: 'strainchain', keyword: 'cannabis blockchain provenance' },
  { brandKey: 'strainchain', keyword: 'metrc compliance blockchain' },
  { brandKey: 'strainchain', keyword: 'cannabis seed to sale tracking software' },
  { brandKey: 'strainchain', keyword: 'dispensary compliance software' },
  { brandKey: 'strainchain', keyword: 'cannabis lab results verification' },
  { brandKey: 'strainchain', keyword: 'biotrack thc integration software' },
  { brandKey: 'strainchain', keyword: 'multi-state cannabis operator compliance' },
  { brandKey: 'strainchain', keyword: 'cannabis chain of custody software' },
  // GovChain — government document verification (permits, certificates, RFP awards, SBIR/SVIP)
  { brandKey: 'govchain', keyword: 'government document verification blockchain' },
  { brandKey: 'govchain', keyword: 'blockchain permit verification' },
  { brandKey: 'govchain', keyword: 'digital government certificate verification' },
  { brandKey: 'govchain', keyword: 'sbir svip grant eligible technology' },
  { brandKey: 'govchain', keyword: 'government rfp award verification' },
  { brandKey: 'govchain', keyword: 'tamper proof public records technology' },
  // QRON — AI QR art generator (ControlNet, Polygon-anchored, scan analytics)
  { brandKey: 'qron', keyword: 'ai qr code art generator' },
  { brandKey: 'qron', keyword: 'custom qr code design generator' },
  { brandKey: 'qron', keyword: 'scannable qr art generator' },
  { brandKey: 'qron', keyword: 'branded qr code generator' },
  { brandKey: 'qron', keyword: 'dynamic qr code with analytics' },
  { brandKey: 'qron', keyword: 'editable qr code no reprint' },
];

export const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/**
 * Picks up to `limit` not-yet-published jobs from `pool`, in pool order.
 * Pure/synchronous so the daily-batch-selection logic is unit-testable
 * without a DB — /api/automation/cron supplies `publishedSlugs` from
 * listPublishedSlugs(db).
 */
export function selectUnpublishedJobs(
  pool: { brandKey: keyof typeof BRAND_SEO; keyword: string }[],
  publishedSlugs: Iterable<string>,
  limit: number,
): { brandKey: keyof typeof BRAND_SEO; keyword: string }[] {
  const published = new Set(publishedSlugs);
  const unpublished = pool.filter((job) => !published.has(slugify(job.keyword)));
  return unpublished.slice(0, limit);
}

const clamp = (s: string, max: number): string =>
  s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;

/**
 * Generate one SEO landing page for a brand + target keyword.
 * Prose comes from the LLM (constrained to verified facts); the JSON-LD schema is
 * constructed in code so it is always valid for AI-search ingestion.
 */
export async function generateSeoPage(
  config: BrandSeoConfig,
  keyword: string,
): Promise<SeoPage> {
  const prompt = `You are an SEO copywriter. Write a landing page for ${config.brand} (${config.domain}) targeting the search keyword: "${keyword}".
Use ONLY these facts; never invent statistics:
${config.facts}

Return JSON:
{
  "title": "<=60 char SEO title containing the keyword",
  "metaDescription": "<=155 char meta description",
  "h1": "page H1",
  "bodyHtml": "200-350 words of clean semantic HTML using <h2>/<p>/<ul> only — no <script>, no inline styles"
}`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const raw = parseLLMContent<{
    title: string; metaDescription: string; h1: string; bodyHtml: string;
  }>(result.choices[0].message.content);

  const title = clamp(String(raw.title ?? `${config.brand} — ${keyword}`), 60);
  const metaDescription = clamp(String(raw.metaDescription ?? config.facts), 155);
  const h1 = String(raw.h1 ?? title);
  // Sanitize LLM-generated HTML via allowlist (sanitize-html).
  // Allowlist approach is the only reliable XSS defense vs regex denylist.
  const bodyHtml = sanitizeHtml(String(raw.bodyHtml ?? ''), {
    allowedTags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br', 'span'],
    allowedAttributes: { 'a': ['href', 'title', 'rel'] },
  });  const url = `https://${config.domain}/${slugify(keyword)}`;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${config.brand} — ${keyword}`,
    brand: { '@type': 'Brand', name: config.brand },
    description: metaDescription,
    url,
  };

  return { slug: slugify(keyword), keyword, brand: config.brand, domain: config.domain, title, metaDescription, h1, bodyHtml, jsonLd };
}

/**
 * Autonomous batch entry point — generate pages for many keywords across brands.
 * Safe to call from a cron job. Returns the generated pages and logs the run.
 * Failures on individual keywords are isolated so one bad generation can't abort the batch.
 *
 * Each generated page is gated by the content.publish guardrail channel
 * (checkAndReserve/recordEvent) before being persisted — a denied page is
 * still returned (it was generated) but not written to the seo_pages table,
 * so it never becomes servable.
 */
export async function runProgrammaticSeoBatch(
  jobs: { brandKey: keyof typeof BRAND_SEO; keyword: string }[],
  db: Db,
): Promise<SeoPage[]> {
  const pages: SeoPage[] = [];
  for (const job of jobs) {
    const config = BRAND_SEO[job.brandKey];
    if (!config) continue;
    try {
      const page = await generateSeoPage(config, job.keyword);
      pages.push(page);

      const result = await checkAndReserve('content.publish', 1);
      if (result.allowed) {
        await upsertSeoPage(db, page);
      }
      await recordEvent({
        channel: 'content.publish',
        action: 'record',
        allowed: result.allowed,
        reason: result.reason,
        metadata: { slug: page.slug, brand: page.brand, keyword: page.keyword },
      });
    } catch (err) {
      console.warn(`[seo-content] failed for ${String(job.brandKey)}/${job.keyword}:`, err);
    }
  }

  await logActivity(db, {
    userId: null,
    action: 'programmatic_seo_generated',
    entityType: 'seo_batch',
    entityId: 0,
    details: { requested: jobs.length, generated: pages.length, slugs: pages.map(p => p.slug) },
  });

  return pages;
}
