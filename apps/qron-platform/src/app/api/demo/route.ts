import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { name, email, company, use_case, preferred_time } = await req.json();
  if (!name || !email) return NextResponse.json({ error: 'name and email required' }, { status: 400 });

  const { error } = await supabase.from('demo_requests').insert({
    name,
    email,
    company,
    use_case,
    preferred_time,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await Promise.all([
    resend.emails.send({
      from: 'QRON <noreply@qron.space>',
      to: email,
      subject: 'Your QRON demo request is confirmed!',
      html: `<h2>Hi ${name},</h2><p>Thanks for requesting a QRON demo! Our team will reach out within 24 hours to schedule your personalized walkthrough.</p><p>Company: ${company || 'N/A'}<br/>Use case: ${use_case || 'General'}<br/>Preferred time: ${preferred_time || 'Flexible'}</p>`,
    }).catch(() => {}),
    resend.emails.send({
      from: 'QRON Demos <noreply@qron.space>',
      to: process.env.SALES_EMAIL || 'sales@qron.space',
      subject: `New demo request from ${name} at ${company || 'unknown'}`,
      html: `<p><strong>Name:</strong> ${name}<br/><strong>Email:</strong> ${email}<br/><strong>Company:</strong> ${company || 'N/A'}<br/><strong>Use case:</strong> ${use_case || 'Not specified'}<br/><strong>Preferred time:</strong> ${preferred_time || 'Flexible'}</p>`,
    }).catch(() => {}),
  ]);

  return NextResponse.json({ success: true, message: 'Demo request received. We will contact you within 24 hours.' });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const admin = searchParams.get('admin_key');
  if (admin !== process.env.ADMIN_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, count } = await supabase
    .from('demo_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  return NextResponse.json({ total: count, requests: data || [] });
}
