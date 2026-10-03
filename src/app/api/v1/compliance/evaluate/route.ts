import { NextRequest, NextResponse } from "next/server";
import { evaluateComplianceRequest } from "../../../../../lib/compliance/evaluate-request";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = evaluateComplianceRequest(body);
  return NextResponse.json(result.body, { status: result.status });
}
