import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { logAutomation } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-08-26.dahlia" as const });
}

/**
 * POST /api/affiliate/payout
 *
 * Pays out accrued affiliate commissions via Stripe Connect.
 *
 * Source of truth is the `affiliates` table: any affiliate with
 * pending_payout >= the Stripe minimum and a connected Stripe account
 * (profiles.stripe_account_id) is paid, an audit row is written to
 * affiliate_payouts, and pending_payout is reset.
 *
 * Safety:
 *  - Gated behind STRIPE_CONNECT_ENABLED=true.
 *  - Stripe idempotency key (affiliate + amount + day) prevents a duplicate
 *    transfer if the job runs twice in a day.
 *  - The pending_payout reset is guarded on the exact amount read, so a
 *    concurrent accrual is never silently zeroed.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.STRIPE_CONNECT_ENABLED !== "true") {
    return NextResponse.json({
      ok: false,
      message: "Stripe Connect not enabled — payouts skipped",
    });
  }

  const admin = getAdmin();
  const stripe = getStripe();
  const processedClaims = new Set<string>();
  let paid = 0,
    needsReview = 0,
    heldMinimum = 0,
    failed = 0;
  const errors: string[] = [];

  const processClaim = async (claim: {
    id: string;
    affiliate_id: string;
    affiliate_user_id: string;
    amount_cents: number;
    destination_account: string;
    idempotency_key: string;
  }) => {
    processedClaims.add(claim.id);
    const amount = Number(claim.amount_cents) / 100;
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: Number(claim.amount_cents),
          currency: "usd",
          destination: claim.destination_account,
          metadata: {
            affiliate_table_id: claim.affiliate_id,
            payout_claim_id: claim.id,
            source: "authichain_affiliate",
          },
        },
        { idempotencyKey: claim.idempotency_key }
      );

      const { error: auditError } = await admin
        .from("affiliate_payouts")
        .upsert(
          {
            affiliate_id: claim.affiliate_user_id,
            amount,
            currency: "usd",
            status: "paid",
            stripe_transfer_id: transfer.id,
            idempotency_key: claim.idempotency_key,
            paid_at: new Date().toISOString(),
            metadata: {
              affiliate_table_id: claim.affiliate_id,
              payout_claim_id: claim.id,
            },
          },
          { onConflict: "idempotency_key" }
        );
      if (auditError) throw new Error(`Payout audit write failed: ${auditError.message}`);

      const { data: completed, error: completeError } = await admin.rpc(
        "complete_affiliate_payout",
        {
          p_claim_id: claim.id,
          p_stripe_transfer_id: transfer.id,
        }
      );
      if (completeError || completed !== true) {
        throw new Error(
          `Payout claim completion failed: ${completeError?.message || "claim not completed"}`
        );
      }
      paid++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const { error: claimError } = await admin
        .from("affiliate_payout_claims")
        .update({ error_message: msg.slice(0, 1000) })
        .eq("id", claim.id)
        .eq("status", "processing");
      if (claimError) {
        console.error("[affiliate-payout] Failed to annotate claim:", claimError);
      }
      failed++;
      errors.push(`affiliate ${claim.affiliate_id}: ${msg}`);
    }
  };

  // A claim left processing after an ambiguous Stripe/API/database failure is
  // retried with the same Stripe idempotency key before new balances are paid.
  const { data: outstanding, error: outstandingError } = await admin
    .from("affiliate_payout_claims")
    .select(
      "id, affiliate_id, affiliate_user_id, amount_cents, destination_account, idempotency_key"
    )
    .eq("status", "processing")
    .limit(100);
  if (outstandingError) {
    return NextResponse.json({ error: outstandingError.message }, { status: 500 });
  }
  for (const claim of outstanding || []) {
    await processClaim(claim);
  }

  // Affiliates with new money owed. The RPC locks the affiliate row and moves
  // the amount into one durable payout claim before any Stripe request occurs.
  const { data: owed, error: fetchErr } = await admin
    .from("affiliates")
    .select(
      "id, user_id, affiliatecode, pending_payout, total_earnings, status"
    )
    .eq("status", "active")
    .gt("pending_payout", 0)
    .limit(100);

  if (fetchErr) {
    await logAutomation(
      "affiliate_payout_processor",
      "event",
      "failure",
      null,
      fetchErr.message
    );
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!owed || owed.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: paid + failed,
      message: "No affiliates with pending payout",
    });
  }

  for (const a of owed) {
    const amount = parseFloat(a.pending_payout as unknown as string);
    const amountCents = Math.round(amount * 100);

    // Resolve the affiliate's connected Stripe account from their profile
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_account_id, email")
      .eq("id", a.user_id)
      .maybeSingle();
    if (profileError) {
      failed++;
      errors.push(`affiliate ${a.id}: profile lookup failed: ${profileError.message}`);
      continue;
    }
    const stripeAccountId = (profile as { stripe_account_id?: string } | null)
      ?.stripe_account_id;

    if (!stripeAccountId) {
      const { error: auditError } = await admin.from("affiliate_payouts").upsert(
        {
          affiliate_id: String(a.user_id),
          amount,
          currency: "usd",
          status: "needs_review",
          idempotency_key: `affreview_${a.id}_${amountCents}`,
          metadata: {
            affiliate_table_id: a.id,
            affiliatecode: a.affiliatecode,
            reason: "no_stripe_account",
          },
        },
        { onConflict: "idempotency_key" }
      );
      if (auditError) {
        failed++;
        errors.push(`affiliate ${a.id}: needs-review write failed: ${auditError.message}`);
      }
      needsReview++;
      continue;
    }

    if (amountCents < 100) {
      heldMinimum++;
      continue;
    }

    const { data: claimData, error: claimError } = await admin.rpc(
      "claim_affiliate_payout",
      {
        p_affiliate_id: String(a.id),
        p_destination_account: stripeAccountId,
      }
    );
    if (claimError) {
      failed++;
      errors.push(`affiliate ${a.id}: payout claim failed: ${claimError.message}`);
      continue;
    }
    const claim = claimData as {
      claimed?: boolean;
      reason?: string;
      id?: string;
      affiliate_id?: string;
      affiliate_user_id?: string;
      amount_cents?: number;
      destination_account?: string;
      idempotency_key?: string;
    } | null;
    if (!claim?.claimed || !claim.id || !claim.amount_cents || !claim.idempotency_key) {
      if (claim?.reason === "below_minimum_or_unconnected") heldMinimum++;
      continue;
    }
    await processClaim({
      id: claim.id,
      affiliate_id: String(a.id),
      affiliate_user_id: String(a.user_id),
      amount_cents: claim.amount_cents,
      destination_account: claim.destination_account || stripeAccountId,
      idempotency_key: claim.idempotency_key,
    });
  }

  const status = failed > 0 && paid === 0 ? "failure" : "success";
  await logAutomation("affiliate_payout_processor", "event", status, {
    processed: owed.length,
    paid,
    needsReview,
    heldMinimum,
    failed,
  });

  return NextResponse.json({
    ok: true,
    processed: owed.length,
    paid,
    needsReview,
    heldMinimum,
    failed,
    errors,
  });
}
