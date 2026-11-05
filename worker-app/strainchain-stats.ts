/**
 * Public StrainChain aggregate statistics. No customer records are returned.
 * One bounded count query per event, plus the most recent event timestamp.
 * A missing/error count is UNKNOWN: never silently display zero.
 *
 * This is a pure adapter so callers can test it without Supabase credentials.
 */
export const CHAIN_EVENT_TYPES = [
  'cultivated',
  'harvested',
  'lab_tested',
  'packaged',
  'transferred',
  'dispensary_received',
] as const;
export const ALL_COUNT_TYPES = [...CHAIN_EVENT_TYPES, 'registered'] as const;

type CountResult = { count?: number | null; error?: unknown };
type LatestResult = { data?: { occurred_at?: string | null } | null; error?: unknown };

export async function collectStrainchainStats(
  countFor: (eventType: string) => Promise<CountResult>,
  latestEvent: () => Promise<LatestResult>,
) {
  const [counts, latest] = await Promise.all([
    Promise.all(ALL_COUNT_TYPES.map(type => countFor(type))),
    latestEvent(),
  ]);
  if (!latest || latest.error != null || !Object.hasOwn(latest, 'data')) throw new Error('latest_event_failed');
  const tally: Record<string, number> = {};
  for (let i = 0; i < ALL_COUNT_TYPES.length; i++) {
    const result = counts[i];
    if (result?.error != null || typeof result?.count !== 'number' || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error('event_count_unavailable');
    }
    tally[ALL_COUNT_TYPES[i]] = result.count as number;
  }
  const reportedTime = latest?.data?.occurred_at ?? null;
  if (reportedTime !== null && typeof reportedTime !== 'string') {
    throw new Error('invalid_last_event_time');
  }
  const total = CHAIN_EVENT_TYPES.reduce((sum, type) => sum + tally[type], 0);
  if (!Number.isSafeInteger(total)) throw new Error('total_count_unavailable');
  return {
    lab_tests: tally.lab_tested,
    batches_cultivated: tally.cultivated,
    batches_harvested: tally.harvested,
    batches_packaged: tally.packaged,
    dispensary_receipts: tally.dispensary_received,
    batches_registered: tally.registered,
    total_chain_events: total,
    last_event_at: reportedTime,
  };
}
