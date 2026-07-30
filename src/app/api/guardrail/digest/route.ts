import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/require-internal-secret';
import { evaluateAnomalies } from '@/lib/guardrail-anomaly';
import { db } from '@/db';
import { guardrailChannels, guardrailCounters, suppressionList } from '@/db/schema';
import { sendEmail } from '@/lib/email';
import { todayUtc } from '@/lib/guardrail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const trips = await evaluateAnomalies();

  const today = todayUtc();
  const [channels, counters, suppression] = await Promise.all([
    db.select().from(guardrailChannels),
    db.select().from(guardrailCounters),
    db.select().from(suppressionList),
  ]);

  const lines = channels.map((ch) => {
    const used = counters.find((c) => c.channelId === ch.id && String(c.day) === today)?.count ?? 0;
    return `- ${ch.name}: ${used}/${ch.dailyCap} today${ch.enabled ? '' : ' (disabled)'}`;
  });

  const tripLines = trips.length ? trips.map((t) => `- ${t.channel}: ${t.reason}`) : ['- none'];

  const body = [
    `Guardrail daily digest — ${today}`,
    '',
    'Channel volume:',
    ...lines,
    '',
    'Auto-trips in the last 24h:',
    ...tripLines,
    '',
    `Suppression list size: ${suppression.length}`,
  ].join('\n');

  const to = process.env.ADMIN_EMAIL || 'undone.k@gmail.com';
  const result = await sendEmail({
    to,
    from: process.env.RESEND_FROM_EMAIL || 'noreply@authichain.com',
    subject: `Guardrail digest — ${today}${trips.length ? ` (${trips.length} auto-trip${trips.length > 1 ? 's' : ''})` : ''}`,
    text: body,
  });

  return NextResponse.json({ ok: result.ok, trips, provider: result.provider });
}
