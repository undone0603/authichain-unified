/**
 * POST /api/storepilot/report[?format=jsonld]
 * Body: catalog CSV (header row) or JSON array. Signed-in StorePilot Pro
 * buyers only. Without an entitlement: 402 with the Pro payment link.
 * Over the catalog limit: 413, nothing processed. Nothing is stored.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buildPortfolio, capCatalog } from "../../../../lib/compliance-portfolio";
import { parseCatalogUpload } from "../../../../lib/catalog-upload";
import { portfolioToJsonLd } from "../../../../lib/dpp-jsonld";
import { loadStorePilotEntitlement } from "../../../../lib/storepilot-entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const STOREPILOT_PRO_LINK = "https://buy.stripe.com/6oU14n87n8Jo5iabDC1NE02";

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  }
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const ent = await loadStorePilotEntitlement(admin, user.email);
  if (!ent.entitled) {
    return NextResponse.json(
      { error: "storepilot_pro_required", pay: STOREPILOT_PRO_LINK },
      { status: 402 }
    );
  }
  const parsed = parseCatalogUpload(await request.text(), request.headers.get("content-type") ?? "");
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });
  const capped = capCatalog(parsed.rows, ent.catalogLimit);
  if (!capped.ok) return NextResponse.json(capped, { status: 413 });

  const portfolio = buildPortfolio(capped.rows, new Date());
  const format = new URL(request.url).searchParams.get("format");
  if (format === "jsonld") {
    return new NextResponse(JSON.stringify(portfolioToJsonLd(portfolio)), {
      headers: { "Content-Type": "application/ld+json", "Cache-Control": "private, no-store" },
    });
  }
  return NextResponse.json(portfolio, { headers: { "Cache-Control": "private, no-store" } });
}
