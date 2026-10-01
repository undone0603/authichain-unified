import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("musa_suppliers")
    .select("*")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  return NextResponse.json({ suppliers: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.supplier_name || typeof body.supplier_name !== "string") {
    return NextResponse.json({ error: "supplier_name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("musa_suppliers")
    .insert({
      tenant_id: user.id,
      supplier_name: body.supplier_name.trim(),
      supplier_external_ref: typeof body.supplier_external_ref === "string" ? body.supplier_external_ref : null,
      country_code: typeof body.country_code === "string" ? body.country_code.toUpperCase() : null,
      address: body.address && typeof body.address === "object" ? body.address : {},
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  return NextResponse.json({ supplier: data }, { status: 201 });
}
