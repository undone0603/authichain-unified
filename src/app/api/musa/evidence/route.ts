import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { validateSupplierEvidence } from "@/lib/musa/supplier-evidence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supplierId = new URL(request.url).searchParams.get("supplier_id");
  let query = supabase.from("musa_evidence").select("*").eq("tenant_id", user.id).order("created_at", { ascending: false });
  if (supplierId) query = query.eq("supplier_id", supplierId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load evidence" }, { status: 500 });
  return NextResponse.json({ evidence: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.supplier_id || typeof body.supplier_id !== "string") {
    return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
  }

  const errors = validateSupplierEvidence(body);
  if (errors.length) return NextResponse.json({ error: "Invalid evidence", details: errors }, { status: 400 });

  const { data: supplier } = await supabase.from("musa_suppliers").select("id").eq("id", body.supplier_id).eq("tenant_id", user.id).maybeSingle();
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("musa_evidence")
    .insert({
      tenant_id: user.id,
      supplier_id: body.supplier_id,
      evidence_type: body.evidenceType,
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description : null,
      document_hash: body.documentHash.toLowerCase(),
      hash_algorithm: body.hashAlgorithm || "sha256",
      storage_path: body.storagePath || null,
      mime_type: body.mimeType || null,
      issued_at: body.issuedAt || null,
      expires_at: body.expiresAt || null,
      issuer_name: body.issuerName || null,
      issuer_ref: body.issuerRef || null,
      origin_country_code: body.originCountryCode ? String(body.originCountryCode).toUpperCase() : null,
      extracted_claims: body.extractedClaims || {},
      validation: body.validation || {},
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Evidence with this document hash already exists" : "Failed to create evidence" }, { status: duplicate ? 409 : 500 });
  }

  await supabase.from("musa_audit_events").insert({
    tenant_id: user.id,
    entity_type: "supplier_evidence",
    entity_id: data.id,
    event_type: "evidence.created",
    actor_id: user.id,
    payload: { supplier_id: body.supplier_id, evidence_type: body.evidenceType, document_hash: body.documentHash },
  });

  return NextResponse.json({ evidence: data }, { status: 201 });
}
