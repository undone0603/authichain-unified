// app/api/email/welcome/route.ts
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "../../../../lib/require-internal-secret";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Service-to-service only: unauthenticated, this sent mail from
// hello@authichain.com to any address with caller-controlled HTML.
export async function POST(request: NextRequest) {
  const denied = requireInternalSecret(request);
  if (denied) return denied;

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Email provider is not configured" },
        { status: 503 }
      );
    }

    const resend = new Resend(apiKey);
    const { to, firstName } = await request.json();

    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { error: "Invalid recipient email" },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: "AuthiChain Team <hello@authichain.com>", // Ensure this is a verified domain in Resend
      to: [to],
      subject: "Welcome aboard AuthiChain",
      html: `<h1>Welcome, ${esc(typeof firstName === "string" && firstName ? firstName : "valued partner")}!</h1><p>Your workspace is ready.</p>`,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Error in welcome email handler:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
