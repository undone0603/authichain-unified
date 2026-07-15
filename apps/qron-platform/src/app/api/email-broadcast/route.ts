import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/email-broadcast
// Body: { segment: 'all' | 'trialing' | 'free' | 'paid', subject: string, html: string }
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { segment, subject, html } = await req.json();
    if (!segment || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let userIds: string[] | null = null;

    if (segment !== 'all') {
      const statusMap: Record<string, string> = { trialing: 'trialing', free: 'free', paid: 'active' };
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq(segment === 'paid' ? 'status' : 'plan', statusMap[segment]);
      userIds = subs?.map((s: { user_id: string }) => s.user_id) ?? [];
    }

    const query = supabase.from('users').select('id, email, name');
    const { data: users, error } = userIds
      ? await query.in('id', userIds)
      : await query;
    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const user of users ?? []) {
      if (!user.email) continue;
      const personalizedHtml = html.replace(/\{\{name\}\}/g, user.name || 'there');
      const { error: sendErr } = await resend.emails.send({
        from: 'QRON <hello@qron.space>',
        to: user.email,
        subject,
        html: personalizedHtml,
      });
      if (sendErr) failed++; else sent++;
    }

    await supabase.from('broadcast_log').insert({
      segment, subject, sent, failed,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, segment, sent, failed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
