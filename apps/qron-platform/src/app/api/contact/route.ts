import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const toEmail = process.env.CONTACT_EMAIL || 'hello@qron.space';
    const fromEmail = process.env.FROM_EMAIL || 'noreply@qron.space';

    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
      await sgMail.send({
        to: toEmail,
        from: fromEmail,
        replyTo: email,
        subject: `New Contact Form Submission from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || 'N/A'}\n\nMessage:\n${message}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Company:</strong> ${company || 'N/A'}</p><p><strong>Message:</strong></p><p>${message}</p>`,
      });
    }

    // Always return success (graceful degradation when email not configured)
    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for reaching out. We will get back to you shortly.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process your request. Please try again.' },
      { status: 500 }
    );
  }
}
