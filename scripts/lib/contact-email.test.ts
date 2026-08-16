import { describe, it, expect } from 'vitest';
import { normalizeContactEmail } from './contact-email.ts';

describe('normalizeContactEmail', () => {
  it('rejects the slugified SAM.gov hierarchy addresses the engine used to fabricate', () => {
    // Verbatim from the leads table, source='gov_engine'.
    const fabricated = [
      'procurement@homeland-security,-department-of.us-coast-guard.hq-contract-operations-(cg-912)(000.gov',
      'procurement@dept-of-defense.defense-logistics-agency.dla-land.dla-land-warren-michigan.dla-land-warren.gov',
      'procurement@agriculture,-department-of.forest-service.usda-fs-pps-incident-procurement.gov',
    ];
    for (const email of fabricated) {
      expect(normalizeContactEmail(email)).toBeNull();
    }
  });

  it('accepts real agency contacts', () => {
    expect(normalizeContactEmail('jane.doe@gsa.gov')).toBe('jane.doe@gsa.gov');
    expect(normalizeContactEmail('contracting-officer@navy.mil')).toBe('contracting-officer@navy.mil');
    // Longest real domain currently in gov_opportunities (3 labels, 17 chars).
    expect(normalizeContactEmail('clerk@alnd.uscourts.gov')).toBe('clerk@alnd.uscourts.gov');
    expect(normalizeContactEmail('a@anl.gov')).toBe('a@anl.gov');
  });

  it('rejects domains deeper or longer than any real agency domain', () => {
    expect(normalizeContactEmail('a@one.two.three.four.five.gov')).toBeNull();
    expect(normalizeContactEmail(`a@${'x'.repeat(70)}.gov`)).toBeNull();
  });

  it('trims and lowercases before validating', () => {
    expect(normalizeContactEmail('  Jane.Doe@GSA.gov \n')).toBe('jane.doe@gsa.gov');
  });

  it('rejects empty, non-string and structurally invalid input', () => {
    expect(normalizeContactEmail(undefined)).toBeNull();
    expect(normalizeContactEmail(null)).toBeNull();
    expect(normalizeContactEmail(42)).toBeNull();
    expect(normalizeContactEmail('')).toBeNull();
    expect(normalizeContactEmail('   ')).toBeNull();
    expect(normalizeContactEmail('not-an-email')).toBeNull();
    expect(normalizeContactEmail('missing@tld')).toBeNull();
    expect(normalizeContactEmail('two@at@signs.gov')).toBeNull();
    expect(normalizeContactEmail('spaces in@local.gov')).toBeNull();
  });

  it('rejects domains with empty or hyphen-edged labels', () => {
    expect(normalizeContactEmail('a@foo..gov')).toBeNull();
    expect(normalizeContactEmail('a@-foo.gov')).toBeNull();
    expect(normalizeContactEmail('a@foo-.gov')).toBeNull();
  });
});
