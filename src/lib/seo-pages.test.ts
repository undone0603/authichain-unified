import { describe, it, expect } from 'vitest';
import { listSeoPages, listSeoSlugs, getSeoPageBySlug, listSeoPagesWithDb, getSeoPageBySlugWithDb } from './seo-pages';

// Minimal thenable query-builder stand-in: `await db.select().from(x)`
// resolves to `rows` directly, and `.where(...).limit(...)` narrows to the
// same `rows` (tests control what "matches" by passing the right rows in).
function fakeDb(rows: any[]) {
  const chain = {
    where: () => ({ limit: async () => rows }),
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
      expect(['Product', 'Service']).toContain(entity?.['@type']);
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
    const page = await getSeoPageBySlugWithDb(dbRow.slug, fakeDb([dbRow]));
    expect(page).toEqual(expect.objectContaining({ slug: dbRow.slug, h1: 'H1' }));
  });

  it('getSeoPageBySlugWithDb returns null when the slug is nowhere', async () => {
    const page = await getSeoPageBySlugWithDb('does-not-exist', fakeDb([]));
    expect(page).toBeNull();
  });
});
