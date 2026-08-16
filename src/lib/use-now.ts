'use client';

import { useSyncExternalStore } from 'react';

/**
 * The current date, as an external store.
 *
 * The clock is exactly what `useSyncExternalStore` is for: a value that lives
 * outside React, changes on its own, and must not be read during render on the
 * server. Reading it with `useState` + `useEffect` instead would either produce
 * a hydration mismatch or a synchronous setState inside an effect, and would
 * spin up one timer per component — this page renders a countdown per
 * milestone.
 *
 * Snapshots are bucketed to the hour so the value is referentially stable
 * between ticks; without that, every render would see a new number and React
 * would loop.
 *
 * `getServerSnapshot` returns a sentinel rather than a real time, so the
 * server-rendered HTML is date-agnostic. That matters because this page is
 * statically prerendered and cached: any date baked in at build time would be
 * frozen at whenever the cache was filled. Callers pass a fallback used for
 * that pass, and the real date takes over at hydration.
 */

const BUCKET_MS = 60 * 60 * 1000;
const SERVER_SENTINEL = 0;

let snapshot = bucket(Date.now());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function bucket(ms: number): number {
  return Math.floor(ms / BUCKET_MS) * BUCKET_MS;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!timer) {
    timer = setInterval(() => {
      const next = bucket(Date.now());
      if (next !== snapshot) {
        snapshot = next;
        listeners.forEach((l) => l());
      }
    }, 60_000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SENTINEL;

/**
 * @param fallbackISO yyyy-mm-dd used for the server pass and the first paint.
 *   Pass the date the content was last reviewed, so pre-hydration output is
 *   consistent with the copy rather than arbitrary.
 */
export function useNow(fallbackISO: string): Date {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms === SERVER_SENTINEL ? new Date(`${fallbackISO}T00:00:00Z`) : new Date(ms);
}
