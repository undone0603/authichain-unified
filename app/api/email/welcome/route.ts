// app/api/email/welcome/route.ts
import { Resend } from 'resend';
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, firstName } = await request.json();

    if (!to || !to.includes('@')) {
      return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: 'AuthiChain Team <hello@authichain.com>', // Ensure this is a verified domain in Resend
      to: [to],
      subject: 'Welcome aboard AuthiChain',
      html: `<h1>Welcome, ${firstName || 'valued partner'}!</h1><p>Your workspace is ready.</p>`,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Error in welcome email handler:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
