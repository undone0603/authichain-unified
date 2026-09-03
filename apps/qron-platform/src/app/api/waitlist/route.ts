import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Build-time-safe fallback: Next.js imports every route module during
// production build's page-data collection, which runs before real env
// vars are available in some environments. A placeholder here only
// matters at build time -- real requests always have real env vars.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key"
);
const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

export async function POST(req: NextRequest) {
  const { email, name, use_case } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const { data: existing } = await supabase
    .from('waitlist')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) return NextResponse.json({ message: 'Already on waitlist', position: null });

  const { data, error } = await supabase
    .from('waitlist')
    .insert({ email, name, use_case, joined_at: new Date().toISOString() })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await supabase
    .from('waitlist')
    .select('*', { count: 'exact', head: true });

  await resend.emails.send({
    from: 'QRON <noreply@qron.space>',
    to: email,
    subject: "You're on the QRON waitlist!",
    html: `<h2>Welcome to QRON, ${name || 'friend'}!</h2><p>You're #${count} on our waitlist. We'll notify you when your spot opens up.</p><p>Use case: ${use_case || 'Not specified'}</p>`,
  }).catch(() => {});

  return NextResponse.json({ success: true, position: count });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const admin = searchParams.get('admin_key');
  if (admin !== process.env.ADMIN_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, count } = await supabase
    .from('waitlist')
    .select('*', { count: 'exact' })
    .order('joined_at', { ascending: false });

  return NextResponse.json({ total: count, entries: data || [] });
}
