import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { inviter_user_id, inviter_name, invitee_emails } = await req.json();
  if (!inviter_user_id || !invitee_emails?.length)
    return NextResponse.json({ error: 'inviter_user_id and invitee_emails required' }, { status: 400 });

  const results = [];

  for (const email of invitee_emails.slice(0, 10)) {
    const code = nanoid(10);
    const { error } = await supabase.from('invitations').insert({
      inviter_user_id,
      invitee_email: email,
      code,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (!error) {
      await resend.emails.send({
        from: 'QRON <noreply@qron.space>',
        to: email,
        subject: `${inviter_name || 'Someone'} invited you to QRON`,
        html: `<h2>You have been invited to QRON!</h2><p>${inviter_name || 'A friend'} thinks you would love QRON - the AI-powered QR code platform.</p><p><a href="https://qron.space/signup?ref=${code}">Accept invitation & get started free</a></p>`,
      }).catch(() => {});
      results.push({ email, code, sent: true });
    } else {
      results.push({ email, sent: false, error: error.message });
    }
  }

  return NextResponse.json({ success: true, results });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const { data } = await supabase
    .from('invitations')
    .select('invitee_email, code, status, created_at')
    .eq('inviter_user_id', user_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ invitations: data || [] });
}
