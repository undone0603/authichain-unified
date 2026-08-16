import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — plain .mjs module, no type declarations
import { validateBundle, REQUIRED_DISCLOSURE } from '../validate-social-bundle.mjs';

/**
 * This guardrail is the only thing standing between an autonomous content
 * Routine and a live post on LinkedIn, Reddit and X. These tests exist to prove
 * it actually rejects things — a validator nobody has watched fail is not a
 * safety mechanism.
 */

function goodBundle(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-08-13',
    slug: 'open-spec',
    linkedin:
      'AuthiChain has opened its verification protocol under Apache-2.0. The specification, reference verifier and conformance suite are public. Read it: authichain.com/protocol',
    reddit: {
      subreddit: 'supplychain',
      title: 'We open-sourced our provenance verification spec and conformance suite',
      body: `The spec and a zero-dependency reference verifier are Apache-2.0, patent grant included.\n\nauthichain.com/protocol\n\n${REQUIRED_DISCLOSURE}`,
    },
    twitter: [
      '1/ A verification you have to ask the vendor to perform is not verification.',
      '2/ Our spec, reference verifier and conformance suite are now Apache-2.0.',
      '3/ Run it against any implementation, including ours: authichain.com/protocol',
    ],
    ...overrides,
  };
}

describe('validateBundle — accepts publishable content', () => {
  it('passes a clean bundle', () => {
    expect(validateBundle(goodBundle())).toEqual([]);
  });
});

describe('validateBundle — rejects the claims that were actually going live', () => {
  // Every string below is copied from the hardcoded posts in
  // .github/workflows/marketing-autonomous.yml, which posted to LinkedIn and
  // Reddit weekly. If the validator stops catching these, it has regressed.
  const LIVE_VIOLATIONS: [string, string][] = [
    ['unsourced market size', 'The global counterfeit market hit $4.5 trillion in 2025.'],
    ['scannability guarantee', '100% scannable under real-world conditions'],
    ['unmeasured timing', 'Verification = QR scan. 2 seconds. No central server.'],
    ['nonexistent QR level', "We've pushed error-correction to L4 across artistic styles"],
    ['percentage claim', 'Clients see 25-40% more scans than standard codes.'],
    ['savings claim', 'Projected $400K+ savings in Year 1 recall risk.'],
  ];

  it.each(LIVE_VIOLATIONS)('rejects %s in the LinkedIn post', (_label, text) => {
    const failures = validateBundle(goodBundle({ linkedin: text }));
    expect(failures.length).toBeGreaterThan(0);
  });

  it('rejects a Reddit post with no affiliation disclosure', () => {
    const bundle = goodBundle();
    bundle.reddit.body = "I've been building a provenance verifier and would love feedback.";
    const failures = validateBundle(bundle);
    expect(failures.join(' ')).toContain('Disclosure');
  });
});

describe('validateBundle — certification claims', () => {
  it.each([
    ['SOC 2 Type II certified', /SOC 2/],
    ['ISO 27001 certified infrastructure', /ISO 27001/],
    ['FIPS 140-2 HSM crypto module', /CMVP/],
    ['Fully HIPAA-compliant records', /covered entity/],
    ['FedRAMP compliant cloud', /FedRAMP/],
    ['Our platform is FedRAMP-ready', /FedRAMP/],
    ['FedRAMP authorized deployment', /FedRAMP/],
    ['Government-grade security', /government claim/],
    ['Fully government compliant', /government claim/],
  ])('rejects %s', (text, expected) => {
    const failures = validateBundle(goodBundle({ linkedin: text }));
    expect(failures.join(' ')).toMatch(expected);
  });

  it('allows "ISO 27001 aligned", which is the honest form', () => {
    const failures = validateBundle(goodBundle({ linkedin: 'Key rotation is ISO 27001 aligned.' }));
    expect(failures).toEqual([]);
  });

  it('allows naming FedRAMP/NIST as requirements to evaluate — the honest form', () => {
    // The ban is on claiming an authorization, not on the words. The approved
    // prospect language names them as things scoped with the customer.
    const failures = validateBundle(
      goodBundle({ linkedin: 'For federal data we evaluate FedRAMP and NIST requirements with the customer.' }),
    );
    expect(failures).toEqual([]);
  });
});

describe('validateBundle — claims that are false, not merely unproven', () => {
  it('rejects calling Ed25519 quantum-resistant', () => {
    const failures = validateBundle(goodBundle({ linkedin: 'Ed25519 gives quantum-resistant security.' }));
    expect(failures.join(' ')).toContain('Shor');
  });
});

describe('validateBundle — links', () => {
  it('rejects a link to a domain we do not own', () => {
    const failures = validateBundle(goodBundle({ linkedin: 'Read more at evil-qron.space today.' }));
    expect(failures.join(' ')).toContain('not one of our domains');
  });

  it('rejects a link to a route that does not exist', () => {
    // The worker serving authichain.com has no /roi-calculator handler and
    // falls through to the homepage, so this silently misleads rather than 404s.
    const failures = validateBundle(goodBundle({ linkedin: 'Savings breakdown: authichain.com/roi-calculator' }));
    expect(failures.join(' ')).toContain('not a route that exists');
  });

  it('accepts real routes on the domain that actually has them', () => {
    expect(validateBundle(goodBundle({ linkedin: 'See authichain.com/protocol and authichain.com/anchor' }))).toEqual([]);
  });

  it('accepts the bare brand domains', () => {
    expect(validateBundle(goodBundle({ linkedin: 'Build one at qron.space or read govchain.us' }))).toEqual([]);
  });

  it.each(['qron.space/protocol', 'govchain.us/protocol', 'strainchain.io/book'])(
    'rejects %s — the path exists on authichain.com, not there',
    (link) => {
      // The brand workers handle only assets, sitemap.xml and robots.txt, then
      // fall through to the homepage. A deep link to one of them looks valid
      // and lands the reader on a generic page.
      const failures = validateBundle(goodBundle({ linkedin: `Read more: ${link}` }));
      expect(failures.join(' ')).toContain('not a route that exists on that domain');
    },
  );
});

describe('validateBundle — platform limits and shape', () => {
  it('rejects a tweet over 280 characters', () => {
    const bundle = goodBundle();
    bundle.twitter[1] = 'x'.repeat(281);
    expect(validateBundle(bundle).join(' ')).toContain('exceeds 280');
  });

  it('rejects a thread that is not exactly three tweets', () => {
    expect(validateBundle(goodBundle({ twitter: ['1/ only one'] })).join(' ')).toContain('exactly 3');
  });

  it('rejects a malformed subreddit', () => {
    const bundle = goodBundle();
    bundle.reddit.subreddit = 'r/supplychain';
    expect(validateBundle(bundle).join(' ')).toContain('subreddit');
  });

  it('rejects a bundle missing the LinkedIn post entirely', () => {
    expect(validateBundle(goodBundle({ linkedin: '' })).join(' ')).toContain('missing linkedin');
  });
});

describe('every committed bundle is publishable', () => {
  // This is the gate that matters operationally. Bundles are written by an
  // autonomous Routine and auto-merged, then posted with no human review, so
  // CI failing here is what stops a bad one from reaching LinkedIn.
  const dir = 'content/social';
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('.'))
    : [];

  it('the content/social directory is readable', () => {
    expect(Array.isArray(files)).toBe(true);
  });

  it.each(files.length ? files : [null])('%s passes validation', (file) => {
    if (file === null) return; // no bundles committed yet
    const bundle = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    expect(validateBundle(bundle, file)).toEqual([]);
  });
});
