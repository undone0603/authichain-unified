import { describe, it, expect } from 'vitest';
import { listSeoPages, listSeoSlugs, getSeoPageBySlug } from './seo-pages';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

describe('seo-pages loader', () => {
  it('loads committed pages with required fields', () => {
    const pages = listSeoPages();
    expect(pages.length).toBeGreaterThan(0);
    for (const p of pages) {
      expect(p.slug).toBeTruthy();
      expect(p.title.length).toBeLessThanOrEqual(60);
      expect(p.metaDescription.length).toBeLessThanOrEqual(160);
      expect(p.bodyHtml).not.toContain('<script');
      const jsonLd: Record<string, unknown> = p.jsonLd;
      const graph = jsonLd['@graph'];
      const entity = Array.isArray(graph) ? asRecord(graph[0]) : jsonLd;
      // Article belongs here: two committed pages are explainers rather than
      // offerings ("What Is a Digital Product Passport?", "EU DPP Compliance
      // Checklist"). Typing editorial content as Product would be inaccurate
      // structured data, which search engines penalise — so the assertion
      // widens rather than the content changing to match it.
      expect(['Product', 'Service', 'Article']).toContain(entity?.['@type']);
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
