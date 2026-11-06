/**
 * Self-serve merchant activation for the EU DPP Readiness Audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { activateDppMerchant } from "@/lib/dpp-activate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getServiceSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, string>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await activateDppMerchant({
      body,
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      supabase: await getServiceSupabase(),
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.detail ? { detail: result.detail } : {}),
        },
        { status: result.status }
      );
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    // Do not send database, Stripe or key-configuration exception details
    // to unauthenticated callers. The server logs retain the error class.
    console.error("[dpp/activate] Unexpected failure", error instanceof Error ? error.name : "Error");
    return NextResponse.json(
      { error: "Activation failed" },
      { status: 500 }
    );
  }
}
