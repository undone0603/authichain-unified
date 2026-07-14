import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  "Cache-Control": "no-store",
};

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "AuthiChain API",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      endpoints: {
        verify: "/api/v1/verify/:cert_id",
        register: "/api/v1/register",
        health: "/api/v1/health",
      },
      blockchain: "Polygon PoS + Base",
      consensus: "5-Agent AI Weighted",
      status: "Elite / Theater 3 Active",
      docs: "https://authichain.com/api-docs",
    },
    {
      headers: corsHeaders,
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
