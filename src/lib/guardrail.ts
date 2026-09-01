  import { db } from '@/db';
  import { guardrailChannels,guardrailEvents,killSwitches,suppressionList } from '@/db/schema';
  import { eq,sql } from 'drizzle-orm';

export type CheckResult = { allowed: boolean; remaining: number; reason?: string };

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically checks every guardrail gate (global kill switch, channel kill
 * switch, channel enabled, suppression, daily cap) and reserves `count`
 * units of the channel's daily cap if allowed. The cap check and increment
 * happen in the same UPDATE statement (`count + n <= dailyCap`), which
 * Postgres evaluates and applies under a single row lock — two concurrent
 * calls against a near-exhausted cap can't both succeed.
 */
export async function checkAndReserve(
  channelName: string,
  count = 1,
  recipient?: string,
): Promise<CheckResult> {
  const [globalKill] = await db.select().from(killSwitches).where(eq(killSwitches.scope, 'global')).limit(1);
  if (globalKill?.enabled) {
    return { allowed: false, remaining: 0, reason: 'global kill switch engaged' };
  }

  if (!Number.isInteger(count) || count < 1) {
    return { allowed: false, remaining: 0, reason: 'invalid count' };
  }

  const [channel] = await db.select().from(guardrailChannels).where(eq(guardrailChannels.name, channelName)).limit(1);
  if (!channel) {
    return { allowed: false, remaining: 0, reason: `unknown channel: ${channelName}` };
  }
  if (!channel.enabled) {
    return { allowed: false, remaining: 0, reason: 'channel disabled' };
  }

  const [channelKill] = await db.select().from(killSwitches).where(eq(killSwitches.scope, channelName)).limit(1);
  if (channelKill?.enabled) {
    return { allowed: false, remaining: 0, reason: `channel kill switch engaged: ${channelKill.reason ?? 'no reason given'}` };
  }

  if (recipient) {
    const [suppressed] = await db.select().from(suppressionList).where(eq(suppressionList.email, recipient.toLowerCase())).limit(1);
    if (suppressed) {
      return { allowed: false, remaining: 0, reason: `recipient suppressed: ${suppressed.reason}` };
    }
  }

  if (count > channel.dailyCap) {
    return { allowed: false, remaining: 0, reason: 'requested count exceeds daily cap' };
  }

  const today = todayUtc();
  await db.execute(sql`
    INSERT INTO guardrail_counters (channel_id, day, count)
    VALUES (${channel.id}, ${today}, 0)
    ON CONFLICT (channel_id, day) DO NOTHING
  `);
  const updated = await db.execute(sql`
    UPDATE guardrail_counters
    SET count = count + ${count}
    WHERE channel_id = ${channel.id} AND day = ${today} AND count + ${count} <= ${channel.dailyCap}
    RETURNING count
  `);
  const rows = updated as unknown as Array<{ count: number }>;
  if (!rows.length) {
    return { allowed: false, remaining: 0, reason: 'daily cap reached' };
  }
  return { allowed: true, remaining: channel.dailyCap - rows[0].count };
}

export async function recordEvent(input: {
  channel: string;
  action: 'check' | 'record' | 'suppress' | 'kill_toggle';
  allowed?: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const [channel] = await db.select().from(guardrailChannels).where(eq(guardrailChannels.name, input.channel)).limit(1);
  await db.insert(guardrailEvents).values({
    channelId: channel?.id ?? null,
    action: input.action,
    allowed: input.allowed ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function addSuppression(email: string, reason: string, source: string): Promise<void> {
  await db
    .insert(suppressionList)
    .values({ email: email.toLowerCase(), reason, source })
    .onConflictDoNothing({ target: suppressionList.email });
}

export async function toggleKillSwitch(scope: string, enabled: boolean, reason: string, updatedBy: string): Promise<void> {
  await db
    .insert(killSwitches)
    .values({ scope, enabled, reason, updatedBy })
    .onConflictDoUpdate({
      target: killSwitches.scope,
      set: { enabled, reason, updatedBy, updatedAt: new Date() },
    });
}
