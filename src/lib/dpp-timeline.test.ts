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
  isIndicative,
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
      // Only an indicative entry may omit its date; it must never invent one.
      if (!m.date) expect(m.indicative, m.id).toBe(true);
      else expect(m.date, m.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.label, m.id).toBeTruthy();
      expect(m.detail, m.id).toBeTruthy();
      expect(m.source, m.id).toMatch(/^https:\/\//);
      if (m.endDate) expect(m.endDate.localeCompare(m.date!)).toBeGreaterThan(0);
    }
  });

  it('is sorted chronologically, undated indicative entries last', () => {
    const list = listMilestones();
    const dates = list.filter((m) => m.date).map((m) => m.date!);
    expect(dates).toEqual([...dates].sort());
    const firstUndated = list.findIndex((m) => !m.date);
    if (firstUndated !== -1) expect(list.slice(firstUndated).every((m) => !m.date)).toBe(true);
  });

  it('dates indicative ESPR entries only by their cited adoption year (COM(2025) 187)', () => {
    const byId = (id: string) => listMilestones().find((m) => m.id === id)!;
    expect(byId('textiles')).toMatchObject({ date: '2027-01-01', precision: 'year', indicative: true });
    expect(byId('textiles').endDate).toBeUndefined();
    expect(byId('construction')).toMatchObject({ date: '2028-01-01', precision: 'year', indicative: true });
    expect(byId('construction').endDate).toBeUndefined();
    // Electronics: no adopted act and no source year, so no date at all.
    expect(byId('electronics').date).toBeUndefined();
    expect(byId('electronics').endDate).toBeUndefined();
    expect(byId('electronics').indicative).toBe(true);
  });

  it('flags every entry whose label says indicative as indicative', () => {
    // A label reading "(indicative)" without indicative: true would be counted
    // down and later badged "In force" once its date passes.
    for (const m of listMilestones()) {
      if (/indicative/i.test(m.label)) expect(m.indicative, m.id).toBe(true);
    }
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
    const distant: Milestone = { id: 'x', date: '2029-06-01', precision: 'day', label: 'x', detail: 'x', source: 'https://example.org' };
    expect(milestoneStatus(distant, AUG_2026)).toBe('upcoming');
  });

  it('never marks an indicative entry in force or imminent, even after its year', () => {
    for (const m of listMilestones().filter(isIndicative)) {
      for (const now of [AUG_2026, MAR_2027, new Date(Date.UTC(2027, 6, 2)), new Date(Date.UTC(2031, 0, 1))]) {
        expect(milestoneStatus(m, now), m.id).toBe('upcoming');
      }
    }
  });

  it('flips to in-force on the day the deadline lands', () => {
    expect(milestoneStatus(battery(), new Date(Date.UTC(2027, 1, 18)))).toBe('in-force');
    expect(milestoneStatus(battery(), new Date(Date.UTC(2027, 1, 17)))).toBe('imminent');
  });
});

describe('formatMilestoneDate', () => {
  it('renders day precision', () => {
    expect(formatMilestoneDate(battery())).toBe('Feb 18, 2027');
  });

  it('renders month precision', () => {
    expect(formatMilestoneDate(registry())).toBe('Jul 2026');
  });

  it('renders a quarter range', () => {
    const q: Milestone = { id: 'q', date: '2027-07-01', endDate: '2027-12-31', precision: 'quarter', label: 'q', detail: 'q', source: 'https://example.org' };
    expect(formatMilestoneDate(q)).toBe('Q3–Q4 2027');
  });

  it('renders a year range', () => {
    const y: Milestone = { id: 'y', date: '2028-01-01', endDate: '2029-12-31', precision: 'year', label: 'y', detail: 'y', source: 'https://example.org' };
    expect(formatMilestoneDate(y)).toBe('2028–2029');
  });

  it('renders indicative entries as an adoption year, or no date', () => {
    const byId = (id: string) => listMilestones().find((m) => m.id === id)!;
    expect(formatMilestoneDate(byId('textiles'))).toBe('2027 (indicative adoption)');
    expect(formatMilestoneDate(byId('construction'))).toBe('2028 (indicative adoption)');
    expect(formatMilestoneDate(byId('electronics'))).toBe('No date set (indicative)');
  });
});

describe('countdownLabel', () => {
  it('reads past tense once the milestone is in force', () => {
    expect(countdownLabel(registry(), AUG_2026)).toBe('In force since Jul 2026');
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
    const distant: Milestone = { id: 'd', date: '2029-06-01', precision: 'year', label: 'd', detail: 'd', source: 'https://example.org' };
    expect(countdownLabel(distant, AUG_2026)).toMatch(/years out/);
  });

  it('never counts down to an indicative entry', () => {
    for (const m of listMilestones().filter(isIndicative)) {
      expect(countdownLabel(m, AUG_2026), m.id).toBe('Indicative, no deadline set');
      expect(countdownLabel(m, new Date(Date.UTC(2028, 5, 1))), m.id).not.toMatch(/to comply|In force/);
    }
  });
});

describe('nextDeadline / mostRecentInForce', () => {
  it('leads with the battery mandate in Aug 2026', () => {
    expect(nextDeadline(AUG_2026)?.id).toBe('batteries');
  });

  it('moves on once the battery mandate lands, never to an indicative entry', () => {
    // Indicative ESPR entries are not deadlines: once batteries are in force
    // there is no next legal deadline in the data, so callers show their
    // "no deadline" fallback instead of "N months to comply".
    const next = nextDeadline(MAR_2027);
    expect(next === null || !isIndicative(next)).toBe(true);
    expect(next).toBeNull();
    expect(mostRecentInForce(MAR_2027)?.id).toBe('batteries');
  });

  it('runs past 18 Feb 2027 and 1 Jul 2027 without an indicative deadline or in-force badge', () => {
    const days = [
      new Date(Date.UTC(2027, 1, 18)), // battery mandate day
      new Date(Date.UTC(2027, 1, 19)),
      new Date(Date.UTC(2027, 6, 1)), // old electronics start date
      new Date(Date.UTC(2027, 6, 2)),
      new Date(Date.UTC(2028, 0, 2)),
      new Date(Date.UTC(2030, 11, 31)),
    ];
    for (const now of days) {
      const next = nextDeadline(now);
      if (next) expect(isIndicative(next), now.toISOString()).toBe(false);
      const live = mostRecentInForce(now);
      expect(live?.id, now.toISOString()).toBe('batteries');
      for (const m of listMilestones().filter(isIndicative)) {
        expect(milestoneStatus(m, now)).not.toBe('in-force');
      }
    }
    // The day before the mandate, batteries is still the next deadline.
    expect(nextDeadline(new Date(Date.UTC(2027, 1, 17)))?.id).toBe('batteries');
  });

  it('reports the registry as the live milestone in Aug 2026', () => {
    expect(mostRecentInForce(AUG_2026)?.id).toBe('central-registry');
  });
});
