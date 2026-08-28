/**
 * scripts/ledger/backfill-stripe.ts
 *
 * Publishes historical Stripe money movement to AuthiChainLedger with
 * source = backfill (1). Backfilled rows are visibly distinct from live ones,
 * on-chain and in the DB, and the UI must never present the anchor time as the
 * payment time.
 *
 *   npx tsx scripts/ledger/backfill-stripe.ts                    # dry run
 *   npx tsx scripts/ledger/backfill-stripe.ts --since 2025-01-01
 *   npx tsx scripts/ledger/backfill-stripe.ts --limit 50 --execute
 *
 * Safety:
 *   - dry run is the default; --execute is required to send transactions
 *   - live mode only (test-mode keys are rejected)
 *   - skips anything already status=anchored/reversed in ledger_receipts
 *   - re-checks saleByStripeRef on-chain before every send
 *   - one transaction at a time (nonce serialization lives in ledger-service)
 *   - paces Stripe list calls
 */

import Stripe from "stripe";

import {
  anchorStripeReversal,
  anchorStripeSale,
  ledgerDb,
  resolveBuyerWallet,
  resolveSku,
} from "../../src/lib/ledger-service";
import { isLedgerConfigured } from "../../src/lib/ledger-contract";

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const EXECUTE = flag("execute");
const LIMIT = Number(value("limit") ?? 1000);
const SINCE = value("since") ? Math.floor(new Date(value("since")!).getTime() / 1000) : undefined;
const PACE_MS = Number(value("pace") ?? 250);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------

interface Candidate {
  objectId: string;
  sku: string;
  amountCents: number;
  currency: string;
  buyerWallet: string | null;
  stripeCreated: number;
  kind: "session" | "invoice";
}

const stats = {
  scanned: 0,
  candidates: 0,
  skippedAlreadyAnchored: 0,
  skippedZeroAmount: 0,
  anchored: 0,
  failed: 0,
  reversed: 0,
};

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("STRIPE_SECRET_KEY is required");
  if (secret.startsWith("sk_test_") || secret.startsWith("rk_test_")) {
    throw new Error("Refusing to run: this is a test-mode key. Backfill is live-mode only.");
  }
  if (EXECUTE && !isLedgerConfigured()) {
    throw new Error("Refusing to --execute: LEDGER_CONTRACT_ADDRESS is unset.");
  }

  const stripe = new Stripe(secret);
  const db = ledgerDb();

  console.log(EXECUTE ? "MODE: EXECUTE (transactions will be sent)" : "MODE: DRY RUN");
  console.log(`since: ${SINCE ? new Date(SINCE * 1000).toISOString() : "beginning of time"}`);
  console.log(`limit: ${LIMIT}\n`);

  const candidates: Candidate[] = [];

  // --- paid checkout sessions (one-time + first subscription payment) ------
  for await (const session of stripe.checkout.sessions.list({
    limit: 100,
    ...(SINCE ? { created: { gte: SINCE } } : {}),
  })) {
    stats.scanned++;
    if (session.payment_status !== "paid") continue;
    const amount = session.amount_total ?? 0;
    if (amount <= 0) {
      stats.skippedZeroAmount++;
      continue;
    }
    candidates.push({
      objectId: session.id,
      sku: resolveSku(session.metadata as Record<string, string>, null),
      amountCents: amount,
      currency: session.currency ?? "usd",
      buyerWallet: resolveBuyerWallet(session.metadata as Record<string, string>),
      stripeCreated: session.created,
      kind: "session",
    });
    if (candidates.length >= LIMIT) break;
    if (stats.scanned % 100 === 0) await sleep(PACE_MS);
  }

  // --- paid renewal invoices ----------------------------------------------
  // subscription_create invoices are skipped: that payment is already anchored
  // under its checkout session id.
  if (candidates.length < LIMIT) {
    for await (const invoice of stripe.invoices.list({
      status: "paid",
      limit: 100,
      ...(SINCE ? { created: { gte: SINCE } } : {}),
    })) {
      stats.scanned++;
      if (invoice.billing_reason === "subscription_create") continue;
      const amount = invoice.amount_paid ?? 0;
      if (amount <= 0) {
        stats.skippedZeroAmount++;
        continue;
      }
      const line = invoice.lines?.data?.[0];
      candidates.push({
        objectId: invoice.id!,
        sku: resolveSku(
          invoice.metadata as Record<string, string>,
          (line as unknown as { price?: { id?: string } })?.price?.id ?? null
        ),
        amountCents: amount,
        currency: invoice.currency ?? "usd",
        buyerWallet: resolveBuyerWallet(
          invoice.metadata as Record<string, string>,
          line?.metadata as Record<string, string>
        ),
        stripeCreated: invoice.created,
        kind: "invoice",
      });
      if (candidates.length >= LIMIT) break;
      if (stats.scanned % 100 === 0) await sleep(PACE_MS);
    }
  }

  stats.candidates = candidates.length;

  // --- drop anything already anchored --------------------------------------
  const pending: Candidate[] = [];
  for (const c of candidates) {
    if (db) {
      const { data } = await db
        .from("ledger_receipts")
        .select("status")
        .eq("stripe_object_id", c.objectId)
        .maybeSingle();
      if (data && (data.status === "anchored" || data.status === "reversed")) {
        stats.skippedAlreadyAnchored++;
        continue;
      }
    }
    pending.push(c);
  }

  console.log(`candidates : ${stats.candidates}`);
  console.log(`already on : ${stats.skippedAlreadyAnchored}`);
  console.log(`to anchor  : ${pending.length}\n`);

  for (const c of pending) {
    const line = `${c.kind.padEnd(7)} ${c.objectId}  ${(c.amountCents / 100).toFixed(2)} ${c.currency}  ${c.sku}  ${new Date(c.stripeCreated * 1000).toISOString()}`;

    if (!EXECUTE) {
      console.log(`[dry] ${line}`);
      continue;
    }

    const result = await anchorStripeSale({
      objectId: c.objectId,
      sku: c.sku,
      amountCents: c.amountCents,
      currency: c.currency,
      buyerWallet: c.buyerWallet,
      stripeCreated: c.stripeCreated,
      source: "backfill",
      skipStripeWriteback: true, // do not rewrite metadata on historical objects
    });

    if (result.status === "anchored") {
      stats.anchored++;
      console.log(`[ok ] ${line}  tx=${result.txHash}`);
    } else if (result.status === "failed") {
      stats.failed++;
      console.log(`[err] ${line}  ${result.reason}`);
    } else {
      console.log(`[${result.status.slice(0, 3)}] ${line}  ${result.reason ?? ""}`);
    }

    await sleep(PACE_MS);
  }

  // --- refunds -------------------------------------------------------------
  console.log("\nscanning refunds...");
  for await (const charge of stripe.charges.list({
    limit: 100,
    ...(SINCE ? { created: { gte: SINCE } } : {}),
  })) {
    if (!charge.refunded && (charge.amount_refunded ?? 0) === 0) continue;

    const piId =
      typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;

    // This Stripe API version no longer exposes `invoice` on Charge; the
    // checkout session (resolved from the payment intent below) is the only
    // reversal target we can recover here.
    let sessionId: string | undefined;
    if (piId) {
      const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
      sessionId = sessions.data[0]?.id;
    }

    if (!EXECUTE) {
      console.log(`[dry] refund ${charge.id} -> ${sessionId ?? "no anchored target"}`);
      continue;
    }

    const result = await anchorStripeReversal({
      candidateObjectIds: [sessionId, charge.id],
    });
    if (result.status === "reversed") {
      stats.reversed++;
      console.log(`[ok ] reversed ${sessionId ?? charge.id}  tx=${result.txHash ?? "-"}`);
    }
    await sleep(PACE_MS);
  }

  console.log("\n--- summary ---");
  console.table(stats);
  if (!EXECUTE) console.log("\nDry run. Re-run with --execute to send transactions.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
