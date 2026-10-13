import { NextResponse } from "next/server";
import { decideProductCapability } from "../../product-capabilities";

export const runtime = "nodejs";

function statusFor(decision: ReturnType<typeof decideProductCapability>): number {
  if (decision.decision === "allow") return 200;
  if (decision.audit.reason === "empty request" || decision.audit.reason === "prompt length") {
    return 400;
  }
  return 403;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON payload", decision: "deny" },
      { status: 400 }
    );
  }
  const decision = decideProductCapability(body);
  return NextResponse.json(decision, {
    status: statusFor(decision),
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed", decision: "deny" },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}
