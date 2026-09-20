/**
 * GET /api/x402/catalog
 *
 * Next.js mirror of the edge catalog. Production traffic is served by
 * authichain-com (`tryHandleX402`) and worker-app (`registerX402Routes`).
 * Keep this in sync via x402Catalog — prices come from the same health
 * config. Do not hardcode payTo or a second price.
 */
import { NextResponse } from "next/server";
import { x402Catalog } from "@/lib/x402";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = await x402Catalog();
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
