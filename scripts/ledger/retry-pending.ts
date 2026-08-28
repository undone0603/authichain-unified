/**
 * scripts/ledger/retry-pending.ts
 *
 * Re-drives ledger_receipts rows stuck in pending or failed. This is what makes
 * a chain outage, an unset LEDGER_CONTRACT_ADDRESS, or a Vercel timeout a
 * recoverable condition rather than a lost receipt.
 *
 *   npx tsx scripts/ledger/retry-pending.ts             # dry run
 *   npx tsx scripts/ledger/retry-pending.ts --execute
 *   npx tsx scripts/ledger/retry-pending.ts --execute --limit 25
 *
 * Every row re-checks saleByStripeRef on-chain before sending, so a tx that
 * landed after a confirmation timeout is reconciled, not duplicated.
 */

import {
  anchorStripeSale,
  ledgerDb,
  lookupSaleId,
  type LedgerSource,
} from "../../src/lib/ledger-service";
import { EXPLORER_TX_BASE, isLedgerConfigured } from "../../src/lib/ledger-contract";

const argv = process.argv.slice(2);
const EXECUTE = argv.includes("--execute");
const LIMIT = Number(argv[argv.indexOf("--limit") + 1] || 100);

async function main() {
  const db = ledgerDb();
  if (!db) throw new Error("Supabase service credentials are not configured");
  if (EXECUTE && !isLedgerConfigured()) {
    throw new Error("Refusing to --execute: LEDGER_CONTRACT_ADDRESS is unset.");
  }

  const { data: rows, error } = await db
    .from("ledger_receipts")
    .select(
      "id,stripe_object_id,stripe_ref_hash,sku,amount_cents,currency,buyer_wallet,source,status,tx_hash,stripe_created_at,error"
    )
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(LIMIT);

  if (error) throw error;
  if (!rows?.length) {
    console.log("Nothing pending.");
    return;
  }

  console.log(`${EXECUTE ? "EXECUTE" : "DRY RUN"} — ${rows.length} row(s)\n`);

  let reconciled = 0;
  let anchored = 0;
  let stillFailing = 0;

  for (const row of rows) {
    const label = `${row.stripe_object_id} ${row.sku} ${(row.amount_cents / 100).toFixed(2)} ${row.currency} [${row.status}]`;

    // A tx we stopped waiting on may already be mined.
    const onchainId = await lookupSaleId(row.stripe_ref_hash);
    if (onchainId && onchainId !== "0") {
      if (EXECUTE) {
        await db
          .from("ledger_receipts")
          .update({
            status: "anchored",
            sale_id: onchainId,
            error: null,
            anchored_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
      reconciled++;
      console.log(`[rec] ${label} -> already on-chain as saleId ${onchainId}`);
      continue;
    }

    if (!EXECUTE) {
      console.log(`[dry] ${label} ${row.error ? `(${row.error})` : ""}`);
      continue;
    }

    const result = await anchorStripeSale({
      objectId: row.stripe_object_id,
      sku: row.sku,
      amountCents: row.amount_cents,
      currency: row.currency,
      buyerWallet: row.buyer_wallet,
      stripeCreated: row.stripe_created_at
        ? Math.floor(new Date(row.stripe_created_at).getTime() / 1000)
        : null,
      source: (row.source as LedgerSource) ?? "live",
      skipStripeWriteback: row.source === "backfill",
    });

    if (result.status === "anchored") {
      anchored++;
      console.log(`[ok ] ${label} tx=${EXPLORER_TX_BASE}${result.txHash}`);
    } else {
      stillFailing++;
      console.log(`[err] ${label} ${result.reason ?? result.status}`);
    }
  }

  console.log(`\nreconciled: ${reconciled}  anchored: ${anchored}  still failing: ${stillFailing}`);
  if (!EXECUTE) console.log("Dry run. Re-run with --execute.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
