import { describe, expect, it } from 'vitest';
import { deadlineState, normalizeProofBurden, scoreEligibility } from './engine';

describe('ClaimPilot engine', () => {
  it('maps proof burden deterministically', () => {
    expect(normalizeProofBurden('none')).toBe(0);
    expect(normalizeProofBurden('receipt')).toBe(2);
    expect(normalizeProofBurden('substantial')).toBe(4);
  });
  it('scores a nationwide no-proof match above the review threshold', () => {
    const result = scoreEligibility({ classDefinition: 'customers of Example Service nationwide', jurisdiction: 'nationwide', proofRequirement: 'none' }, { state: 'Michigan', subscriptions: ['Example Service'] });
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.proofBurden).toBe(0);
  });
  it('classifies deadlines without mutating dates', () => {
    const now = new Date('2026-09-15T12:00:00Z');
    expect(deadlineState('2026-09-16T12:00:00Z', now).state).toBe('critical');
    expect(deadlineState('2026-09-25T12:00:00Z', now).state).toBe('urgent');
    expect(deadlineState('2026-10-20T12:00:00Z', now).state).toBe('future');
  });
});
