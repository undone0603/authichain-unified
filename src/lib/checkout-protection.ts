import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type CheckoutClaimResult =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfter?: number };

export async function claimCheckoutAttempt(opts: {
  checkoutKey: string;
  email: string;
  planId: string;
  request: Request;
}): Promise<CheckoutClaimResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { allowed: false, reason: "Checkout protection unavailable" };

  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const emailHash = hash(opts.email.trim().toLowerCase());
  const ip =
    opts.request.headers.get("cf-connecting-ip")?.trim() ||
    opts.request.headers.get("x-real-ip")?.trim() ||
    opts.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    `email:${emailHash}`;
  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("claim_gated_checkout", {
    p_checkout_key: opts.checkoutKey,
    p_email_hash: emailHash,
    p_ip_hash: hash(ip),
    p_plan_id: opts.planId,
  });
  if (error) {
    console.error("[checkout] Protection RPC failed:", error.message);
    return { allowed: false, reason: "Checkout protection unavailable" };
  }
  const result = data as {
    allowed?: boolean;
    reason?: string;
    retry_after?: number;
  } | null;
  if (result?.allowed) return { allowed: true };
  return {
    allowed: false,
    reason: result?.reason || "Checkout request was not accepted",
    retryAfter: result?.retry_after,
  };
}

export async function recordCheckoutSession(
  checkoutKey: string,
  sessionUrl: string
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("record_gated_checkout_session", {
    p_checkout_key: checkoutKey,
    p_session_url: sessionUrl,
  });
  if (error) {
    console.error("[checkout] Could not record Stripe session:", error.message);
    return false;
  }
  return data === true;
}
