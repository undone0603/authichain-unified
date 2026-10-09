import { NextRequest, NextResponse } from "next/server";
import { activateServiceOrder } from "@/lib/service-order-activate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!token)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    const supabase = createClient(url, key);
    const { data } = await supabase.auth.getUser(token);
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const result = await activateServiceOrder({
      body,
      authenticatedUser: data.user
        ? { id: data.user.id, email: data.user.email }
        : null,
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      supabase,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : result.status,
    });
  } catch (error: unknown) {
    console.error("[service-orders/activate] Error:", error);
    return NextResponse.json(
      { error: "Service-order activation failed" },
      { status: 500 }
    );
  }
}
