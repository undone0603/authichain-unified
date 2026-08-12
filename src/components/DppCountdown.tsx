'use client';

import { countdownLabel, timelineUpdatedAt, type Milestone } from '@/lib/dpp-timeline';
import { useNow } from '@/lib/use-now';

/**
 * A milestone's countdown, computed against the viewer's current date.
 *
 * This page is statically prerendered and cached, so a countdown baked in at
 * build time would be frozen at whenever the cache was filled — the exact
 * staleness this replaced ("7 months to compliance", true the day it was
 * written and wrong every day after). `useNow` renders a date-agnostic pass on
 * the server and takes over with the real date at hydration.
 */
export function DppCountdown({ milestone }: { milestone: Milestone }) {
  const now = useNow(timelineUpdatedAt());
  return <span suppressHydrationWarning>{countdownLabel(milestone, now)}</span>;
}
