import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted controllable LLM response.
const { llm } = vi.hoisted(() => ({ llm: { content: '' as string, throwOnce: false } }));

vi.mock('../_core/llm.js', () => ({
  invokeLLM: vi.fn(async () => {
    if (llm.throwOnce) { llm.throwOnce = false; throw new Error('llm boom'); }
    return { choices: [{ message: { content: llm.content } }] };
  }),
  parseLLMContent: (raw: string) => JSON.parse(raw),
}));

const logActivity = vi.fn(async (..._args: unknown[]) => {});
const upsertSeoPage = vi.fn(async (..._args: unknown[]) => {});
vi.mock('./db-helpers.js', () => ({
  logActivity: (...a: unknown[]) => logActivity(...a),
  upsertSeoPage: (...a: unknown[]) => upsertSeoPage(...a),
}));

const { guardrail } = vi.hoisted(() => ({ guardrail: { allowed: true, remaining: 9, reason: undefined as string | undefined } }));
const checkAndReserve = vi.fn(async (..._args: unknown[]) => guardrail);
const recordEvent = vi.fn(async (..._args: unknown[]) => {});
vi.mock('../../src/lib/guardrail.js', () => ({
  checkAndReserve: (...a: unknown[]) => checkAndReserve(...a),
  recordEvent: (...a: unknown[]) => recordEvent(...a),
}));

import { generateSeoPage, runProgrammaticSeoBatch, selectUnpublishedJobs, BRAND_SEO } from './seo-content';

const fakeDb = {} as any;

beforeEach(() => {
  logActivity.mockClear();
  upsertSeoPage.mockClear();
  checkAndReserve.mockClear();
  recordEvent.mockClear();
  guardrail.allowed = true;
  guardrail.reason = undefined;
  llm.throwOnce = false;
  llm.content = JSON.stringify({
    title: 'Cannabis Blockchain Provenance | StrainChain Verified',
    metaDescription: 'Verify chain of custody with StrainChain.',
    h1: 'StrainChain Provenance',
    bodyHtml: '<h2>Trust</h2><p>Verified.</p>',
  });
});

describe('generateSeoPage', () => {
  it('returns a structured page with a slug and valid JSON-LD', async () => {
    const page = await generateSeoPage(BRAND_SEO.strainchain, 'cannabis blockchain provenance');
    expect(page.slug).toBe('cannabis-blockchain-provenance');
    expect(page.brand).toBe('StrainChain');
    expect(page.domain).toBe('strainchain.io');
    expect(page.jsonLd['@type']).toBe('Product');
    expect((page.jsonLd as any).url).toBe('https://strainchain.io/cannabis-blockchain-provenance');
  });

  it('clamps title to 60 and meta to 155 chars', async () => {
    llm.content = JSON.stringify({
      title: 'x'.repeat(120), metaDescription: 'y'.repeat(300), h1: 'H', bodyHtml: '<p>z</p>',
    });
    const page = await generateSeoPage(BRAND_SEO.qron, 'ai qr art generator');
    expect(page.title.length).toBeLessThanOrEqual(60);
    expect(page.metaDescription.length).toBeLessThanOrEqual(155);
  });

  it('strips <script> tags from generated body HTML', async () => {
    llm.content = JSON.stringify({
      title: 'T', metaDescription: 'M', h1: 'H',
      bodyHtml: '<p>ok</p><script>alert(1)</script><p>safe</p>',
    });
    const page = await generateSeoPage(BRAND_SEO.authichain, 'product authentication');
    expect(page.bodyHtml).not.toContain('<script');
    expect(page.bodyHtml).toContain('safe');
  });
});

describe('runProgrammaticSeoBatch', () => {
  it('generates pages for valid brand keys and logs the run', async () => {
    const pages = await runProgrammaticSeoBatch([
      { brandKey: 'strainchain', keyword: 'metrc blockchain' },
      { brandKey: 'govchain', keyword: 'document verification' },
    ], fakeDb);
    expect(pages).toHaveLength(2);
    expect(logActivity).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({ action: 'programmatic_seo_generated' }),
    );
  });

  it('checks the content.publish guardrail and persists each page it allows', async () => {
    await runProgrammaticSeoBatch([
      { brandKey: 'strainchain', keyword: 'metrc blockchain' },
    ], fakeDb);
    expect(checkAndReserve).toHaveBeenCalledWith('content.publish', 1);
    expect(upsertSeoPage).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({ slug: 'metrc-blockchain', brand: 'StrainChain' }),
    );
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'content.publish', action: 'record', allowed: true }),
    );
  });

  it('does not persist a page the guardrail denies, but still returns it as generated', async () => {
    guardrail.allowed = false;
    guardrail.reason = 'daily cap reached';
    const pages = await runProgrammaticSeoBatch([
      { brandKey: 'strainchain', keyword: 'metrc blockchain' },
    ], fakeDb);
    expect(pages).toHaveLength(1);
    expect(upsertSeoPage).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'content.publish', action: 'record', allowed: false, reason: 'daily cap reached' }),
    );
  });

  it('still records the guardrail event when persistence fails after a reserved slot', async () => {
    upsertSeoPage.mockRejectedValueOnce(new Error('db boom'));
    const pages = await runProgrammaticSeoBatch([
      { brandKey: 'strainchain', keyword: 'metrc blockchain' },
    ], fakeDb);
    expect(pages).toHaveLength(1); // the page was still generated
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'content.publish', action: 'record', allowed: false, reason: 'db boom' }),
    );
  });

  it('isolates a single failed generation without aborting the batch', async () => {
    llm.throwOnce = true; // first generateSeoPage call throws
    const pages = await runProgrammaticSeoBatch([
      { brandKey: 'strainchain', keyword: 'fails' },
      { brandKey: 'qron', keyword: 'living qr art' },
    ], fakeDb);
    expect(pages).toHaveLength(1);
    expect(pages[0].brand).toBe('QRON');
  });

  it('skips unknown brand keys', async () => {
    const pages = await runProgrammaticSeoBatch([
      { brandKey: 'nope' as any, keyword: 'x' },
    ], fakeDb);
    expect(pages).toHaveLength(0);
  });
});

describe('selectUnpublishedJobs', () => {
  const pool = [
    { brandKey: 'authichain' as const, keyword: 'blockchain product authentication' },
    { brandKey: 'authichain' as const, keyword: 'dscsa compliance software' },
    { brandKey: 'strainchain' as const, keyword: 'metrc compliance blockchain' },
    { brandKey: 'qron' as const, keyword: 'ai qr code art generator' },
  ];

  it('excludes jobs whose slug is already published', () => {
    const selected = selectUnpublishedJobs(pool, ['blockchain-product-authentication'], 10);
    expect(selected.map((j) => j.keyword)).toEqual([
      'dscsa compliance software',
      'metrc compliance blockchain',
      'ai qr code art generator',
    ]);
  });

  it('caps the result at the given limit, preserving pool order', () => {
    const selected = selectUnpublishedJobs(pool, [], 2);
    expect(selected).toEqual([pool[0], pool[1]]);
  });

  it('returns an empty array once the whole pool is published', () => {
    const allSlugs = pool.map((j) => j.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
    const selected = selectUnpublishedJobs(pool, allSlugs, 10);
    expect(selected).toEqual([]);
  });
});
