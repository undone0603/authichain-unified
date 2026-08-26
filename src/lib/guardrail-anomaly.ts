import { gte, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { guardrailChannels, guardrailEvents, guardrailCounters } from '@/db/schema';
import { toggleKillSwitch, recordEvent } from './guardrail';

export type AnomalyTrip = { channel: string; reason: string };

const BOUNCE_RATE_THRESHOLD = 0.10;
const VOLUME_SPIKE_MULTIPLIER = 3;
const MIN_SAMPLE_SIZE = 10;

/**
 * Scans the last 24h of guardrail_events per enabled channel and auto-trips
 * that channel's kill switch if the bounce/complaint rate is too high or
 * volume has spiked far above its trailing 7-day average. This is the
 * substitute for per-action human approval: the system polices itself and
 * only surfaces to the owner (via the digest) once something has already
 * been stopped.
 */
export async function evaluateAnomalies(now: Date = new Date()): Promise<AnomalyTrip[]> {
  const trips: AnomalyTrip[] = [];
  const channels = await db.select().from(guardrailChannels).where(eq(guardrailChannels.enabled, true));

  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const channel of channels) {
    const events = await db
      .select()
      .from(guardrailEvents)
      .where(and(eq(guardrailEvents.channelId, channel.id), gte(guardrailEvents.createdAt, since24h)));

    const sendEvents = events.filter((e) => e.action === 'record');
    const bounced = sendEvents.filter((e) => (e.metadata as Record<string, unknown> | null)?.bounced === true);
    if (sendEvents.length >= MIN_SAMPLE_SIZE && bounced.length / sendEvents.length > BOUNCE_RATE_THRESHOLD) {
      const reason = `bounce rate ${(100 * bounced.length / sendEvents.length).toFixed(1)}% over ${sendEvents.length} sends in 24h`;
      await toggleKillSwitch(channel.name, true, reason, 'system');
      await recordEvent({ channel: channel.name, action: 'kill_toggle', allowed: false, reason });
      trips.push({ channel: channel.name, reason });
      continue;
    }

    const counters = await db
      .select()
      .from(guardrailCounters)
      .where(eq(guardrailCounters.channelId, channel.id));

    const todayStr = now.toISOString().slice(0, 10);
    const dateToStr = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10));
    const dateToTime = (d: Date | string) => (typeof d === 'string' ? new Date(d).getTime() : d.getTime());
    const last7 = counters.filter((c) => {
      const dayStr = dateToStr(c.day);
      const dayTime = dateToTime(c.day);
      return dayStr !== todayStr && dayTime >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
    });
    const trailingAvg = last7.length ? last7.reduce((sum, c) => sum + c.count, 0) / last7.length : 0;
    const todayCount = counters.find((c) => dateToStr(c.day) === todayStr)?.count ?? 0;

    if (trailingAvg > 0 && todayCount > trailingAvg * VOLUME_SPIKE_MULTIPLIER) {
      const reason = `volume spike: ${todayCount} today vs ${trailingAvg.toFixed(1)} trailing 7-day average`;
      await toggleKillSwitch(channel.name, true, reason, 'system');
      await recordEvent({ channel: channel.name, action: 'kill_toggle', allowed: false, reason });
      trips.push({ channel: channel.name, reason });
    }
  }

  return trips;
}
