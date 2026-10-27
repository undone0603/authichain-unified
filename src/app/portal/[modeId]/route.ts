import { NextResponse } from "next/server";
import { PORTAL_MODES, type PortalModeKey } from "@/lib/modes";
import { renderPortalHtml } from "@/lib/portal-template";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ modeId: string }> }
) {
  const { modeId } = await params;
  const mode = PORTAL_MODES[modeId as PortalModeKey];
  if (!mode) {
    return NextResponse.json(
      { error: "unknown_mode", message: "Mode not found" },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const productName = url.searchParams.get("name") ?? undefined;
  const productPhotoUrl = url.searchParams.get("photo") ?? undefined;
  const sealStatus = (url.searchParams.get("status") as "Verified" | "Pending" | "Flagged" | null) ?? undefined;
  const sku = url.searchParams.get("sku") ?? undefined;
  const scarcityRaw = url.searchParams.get("scarcity");
  const scarcity = scarcityRaw ? Number(scarcityRaw) : undefined;
  const countdownIso = url.searchParams.get("countdown") ?? undefined;
  const coaSummary = url.searchParams.get("coa") ?? undefined;
  const brandAccent = url.searchParams.get("accent") ?? undefined;

  const html = renderPortalHtml({
    modeId: modeId as PortalModeKey,
    productName,
    productPhotoUrl,
    sealStatus,
    sku,
    scarcity: Number.isFinite(scarcity) ? scarcity : undefined,
    countdownIso,
    coaSummary,
    brandAccent,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
