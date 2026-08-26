import timeline from '../../content/dpp/regulatory-timeline.json';

/**
 * Live regulatory timeline for /digital-product-passport.
 *
 * The page previously hardcoded its dates in JSX — "Battery Mandate: Feb 2027 —
 * 7 months to compliance" and "the registry opens July 19, 2026". Both went
 * stale on their own: by August 2026 the registry had already opened and the
 * battery deadline was six months out, not seven. A countdown that is written
 * by hand is wrong on every day except the one it was written.
 *
 * Everything here derives from `content/dpp/regulatory-timeline.json` and the
 * current date, so the page cannot drift. `now` is always an explicit argument
 * so the behaviour is testable at any point in time and the tests never expire.
 */

export type Precision = 'day' | 'month' | 'quarter' | 'year';

export type Milestone = {
  id: string;
  /** ISO yyyy-mm-dd. For ranged entries this is the start. */
  date: string;
  /** ISO yyyy-mm-dd. Present only for ranged entries. */
  endDate?: string;
  precision: Precision;
  label: string;
  detail: string;
  /** A URL a reader can check. Every milestone must carry one. */
  source: string;
  urgent?: boolean;
};

/** `in-force` once the date has passed; `imminent` within a year; else `upcoming`. */
export type MilestoneStatus = 'in-force' | 'imminent' | 'upcoming';

export const IMMINENT_MONTHS = 12;

export function listMilestones(): Milestone[] {
  return [...(timeline.milestones as Milestone[])].sort((a, b) => a.date.localeCompare(b.date));
}

export function timelineUpdatedAt(): string {
  return timeline.updated;
}

/** Parsed as UTC so a viewer's timezone can never shift a milestone by a day. */
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/**
 * Whole months from `now` until `iso`. Negative once the date has passed.
 * Counts a month only when the day-of-month has also been reached, so a
 * deadline 30 days out never reads as "1 month" when it is really weeks.
 */
export function monthsUntil(iso: string, now: Date): number {
  const target = parseISO(iso);
  let months =
    (target.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (target.getUTCMonth() - now.getUTCMonth());
  if (target.getUTCDate() < now.getUTCDate()) months -= 1;
  return months;
}

export function daysUntil(iso: string, now: Date): number {
  const ms = parseISO(iso).getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round(ms / 86_400_000);
}

export function milestoneStatus(m: Milestone, now: Date): MilestoneStatus {
  const days = daysUntil(m.date, now);
  if (days <= 0) return 'in-force';
  return monthsUntil(m.date, now) < IMMINENT_MONTHS ? 'imminent' : 'upcoming';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Renders at the precision the regulation actually specifies — never invents a day. */
export function formatMilestoneDate(m: Milestone): string {
  const d = parseISO(m.date);
  const year = d.getUTCFullYear();
  switch (m.precision) {
    case 'day':
      return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${year}`;
    case 'month':
      return `${MONTHS[d.getUTCMonth()]} ${year}`;
    case 'quarter': {
      const endYear = m.endDate ? parseISO(m.endDate).getUTCFullYear() : year;
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      const endQ = m.endDate ? Math.floor(parseISO(m.endDate).getUTCMonth() / 3) + 1 : q;
      return q === endQ && year === endYear ? `Q${q} ${year}` : `Q${q}–Q${endQ} ${year}`;
    }
    case 'year': {
      const endYear = m.endDate ? parseISO(m.endDate).getUTCFullYear() : year;
      return endYear === year ? `${year}` : `${year}–${endYear}`;
    }
  }
}

/**
 * The live phrase shown beside a milestone. Past tense once the date lands, so
 * the page stops advertising a deadline it has already crossed.
 */
export function countdownLabel(m: Milestone, now: Date): string {
  const status = milestoneStatus(m, now);
  if (status === 'in-force') return `In force since ${formatMilestoneDate(m)}`;

  const days = daysUntil(m.date, now);
  if (days <= 31) return days === 1 ? '1 day to comply' : `${days} days to comply`;

  const months = monthsUntil(m.date, now);
  if (months < 12) return months === 1 ? '1 month to comply' : `${months} months to comply`;

  const years = Math.floor(months / 12);
  return years === 1 ? 'Over a year out' : `About ${years} years out`;
}

/** The next milestone still ahead — what the page should lead its urgency with. */
export function nextDeadline(now: Date): Milestone | null {
  return listMilestones().find((m) => milestoneStatus(m, now) !== 'in-force') ?? null;
}

/** The most recent milestone already in force, for "registry is live" messaging. */
export function mostRecentInForce(now: Date): Milestone | null {
  const past = listMilestones().filter((m) => milestoneStatus(m, now) === 'in-force');
  return past.length ? past[past.length - 1] : null;
}
