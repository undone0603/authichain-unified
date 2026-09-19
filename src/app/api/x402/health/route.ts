/**
 * GET /api/x402/health
 *
 * Next.js mirror of the edge handler. Production traffic is served by
 * worker-app (`registerX402Routes`). Keep this in sync via x402HealthReport.
 */
import { NextResponse } from "next/server";
import { x402HealthReport } from "@/lib/x402";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = await x402HealthReport();
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
