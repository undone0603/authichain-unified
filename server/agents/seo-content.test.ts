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
vi.mock('../db.js', () => ({ logActivity: (...a: unknown[]) => logActivity(...a) }));

import { generateSeoPage, runProgrammaticSeoBatch, BRAND_SEO } from './seo-content';

beforeEach(() => {
  logActivity.mockClear();
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
    ]);
    expect(pages).toHaveLength(2);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'programmatic_seo_generated' }),
    );
  });

  it('isolates a single failed generation without aborting the batch', async () => {
    llm.throwOnce = true; // first generateSeoPage call throws
    const pages = await runProgrammaticSeoBatch([
      { brandKey: 'strainchain', keyword: 'fails' },
      { brandKey: 'qron', keyword: 'living qr art' },
    ]);
    expect(pages).toHaveLength(1);
    expect(pages[0].brand).toBe('QRON');
  });

  it('skips unknown brand keys', async () => {
    const pages = await runProgrammaticSeoBatch([
      { brandKey: 'nope' as any, keyword: 'x' },
    ]);
    expect(pages).toHaveLength(0);
  });
});
