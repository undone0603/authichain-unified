import { describe, it, expect } from 'vitest';
import {
  listMilestones,
  monthsUntil,
  daysUntil,
  milestoneStatus,
  formatMilestoneDate,
  countdownLabel,
  nextDeadline,
  mostRecentInForce,
  type Milestone,
} from './dpp-timeline';

/**
 * Every assertion pins an explicit `now`. Using the real clock would make this
 * suite expire — which is the same class of defect it exists to prevent.
 */

const AUG_2026 = new Date(Date.UTC(2026, 7, 12)); // the day the hardcoded copy was found wrong
const JAN_2027 = new Date(Date.UTC(2027, 0, 15));
const MAR_2027 = new Date(Date.UTC(2027, 2, 1));

const battery = (): Milestone => listMilestones().find((m) => m.id === 'batteries')!;
const registry = (): Milestone => listMilestones().find((m) => m.id === 'central-registry')!;

describe('data integrity', () => {
  it('every milestone has an ISO date, a label and a checkable source', () => {
    const milestones = listMilestones();
    expect(milestones.length).toBeGreaterThan(0);
    for (const m of milestones) {
      expect(m.date, m.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.label, m.id).toBeTruthy();
      expect(m.detail, m.id).toBeTruthy();
      expect(m.source, m.id).toMatch(/^https:\/\//);
      if (m.endDate) expect(m.endDate.localeCompare(m.date)).toBeGreaterThan(0);
    }
  });

  it('is sorted chronologically', () => {
    const dates = listMilestones().map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('has unique ids', () => {
    const ids = listMilestones().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('monthsUntil', () => {
  it('counts whole months only once the day-of-month is reached', () => {
    // 2026-08-12 → 2027-02-18 is six months and change, not seven. The page
    // said "7 months to compliance"; this is the assertion that pins it.
    expect(monthsUntil('2027-02-18', AUG_2026)).toBe(6);
  });

  it('does not round a partial month up', () => {
    // 2026-08-12 → 2026-09-05 has not reached the 12th of September.
    expect(monthsUntil('2026-09-05', AUG_2026)).toBe(0);
    expect(monthsUntil('2026-09-12', AUG_2026)).toBe(1);
  });

  it('goes negative once the date has passed', () => {
    expect(monthsUntil('2026-07-19', AUG_2026)).toBeLessThan(0);
  });
});

describe('daysUntil', () => {
  it('is zero on the day itself', () => {
    expect(daysUntil('2026-08-12', AUG_2026)).toBe(0);
  });

  it('counts forward and backward', () => {
    expect(daysUntil('2026-08-20', AUG_2026)).toBe(8);
    expect(daysUntil('2026-08-01', AUG_2026)).toBe(-11);
  });
});

describe('milestoneStatus', () => {
  it('marks a passed milestone in-force', () => {
    expect(milestoneStatus(registry(), AUG_2026)).toBe('in-force');
  });

  it('marks a milestone inside a year imminent', () => {
    expect(milestoneStatus(battery(), AUG_2026)).toBe('imminent');
  });

  it('marks a distant milestone upcoming', () => {
    const textiles = listMilestones().find((m) => m.id === 'textiles')!;
    expect(milestoneStatus(textiles, AUG_2026)).toBe('upcoming');
  });

  it('flips to in-force on the day the deadline lands', () => {
    expect(milestoneStatus(battery(), new Date(Date.UTC(2027, 1, 18)))).toBe('in-force');
    expect(milestoneStatus(battery(), new Date(Date.UTC(2027, 1, 17)))).toBe('imminent');
  });
});

describe('formatMilestoneDate', () => {
  it('renders day precision', () => {
    expect(formatMilestoneDate(registry())).toBe('Jul 19, 2026');
  });

  it('renders a quarter range', () => {
    const electronics = listMilestones().find((m) => m.id === 'electronics')!;
    expect(formatMilestoneDate(electronics)).toBe('Q3–Q4 2027');
  });

  it('renders a year range', () => {
    const textiles = listMilestones().find((m) => m.id === 'textiles')!;
    expect(formatMilestoneDate(textiles)).toBe('2028–2029');
  });
});

describe('countdownLabel', () => {
  it('reads past tense once the milestone is in force', () => {
    expect(countdownLabel(registry(), AUG_2026)).toBe('In force since Jul 19, 2026');
  });

  it('gives whole months at distance', () => {
    expect(countdownLabel(battery(), AUG_2026)).toBe('6 months to comply');
    expect(countdownLabel(battery(), JAN_2027)).toBe('1 month to comply');
  });

  it('switches to days inside a month', () => {
    expect(countdownLabel(battery(), new Date(Date.UTC(2027, 1, 4)))).toBe('14 days to comply');
  });

  it('singularises one day', () => {
    expect(countdownLabel(battery(), new Date(Date.UTC(2027, 1, 17)))).toBe('1 day to comply');
  });

  it('summarises distant milestones in years', () => {
    const construction = listMilestones().find((m) => m.id === 'construction')!;
    expect(countdownLabel(construction, AUG_2026)).toMatch(/years out/);
  });
});

describe('nextDeadline / mostRecentInForce', () => {
  it('leads with the battery mandate in Aug 2026', () => {
    expect(nextDeadline(AUG_2026)?.id).toBe('batteries');
  });

  it('moves on once the battery mandate lands', () => {
    expect(nextDeadline(MAR_2027)?.id).toBe('electronics');
    expect(mostRecentInForce(MAR_2027)?.id).toBe('batteries');
  });

  it('reports the registry as the live milestone in Aug 2026', () => {
    expect(mostRecentInForce(AUG_2026)?.id).toBe('central-registry');
  });
});
