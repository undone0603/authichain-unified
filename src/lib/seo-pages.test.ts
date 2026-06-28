import { describe, it, expect } from 'vitest';
import { listSeoPages, listSeoSlugs, getSeoPageBySlug } from './seo-pages';

describe('seo-pages loader', () => {
  it('loads committed pages with required fields', () => {
    const pages = listSeoPages();
    expect(pages.length).toBeGreaterThan(0);
    for (const p of pages) {
      expect(p.slug).toBeTruthy();
      expect(p.title.length).toBeLessThanOrEqual(60);
      expect(p.metaDescription.length).toBeLessThanOrEqual(160);
      expect(p.bodyHtml).not.toContain('<script');
      expect((p.jsonLd as any)['@type']).toBe('Product');
    }
  });

  it('has unique slugs', () => {
    const slugs = listSeoSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('getSeoPageBySlug returns a page or null', () => {
    const first = listSeoSlugs()[0];
    expect(getSeoPageBySlug(first)?.slug).toBe(first);
    expect(getSeoPageBySlug('does-not-exist')).toBeNull();
  });
});
