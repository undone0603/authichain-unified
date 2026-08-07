import { describe, it, expect } from 'vitest';
import { listSeoPages, listSeoSlugs, getSeoPageBySlug, listSeoPagesWithDb, getSeoPageBySlugWithDb } from './seo-pages';

// Minimal thenable query-builder stand-in: `await db.select().from(x)`
// resolves to `rows` directly, and `.where(eq(seoPages.slug, x)).limit(...)`
// actually filters `rows` by that slug — real filtering, not just returning
// whatever was seeded, so a broken/dropped WHERE clause fails these tests.
function fakeDb(rows: any[]) {
  const chain = {
    where: (cond: any) => {
      const value = cond.queryChunks[3].value;
      return { limit: async () => rows.filter((r) => r.slug === value) };
    },
    then: (resolve: (v: any[]) => void) => resolve(rows),
  };
  return { select: () => ({ from: () => chain }) } as any;
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
      const jsonLd = p.jsonLd as any;
      const graph = jsonLd['@graph'];
      const entity = Array.isArray(graph) ? graph[0] : jsonLd;
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

describe('*WithDb variants', () => {
  const dbRow = {
    slug: 'dscsa-compliance-software',
    keyword: 'dscsa compliance software',
    brand: 'AuthiChain',
    domain: 'authichain.com',
    title: 'DSCSA Compliance Software | AuthiChain',
    metaDescription: 'Meta.',
    h1: 'H1',
    bodyHtml: '<p>Body.</p>',
    jsonLd: { '@type': 'Product' },
  };

  it('listSeoPagesWithDb appends DB-backed pages to the static set', async () => {
    expect(listSeoSlugs()).not.toContain(dbRow.slug); // sanity: not already static
    const pages = await listSeoPagesWithDb(fakeDb([dbRow]));
    expect(pages.length).toBe(listSeoPages().length + 1);
    expect(pages.at(-1)).toEqual(expect.objectContaining({ slug: dbRow.slug, brand: 'AuthiChain' }));
  });

  it('getSeoPageBySlugWithDb prefers the static page when a slug exists in both', async () => {
    const staticSlug = listSeoSlugs()[0];
    const page = await getSeoPageBySlugWithDb(staticSlug, fakeDb([{ ...dbRow, slug: staticSlug }]));
    expect(page).toEqual(getSeoPageBySlug(staticSlug));
  });

  it('getSeoPageBySlugWithDb falls back to the DB row for a slug not in the static set', async () => {
    // Multiple rows in the table so a broken/dropped WHERE clause (returning
    // whatever's first) would fail this assertion instead of passing by luck.
    const otherRow = { ...dbRow, slug: 'other-keyword', h1: 'Other H1' };
    const page = await getSeoPageBySlugWithDb(dbRow.slug, fakeDb([otherRow, dbRow]));
    expect(page).toEqual(expect.objectContaining({ slug: dbRow.slug, h1: 'H1' }));
  });

  it('getSeoPageBySlugWithDb returns null when the slug is nowhere', async () => {
    const page = await getSeoPageBySlugWithDb('does-not-exist', fakeDb([]));
    expect(page).toBeNull();
  });
});
