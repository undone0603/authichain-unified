import { NextResponse } from "next/server";
import { gatedCheckoutUrl, PLANS } from "../../../lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  planId?: unknown;
  email?: unknown;
  affiliateCode?: unknown;
  prospectId?: unknown;
  source?: unknown;
};

function readAffiliateCookie(request: Request): string {
  const raw = (request.headers.get("cookie") || "")
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith("aff_ref="))
    ?.slice("aff_ref=".length);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.planId !== "string" || !body.planId.trim()) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const plan = PLANS.find(candidate => candidate.id === body.planId);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  if (!plan.stripe_price_id || !plan.stripe_mode) {
    return NextResponse.json(
      { error: "Free plan does not require checkout" },
      { status: 400 }
    );
  }

  const url = new URL(gatedCheckoutUrl(plan.id));
  const email =
    typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
  const affiliateCode =
    (typeof body.affiliateCode === "string" ? body.affiliateCode : "") ||
    readAffiliateCookie(request);
  const prospectId =
    typeof body.prospectId === "string"
      ? body.prospectId.trim().slice(0, 128)
      : "";
  const source =
    typeof body.source === "string" ? body.source.trim().slice(0, 64) : "";

  if (email) url.searchParams.set("email", email);
  if (/^[A-Za-z0-9_-]{1,64}$/.test(affiliateCode)) {
    url.searchParams.set("affiliate_code", affiliateCode);
  }
  if (prospectId) url.searchParams.set("prospect_id", prospectId);
  if (source) url.searchParams.set("source", source);

  return NextResponse.json(
    { url: url.toString() },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
