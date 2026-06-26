// server/agents/seo-content.ts
// Autonomous programmatic-SEO agent. Generates SEO-optimized landing-page content
// for a brand + target keyword, with code-constructed JSON-LD schema (the signal
// AI search engines use for citations). Owned-property content = no platform ToS
// gate, so this is safe to run fully autonomously (e.g. from /api/automation/cron).
import { invokeLLM, parseLLMContent } from '../_core/llm.js';
import { logActivity } from '../db.js';

export interface BrandSeoConfig {
  brand: string;
  domain: string;   // e.g. "strainchain.io"
  facts: string;    // verified selling points only — no invented stats
}

export interface SeoPage {
  slug: string;
  keyword: string;
  brand: string;
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

const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

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
  // Strip any script tags defensively — generated HTML must be safe to render.
  const bodyHtml = String(raw.bodyHtml ?? '').replace(/<script[\s\S]*?<\/script>/gi, '');

  const url = `https://${config.domain}/${slugify(keyword)}`;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${config.brand} — ${keyword}`,
    brand: { '@type': 'Brand', name: config.brand },
    description: metaDescription,
    url,
  };

  return { slug: slugify(keyword), keyword, brand: config.brand, title, metaDescription, h1, bodyHtml, jsonLd };
}

/**
 * Autonomous batch entry point — generate pages for many keywords across brands.
 * Safe to call from a cron job. Returns the generated pages and logs the run.
 * Failures on individual keywords are isolated so one bad generation can't abort the batch.
 */
export async function runProgrammaticSeoBatch(
  jobs: { brandKey: keyof typeof BRAND_SEO; keyword: string }[],
): Promise<SeoPage[]> {
  const pages: SeoPage[] = [];
  for (const job of jobs) {
    const config = BRAND_SEO[job.brandKey];
    if (!config) continue;
    try {
      pages.push(await generateSeoPage(config, job.keyword));
    } catch (err) {
      console.warn(`[seo-content] failed for ${String(job.brandKey)}/${job.keyword}:`, err);
    }
  }

  await logActivity({
    userId: null,
    action: 'programmatic_seo_generated',
    entityType: 'seo_batch',
    entityId: 0,
    details: { requested: jobs.length, generated: pages.length, slugs: pages.map(p => p.slug) },
  });

  return pages;
}
