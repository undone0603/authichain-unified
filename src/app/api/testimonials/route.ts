import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "../../../lib/supabase-admin";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const plan = searchParams.get("plan");
    const limit = parseInt(searchParams.get("limit") || "10");

    const query = supabase
      .from("testimonials")
      .select(
        "id, name, role, company, avatar_initials, rating, text, plan, verified, created_at"
      )
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (plan) query.eq("plan", plan);

    const { data } = await query;

    const testimonials = data ?? [];

    return NextResponse.json({ testimonials, count: testimonials.length });
  } catch {
    return NextResponse.json({ testimonials: [], count: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);
    if (authErr || !user)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { text, rating, role, company } = (await req.json()) as {
      text?: string;
      rating?: number;
      role?: string;
      company?: string;
    };
    if (!text || !rating)
      return NextResponse.json(
        { error: "text and rating are required" },
        { status: 400 }
      );

    const { data, error } = await supabase
      .from("testimonials")
      .insert({
        user_id: user.id,
        text,
        rating: Math.min(5, Math.max(1, rating)),
        role: role || null,
        company: company || null,
        approved: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({
      success: true,
      testimonial: data,
      message: "Thank you! Your testimonial is under review.",
    });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
