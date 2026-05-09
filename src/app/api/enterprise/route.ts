import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { name, email, company, company_size, use_case, monthly_qr_volume, message } = await req.json();
  if (!name || !email || !company)
    return NextResponse.json({ error: 'name, email, and company are required' }, { status: 400 });

  const { error } = await supabase.from('enterprise_inquiries').insert({
    name,
    email,
    company,
    company_size,
    use_case,
    monthly_qr_volume,
    message,
    status: 'new',
    created_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await Promise.all([
    resend.emails.send({
      from: 'QRON Enterprise <noreply@qron.space>',
      to: email,
      subject: 'Your QRON Enterprise inquiry has been received',
      html: `<h2>Hi ${name},</h2><p>Thank you for your interest in QRON Enterprise! Our team will review your inquiry and reach out within 1 business day to discuss custom pricing and a dedicated onboarding plan.</p><p><strong>Company:</strong> ${company}<br/><strong>Team size:</strong> ${company_size || 'N/A'}<br/><strong>Monthly QR volume:</strong> ${monthly_qr_volume || 'N/A'}</p><p>In the meantime, feel free to explore our <a href="https://qron.space/pricing">pricing page</a> or <a href="https://qron.space/demo">request a demo</a>.</p>`,
    }).catch(() => {}),
    resend.emails.send({
      from: 'QRON Enterprise <noreply@qron.space>',
      to: process.env.SALES_EMAIL || 'sales@qron.space',
      subject: `Enterprise inquiry: ${company} (${company_size || '?'} employees)`,
      html: `<p><strong>Name:</strong> ${name}<br/><strong>Email:</strong> ${email}<br/><strong>Company:</strong> ${company}<br/><strong>Size:</strong> ${company_size || 'N/A'}<br/><strong>Use case:</strong> ${use_case || 'N/A'}<br/><strong>Monthly QR volume:</strong> ${monthly_qr_volume || 'N/A'}<br/><strong>Message:</strong> ${message || 'None'}</p>`,
    }).catch(() => {}),
  ]);

  return NextResponse.json({
    success: true,
    message: 'Enterprise inquiry received. Our team will contact you within 1 business day.',
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const admin = searchParams.get('admin_key');
  if (admin !== process.env.ADMIN_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, count } = await supabase
    .from('enterprise_inquiries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  return NextResponse.json({ total: count, inquiries: data || [] });
}
