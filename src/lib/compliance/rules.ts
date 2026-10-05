import { RulesetVersion } from './types';

export const CANONICAL_RULESETS: RulesetVersion[] = [
  {
    id: 'ftc-16-cfr-323-2021',
    jurisdiction: 'FEDERAL_FTC',
    authority: 'Federal Trade Commission',
    citation: '16 CFR Part 323 (Made in USA Labeling Rule)',
    version: '2021.1',
    effectiveFrom: '2021-08-13T00:00:00Z',
    ruleType: 'ALL_OR_VIRTUALLY_ALL',
    parameters: {
      unqualifiedThresholdPercent: 90.0, // metadata only; not an FTC legal test
      historicalReferenceThresholdPercent: 75.0, // Historical reference only; not a permission threshold
      requireFinalAssemblyInUs: true,
      requireSubstantialTransformation: true,
    },
    sourceUrl: 'https://www.ftc.gov/made-in-usa-rule',
    sourceHash: 'sha256:ftc16cfr323authichaincanonical2021',
    retrievedAt: new Date().toISOString(),
    status: 'ACTIVE',
  },
  {
    id: 'customs-us-origin-19-cfr',
    jurisdiction: 'FEDERAL_CUSTOMS',
    authority: 'U.S. Customs and Border Protection',
    citation: '19 CFR Part 134 / Country of Origin Marking',
    version: '2026.1',
    effectiveFrom: '2026-01-01T00:00:00Z',
    ruleType: 'SUBSTANTIAL_TRANSFORMATION',
    parameters: {
      unqualifiedThresholdPercent: 100.0,
      requireFinalAssemblyInUs: true,
      requireSubstantialTransformation: true,
    },
    sourceUrl: 'https://www.cbp.gov/trade/rulings',
    sourceHash: 'sha256:cbp19cfroriginmarking2026',
    retrievedAt: new Date().toISOString(),
    status: 'ACTIVE',
  },
  {
    id: 'california-bpc-17533.7',
    jurisdiction: 'CALIFORNIA',
    authority: 'State of California',
    citation: 'California Business and Professions Code Section 17533.7',
    version: '2026.1',
    effectiveFrom: '2026-01-01T00:00:00Z',
    ruleType: 'STRICT_DOMESTIC_ORIGIN',
    parameters: {
      unqualifiedThresholdPercent: 100.0, // California historically required 100% US components (with minor exceptions)
      allowDeMinimisForeignParts: true,
      deMinimisForeignThresholdPercent: 5.0,
      requireFinalAssemblyInUs: true,
      requireSubstantialTransformation: true,
    },
    sourceUrl: 'https://leginfo.legislature.ca.gov/',
    sourceHash: 'sha256:californiabpc1753372026',
    retrievedAt: new Date().toISOString(),
    status: 'ACTIVE',
  },
];

export class UnknownComplianceRulesetError extends Error {
  constructor(public readonly requested: string) {
    super(`Unknown compliance jurisdiction: ${requested}`);
    this.name = "UnknownComplianceRulesetError";
  }
}

export function getRuleset(idOrJurisdiction: string): RulesetVersion {
  const found = CANONICAL_RULESETS.find(
    (r) => r.id === idOrJurisdiction || r.jurisdiction === idOrJurisdiction
  );
  if (!found) {
    throw new UnknownComplianceRulesetError(idOrJurisdiction);
  }
  return found;
}
