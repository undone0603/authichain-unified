import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

// Called daily by Vercel cron or n8n
// Sends reminder emails to trial users at day 10 and day 13
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const day10Start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const day10End = new Date(day10Start.getTime() + 24 * 60 * 60 * 1000);
  const day13Start = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
  const day13End = new Date(day13Start.getTime() + 24 * 60 * 60 * 1000);

  const { data: day10Users } = await supabase
    .from('subscriptions')
    .select('user_id, trial_start, users(email, name)')
    .eq('status', 'trialing')
    .gte('trial_start', day10Start.toISOString())
    .lt('trial_start', day10End.toISOString());

  const { data: day13Users } = await supabase
    .from('subscriptions')
    .select('user_id, trial_start, users(email, name)')
    .eq('status', 'trialing')
    .gte('trial_start', day13Start.toISOString())
    .lt('trial_start', day13End.toISOString());

  let sent = 0;

  for (const user of (day10Users || [])) {
    const email = (user as any).users?.email;
    const name = (user as any).users?.name || 'there';
    if (!email) continue;
    await resend.emails.send({
      from: 'QRON <noreply@qron.space>',
      to: email,
      subject: '4 days left on your QRON Pro trial',
      html: `<h2>Hi ${name},</h2><p>You have <strong>4 days left</strong> on your QRON Pro trial. Here's what you've been able to do so far:</p><ul><li>Create AI-styled QR codes</li><li>Track scan analytics</li><li>Use custom redirect domains</li></ul><p>To keep all these features after your trial ends, <a href="https://qron.space/pricing">upgrade to Pro now</a> — starting at just $29/mo.</p><p>Questions? Just reply to this email.</p>`,
    }).catch(() => {});
    sent++;
  }

  for (const user of (day13Users || [])) {
    const email = (user as any).users?.email;
    const name = (user as any).users?.name || 'there';
    if (!email) continue;
    await resend.emails.send({
      from: 'QRON <noreply@qron.space>',
      to: email,
      subject: 'Your QRON trial ends tomorrow — keep your QR codes',
      html: `<h2>Hi ${name},</h2><p>Your QRON Pro trial ends <strong>tomorrow</strong>. After that, you'll lose access to:</p><ul><li>AI-generated QR art styles</li><li>Scan analytics &amp; heatmaps</li><li>Custom redirect domains</li><li>Bulk export</li></ul><p><a href="https://qron.space/pricing" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Upgrade Now — from $29/mo</a></p><p>Use code <strong>EARLYBIRD20</strong> for 20% off your first 3 months.</p>`,
    }).catch(() => {});
    sent++;
  }

  return NextResponse.json({
    success: true,
    day10_reminders: (day10Users || []).length,
    day13_reminders: (day13Users || []).length,
    total_sent: sent,
    run_at: now.toISOString(),
  });
}
