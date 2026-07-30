import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/require-admin';
import { db } from '@/db';
import { guardrailChannels, guardrailCounters, killSwitches, suppressionList, guardrailEvents } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { todayUtc } from '@/lib/guardrail';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const authResult = await requireAdmin(supabase);
  if (authResult instanceof NextResponse) return authResult;

  const today = todayUtc();
  const [channels, counters, switches, suppression, recentEvents] = await Promise.all([
    db.select().from(guardrailChannels),
    db.select().from(guardrailCounters),
    db.select().from(killSwitches),
    db.select().from(suppressionList),
    db.select().from(guardrailEvents).orderBy(desc(guardrailEvents.createdAt)).limit(100),
  ]);

  const todaysCounters = counters.filter((c) => String(c.day) === today);
  const channelStatus = channels.map((ch) => {
    const counter = todaysCounters.find((c) => c.channelId === ch.id);
    const killSwitch = switches.find((k) => k.scope === ch.name);
    return {
      name: ch.name,
      category: ch.category,
      enabled: ch.enabled,
      dailyCap: ch.dailyCap,
      usedToday: counter?.count ?? 0,
      killSwitchEngaged: killSwitch?.enabled ?? false,
      killSwitchReason: killSwitch?.reason ?? null,
    };
  });

  const globalKillSwitch = switches.find((k) => k.scope === 'global');

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    global_kill_switch: { engaged: globalKillSwitch?.enabled ?? false, reason: globalKillSwitch?.reason ?? null },
    channels: channelStatus,
    suppression_list_size: suppression.length,
    recent_events: recentEvents.map((e) => ({
      channel_id: e.channelId,
      action: e.action,
      allowed: e.allowed,
      reason: e.reason,
      at: e.createdAt,
    })),
  });
}
