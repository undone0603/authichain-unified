import { describe, it, expect, vi } from 'vitest';

// The module imports the LLM client at load time; the fallback selector under
// test never calls it, but the import must not reach out to a provider.
vi.mock('../_core/llm.js', () => ({
  invokeLLM: vi.fn(),
  parseLLMContent: vi.fn(),
}));

import { selectFallbackBundle } from './multiplier';

/**
 * Verbatim from generate_ecosystem_bundles.ts. These are the exact strings the
 * ecosystem job passes in, and they are the reason this test exists: every one
 * of them names its domain without a scheme, which the old URL-only parser
 * could not see. All three fell through to the generic AuthiChain bundle, so a
 * StrainChain announcement went out as MedTech ISO 13485 copy.
 */
const ECOSYSTEM_ANNOUNCEMENTS = {
  'qron.space':
    "QRON.space launches 'Dimensional Gateways'—AI-powered cinematic identity for physical products. Every gateway is cryptographically signed and anchored to the AuthiChain Protocol.",
  'strainchain.io':
    "StrainChain.io is now the automated 'Truth Layer' for Michigan cannabis. Our new background job automatically anchors METRC manifests to Bitcoin L1, providing cultivators with an immutable 'Proof of Purity' certificate for every package tag.",
  'govchain.us':
    "GovChain.us achieves 'Sovereign Document' status. With our newly verified CAGE Code 1PUJ6, we are deploying W3C Verifiable Credentials for federal and defense supply chains.",
};

/** The only domains this project is allowed to advertise. */
const ALLOWED_DOMAINS = new Set(['authichain.com', 'qron.space', 'govchain.us', 'strainchain.io']);

function bundleStrings(bundle: ReturnType<typeof selectFallbackBundle>['bundle']): string[] {
  return [bundle.linkedin, bundle.reddit.title, bundle.reddit.body, ...bundle.twitter];
}

const ALL_BUNDLE_IDS = [...Object.keys(ECOSYSTEM_ANNOUNCEMENTS), 'default'];

function bundleById(id: string) {
  if (id === 'default') return selectFallbackBundle('An announcement naming no domain at all.').bundle;
  return selectFallbackBundle(ECOSYSTEM_ANNOUNCEMENTS[id as keyof typeof ECOSYSTEM_ANNOUNCEMENTS]).bundle;
}

describe('selectFallbackBundle — vertical routing', () => {
  it.each(Object.entries(ECOSYSTEM_ANNOUNCEMENTS))(
    'routes the bare-domain %s announcement to its own bundle',
    (domain, announcement) => {
      expect(selectFallbackBundle(announcement).id).toBe(domain);
    },
  );

  it('still routes announcements that use a full URL', () => {
    expect(selectFallbackBundle('Live now at https://qron.space/studio — go build one.').id).toBe('qron.space');
  });

  it('ignores www. and casing', () => {
    expect(selectFallbackBundle('Read more at WWW.GovChain.US today.').id).toBe('govchain.us');
  });

  it('falls back to the default bundle when no known domain is named', () => {
    expect(selectFallbackBundle('A generic announcement with no domain in it.').id).toBe('default');
  });

  it('does not match a lookalike domain', () => {
    // The whole token is compared, so a longer label can never match a shorter
    // known domain by suffix.
    expect(selectFallbackBundle('Buy now at evil-qron.space for cheap!').id).toBe('default');
    expect(selectFallbackBundle('Totally legit: notgovchain.us').id).toBe('default');
  });

  it('resolves a multi-domain announcement deterministically by precedence', () => {
    const both = 'qron.space and strainchain.io both shipped today.';
    expect(selectFallbackBundle(both).id).toBe('qron.space');
    expect(selectFallbackBundle(both).id).toBe(selectFallbackBundle(both).id);
  });
});

describe('fallback bundle copy is publishable', () => {
  it.each(ALL_BUNDLE_IDS)('%s: links only to domains this project owns', (id) => {
    // Mirrors the tokenizer in multiplier.ts: an alphabetic TLD is required so
    // "Apache-2.0" is not mistaken for a link.
    const DOMAIN_TOKEN = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}/gi;
    for (const text of bundleStrings(bundleById(id))) {
      for (const token of text.match(DOMAIN_TOKEN) ?? []) {
        expect(ALLOWED_DOMAINS, `"${token}" in the ${id} bundle`).toContain(token.toLowerCase());
      }
    }
  });

  it.each(ALL_BUNDLE_IDS)('%s: does not link to the non-existent ROI calculator', (id) => {
    // authichain.com/roi-calculator exists only in the legacy wouter SPA. The
    // worker serving authichain.com has no handler for it, so the path silently
    // renders the marketing homepage — a CTA promising a calculator that isn't
    // there.
    for (const text of bundleStrings(bundleById(id))) {
      expect(text).not.toContain('roi-calculator');
    }
  });

  it.each(ALL_BUNDLE_IDS)('%s: quotes no unsourced statistic', (id) => {
    for (const text of bundleStrings(bundleById(id))) {
      expect(text, 'percentage claim').not.toMatch(/\d+\s*%/);
      expect(text, 'dollar claim').not.toMatch(/\$\s*\d/);
    }
  });

  it.each(ALL_BUNDLE_IDS)('%s: claims no certification the project does not hold', (id) => {
    // FIPS 140-2 names a NIST CMVP-validated cryptographic module. There is no
    // such validation here (server/govchain/vc-service.ts still has the proof
    // step stubbed), and it is the single most checkable claim we could put in
    // front of a federal buyer.
    for (const text of bundleStrings(bundleById(id))) {
      expect(text).not.toMatch(/FIPS|SOC\s*2|ISO\s*27001/i);
    }
  });

  it.each(ALL_BUNDLE_IDS)('%s: discloses affiliation in the Reddit body', (id) => {
    // Posted by automation, so an undisclosed first-person post is astroturfing
    // and breaks both r/supplychain and r/blockchain self-promotion rules.
    expect(bundleById(id).reddit.body).toMatch(/Disclosure: I work on this/);
  });

  it.each(ALL_BUNDLE_IDS)('%s: is a well-formed three-tweet thread', (id) => {
    const { twitter } = bundleById(id);
    expect(twitter).toHaveLength(3);
    for (const tweet of twitter) {
      expect(tweet.length, `"${tweet}"`).toBeLessThanOrEqual(280);
    }
  });
});
