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

const GENERATED_HOW_IT_WORKS =
  'Issue a unique identifier per unit, anchor its record on-chain for tamper-evidence';

// Mirrors scripts/gen-seo-pages.cjs PROTECTED_SEED_SLUGS — hand-authored pages
// that must not be rewritten when the generator runs.
const PROTECTED_SEED_SLUGS = new Set([
  'ai-qr-code-art-generator',
  'anti-counterfeit-qr-verification',
  'battery-passport-due-diligence-requirement',
  'biotrack-integration-blockchain-provenance',
  'blockchain-product-authentication',
  'cannabis-blockchain-provenance',
  'cannabis-coa-verification-blockchain',
  'counterfeit-detection-with-ai',
  'digital-product-passport-access-rights',
  'dispensary-qr-provenance-scanning',
  'dscsa-compliance-blockchain-serialization',
  'editable-qr-code-no-reprint',
  'eu-dpp-compliance-checklist',
  'government-document-verification-blockchain',
  'government-rfp-award-verification-blockchain',
  'living-qr-code-art-generator',
  'metrc-compliance-blockchain',
  'offline-permit-certificate-qr-verification',
  'partner-program',
  'ppwr-digital-labelling-qr-code',
  'sbir-svip-blockchain-document-verification',
  'untp-digital-product-passport',
  'w3c-verifiable-credentials-product-authentication',
  'what-is-a-digital-product-passport',
]);

const PROTECTED_SEED_MARKERS: Record<string, string> = {
  'blockchain-product-authentication': 'Built for every vertical',
  'cannabis-blockchain-provenance': 'What you get',
  'what-is-a-digital-product-passport': 'What a DPP contains',
};

describe('generated SEO money-path CTAs', () => {
  it('places a live checkout or pricing CTA after How it works and before FAQ', () => {
    const generated = listSeoPages().filter(
      (p) =>
        p.bodyHtml.includes(GENERATED_HOW_IT_WORKS) &&
        !PROTECTED_SEED_SLUGS.has(p.slug)
    );
    expect(generated.length).toBeGreaterThan(0);

    for (const p of generated) {
      const how = p.bodyHtml.indexOf('<h2>How it works</h2>');
      const cta = p.bodyHtml.indexOf('<h2>Get started</h2>');
      const faq = p.bodyHtml.indexOf('<h2>FAQ</h2>');
      expect(how).toBeGreaterThan(-1);
      expect(cta).toBeGreaterThan(how);
      expect(faq).toBeGreaterThan(cta);
    }
  });

  it('links AuthiChain DPP / battery / textiles hubs to live DPP checkout', () => {
    const batteries = getSeoPageBySlug('eu-digital-product-passport-batteries');
    const textiles = getSeoPageBySlug('eu-digital-product-passport-textiles');
    expect(batteries?.bodyHtml).toContain(
      'href="https://authichain.com/api/checkout/dpp"'
    );
    expect(textiles?.bodyHtml).toContain(
      'href="https://authichain.com/api/checkout/dpp"'
    );
    expect(batteries?.bodyHtml).toContain(
      'href="https://authichain.com/pricing"'
    );
  });

  it('links Made in USA / origin-claim hubs to DPP checkout and the Made in America brief', () => {
    const musa = getSeoPageBySlug('ftc-made-in-usa-labeling-verification');
    const origin = getSeoPageBySlug('made-in-america-origin-claim-substantiation');
    expect(musa?.bodyHtml).toContain(
      'href="https://authichain.com/api/checkout/dpp"'
    );
    expect(musa?.bodyHtml).toContain(
      'href="https://authichain.com/made-in-america"'
    );
    expect(origin?.bodyHtml).toContain(
      'href="https://authichain.com/api/checkout/dpp"'
    );
    expect(origin?.bodyHtml).toContain(
      'href="https://authichain.com/made-in-america"'
    );
  });

  it('links TruMark hubs to live passport checkout and the TruMark brief', () => {
    const trumark = getSeoPageBySlug('trumark-product-authentication-seal');
    expect(trumark?.bodyHtml).toContain(
      'href="https://authichain.com/api/checkout/plan/strainchain_passport"'
    );
    expect(trumark?.bodyHtml).toContain('href="https://authichain.com/trumark"');
  });

  it('links StrainChain cannabis hubs to live passport checkout and pricing', () => {
    const cannabis = getSeoPageBySlug('blockchain-qr-code-for-cannabis');
    expect(cannabis?.bodyHtml).toContain(
      'href="https://authichain.com/api/checkout/plan/strainchain_passport"'
    );
    expect(cannabis?.bodyHtml).toContain(
      'href="https://strainchain.io/pricing"'
    );
  });

  it('links QRON hubs to qron.space/pricing and GovChain hubs to live onboard', () => {
    const qron = getSeoPageBySlug('gs1-digital-link-sunrise-2027');
    const gov = getSeoPageBySlug(
      'product-authentication-for-government-supply-chain'
    );
    expect(qron?.bodyHtml).toContain('href="https://qron.space/pricing"');
    expect(qron?.bodyHtml).not.toContain('/api/checkout/');
    // govchain.us/pricing 404s; /onboard is the live conversion path
    expect(gov?.bodyHtml).toContain('href="https://govchain.us/onboard"');
    expect(gov?.bodyHtml).not.toContain('/api/checkout/');
  });

  it('does not rewrite hand-authored protected seed copy', () => {
    for (const slug of PROTECTED_SEED_SLUGS) {
      const page = getSeoPageBySlug(slug);
      expect(page, slug).toBeTruthy();
      expect(page?.bodyHtml).not.toContain('<h2>Get started</h2>');
    }
    for (const [slug, marker] of Object.entries(PROTECTED_SEED_MARKERS)) {
      expect(getSeoPageBySlug(slug)?.bodyHtml).toContain(marker);
    }
  });
});
