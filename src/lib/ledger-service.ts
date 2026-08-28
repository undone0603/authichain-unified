/**
 * lib/ledger-service.ts
 *
 * Anchors Stripe money-movement events to AuthiChainLedger on Polygon and
 * mirrors them into public.ledger_receipts.
 *
 * Rules this file exists to enforce:
 *   1. Nothing here ever throws into the Stripe webhook path. Every public
 *      function returns a result object; chain failures become failed rows.
 *   2. No PII crosses the chain boundary. Only keccak(objectId), sku, amount,
 *      currency code, optional buyer wallet, source flag and Stripe timestamp.
 *   3. Idempotent on stripe_object_id (DB) and stripeRef (chain).
 *
 * Modeled on the NFT minting service: same wallet / RPC / provider pattern,
 * same env keys for the signer. Deliberately shares no ABI or state with the
 * NFT contract.
 */

import { ethers } from "ethers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  CURRENCY_CODES,
  EXPLORER_TX_BASE,
  LEDGER_ABI,
  LEDGER_CHAIN_ID,
  LEDGER_CONTRACT_ADDRESS,
  LEDGER_RPC_URL,
  SOURCE_BACKFILL,
  SOURCE_LIVE,
  isLedgerConfigured,
} from "./ledger-contract";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LedgerSource = "live" | "backfill";

export type LedgerStatus = "pending" | "anchored" | "reversed" | "failed";

export interface AnchorSaleInput {
  /** Stripe event id — the DB unique key that makes replayed webhooks free. */
  eventId?: string | null;
  /** cs_... | in_... | ch_... — the thing keccak'd into stripeRef. */
  objectId: string;
  sku: string;
  amountCents: number;
  currency?: string;
  buyerWallet?: string | null;
  /** Stripe `created`, unix seconds. */
  stripeCreated?: number | null;
  source?: LedgerSource;
  /** Optional, used only for best-effort Stripe metadata write-back. */
  paymentIntentId?: string | null;
  invoiceId?: string | null;
  checkoutSessionId?: string | null;
  /** Skip the metadata write-back (backfill sets this true). */
  skipStripeWriteback?: boolean;
}

export interface AnchorResult {
  ok: boolean;
  status: LedgerStatus | "skipped";
  reason?: string;
  stripeRef?: string;
  saleId?: string;
  txHash?: string;
  explorerUrl?: string;
}

// ---------------------------------------------------------------------------
// Encoding helpers (pure — safe to import anywhere, incl. scripts and pages)
// ---------------------------------------------------------------------------

/** stripeRef = keccak256(utf8(stripeObjectId)). One-way; not reversible. */
export function stripeRefHash(objectId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(objectId));
}

/**
 * sku -> bytes32. Short ascii slugs are stored readably (right-padded);
 * anything longer than 31 bytes is hashed so it still fits deterministically.
 */
export function skuToBytes32(raw?: string | null): string {
  const sku = (raw ?? "").trim() || "unknown";
  const bytes = ethers.toUtf8Bytes(sku);
  if (bytes.length <= 31) return ethers.encodeBytes32String(sku);
  return ethers.keccak256(bytes);
}

/** Decodes a bytes32 sku back to text when it was stored readably. */
export function bytes32ToSku(value: string): string | null {
  try {
    return ethers.decodeBytes32String(value);
  } catch {
    return null;
  }
}

/** Valid checksum-able address, else address(0). Never throws. */
export function normalizeBuyer(wallet?: string | null): string {
  if (!wallet) return ethers.ZeroAddress;
  try {
    return ethers.getAddress(wallet.trim());
  } catch {
    return ethers.ZeroAddress;
  }
}

/** Returns null for currencies we have no on-chain code for. */
export function currencyCode(currency?: string | null): number | null {
  const key = (currency ?? "usd").trim().toLowerCase();
  return key in CURRENCY_CODES ? CURRENCY_CODES[key] : null;
}

export function sourceCode(source: LedgerSource): number {
  return source === "backfill" ? SOURCE_BACKFILL : SOURCE_LIVE;
}

// ---------------------------------------------------------------------------
// Chain plumbing
// ---------------------------------------------------------------------------

const WAIT_TIMEOUT_MS = Number(process.env.LEDGER_WAIT_TIMEOUT_MS ?? 45_000);

let cachedContract: ethers.Contract | null = null;

function minterKey(): string | null {
  const key = (process.env.MINTER_PRIVATE_KEY || process.env.THIRDWEB_MINTER_KEY || "").trim();
  return key ? (key.startsWith("0x") ? key : `0x${key}`) : null;
}

function getLedgerContract(): ethers.Contract | null {
  if (cachedContract) return cachedContract;
  if (!isLedgerConfigured()) return null;

  const key = minterKey();
  if (!key) return null;

  const provider = new ethers.JsonRpcProvider(LEDGER_RPC_URL, LEDGER_CHAIN_ID, {
    staticNetwork: true,
  });
  const wallet = new ethers.Wallet(key, provider);

  cachedContract = new ethers.Contract(LEDGER_CONTRACT_ADDRESS, LEDGER_ABI as unknown as string[], wallet);
  return cachedContract;
}

/**
 * Serializes transactions inside a single runtime so two concurrent webhooks
 * cannot grab the same nonce. Cross-instance safety comes from the on-chain
 * saleIdByRef check plus the DB unique index, not from this queue.
 */
let txQueue: Promise<unknown> = Promise.resolve();

function enqueueTx<T>(fn: () => Promise<T>): Promise<T> {
  const next = txQueue.then(fn, fn);
  txQueue = next.catch(() => undefined);
  return next;
}

export interface ChainWriteResult {
  ok: boolean;
  /** true when the ref was already on-chain and no tx was sent. */
  duplicate?: boolean;
  /** true when the tx was broadcast but not confirmed inside the timeout. */
  unconfirmed?: boolean;
  saleId?: string;
  txHash?: string;
  error?: string;
}

/** Reads the existing saleId for a ref. Returns null on RPC failure. */
export async function lookupSaleId(stripeRef: string): Promise<string | null> {
  const contract = getLedgerContract();
  if (!contract) return null;
  try {
    const id: bigint = await contract.saleIdByRef(stripeRef);
    return id > 0n ? id.toString() : "0";
  } catch {
    return null;
  }
}

/** Sends recordSale. Never throws. */
export async function recordSaleOnchain(params: {
  stripeRef: string;
  sku: string;
  amountCents: number;
  currency: string;
  buyerWallet?: string | null;
  source: LedgerSource;
  stripeCreated?: number | null;
}): Promise<ChainWriteResult> {
  const contract = getLedgerContract();
  if (!contract) {
    return {
      ok: false,
      error: isLedgerConfigured()
        ? "MINTER_PRIVATE_KEY / THIRDWEB_MINTER_KEY unset"
        : "LEDGER_CONTRACT_ADDRESS unset",
    };
  }

  const code = currencyCode(params.currency);
  if (code === null) {
    return { ok: false, error: `unsupported currency: ${params.currency}` };
  }

  return enqueueTx(async () => {
    try {
      // Cheap pre-flight: another instance (or an earlier retry whose receipt
      // we lost) may already have anchored this ref.
      const existing: bigint = await contract.saleIdByRef(params.stripeRef);
      if (existing > 0n) {
        return { ok: true, duplicate: true, saleId: existing.toString() };
      }

      const tx = await contract.recordSale(
        params.stripeRef,
        skuToBytes32(params.sku),
        BigInt(Math.round(params.amountCents)),
        code,
        normalizeBuyer(params.buyerWallet),
        sourceCode(params.source),
        BigInt(Math.max(0, Math.floor(params.stripeCreated ?? 0)))
      );

      const receipt = await contract.runner!.provider!.waitForTransaction(
        tx.hash,
        1,
        WAIT_TIMEOUT_MS
      );

      if (!receipt) {
        // Broadcast but not mined in time. The tx may still land; retry-pending
        // re-checks saleByStripeRef before ever sending a second tx.
        return { ok: true, unconfirmed: true, txHash: tx.hash };
      }

      let saleId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "SaleRecorded" || parsed?.name === "DuplicateSaleIgnored") {
            saleId = (parsed.args[0] as bigint).toString();
            break;
          }
        } catch {
          /* not one of ours */
        }
      }

      if (!saleId) {
        const id: bigint = await contract.saleIdByRef(params.stripeRef);
        saleId = id.toString();
      }

      return { ok: true, saleId, txHash: tx.hash };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

/** Sends recordReversal. Never throws. */
export async function reverseSaleOnchain(stripeRef: string): Promise<ChainWriteResult> {
  const contract = getLedgerContract();
  if (!contract) {
    return {
      ok: false,
      error: isLedgerConfigured()
        ? "MINTER_PRIVATE_KEY / THIRDWEB_MINTER_KEY unset"
        : "LEDGER_CONTRACT_ADDRESS unset",
    };
  }

  return enqueueTx(async () => {
    try {
      const saleId: bigint = await contract.saleIdByRef(stripeRef);
      if (saleId === 0n) {
        return { ok: false, error: "sale not anchored on-chain" };
      }

      const sale = await contract.saleByStripeRef(stripeRef);
      if (sale.reversed) {
        return { ok: true, duplicate: true, saleId: saleId.toString() };
      }

      const tx = await contract.recordReversal(stripeRef);
      const receipt = await contract.runner!.provider!.waitForTransaction(
        tx.hash,
        1,
        WAIT_TIMEOUT_MS
      );

      if (!receipt) return { ok: true, unconfirmed: true, txHash: tx.hash, saleId: saleId.toString() };
      return { ok: true, saleId: saleId.toString(), txHash: tx.hash };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

let cachedDb: SupabaseClient | null = null;

export function ledgerDb(): SupabaseClient | null {
  if (cachedDb) return cachedDb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedDb = createClient(url, key, { auth: { persistSession: false } });
  return cachedDb;
}

function isoOrNull(unixSeconds?: number | null): string | null {
  if (!unixSeconds || unixSeconds <= 0) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Stripe metadata write-back (best effort, never fatal)
// ---------------------------------------------------------------------------

async function writeBackStripeMetadata(
  input: AnchorSaleInput,
  txHash: string,
  saleId?: string
): Promise<void> {
  if (input.skipStripeWriteback) return;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return;

  const metadata: Record<string, string> = {
    polygon_tx: txHash,
    polygonscan: `${EXPLORER_TX_BASE}${txHash}`,
  };
  if (saleId) metadata.ledger_sale_id = saleId;

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secret);

    const sessionId = input.checkoutSessionId ?? (input.objectId.startsWith("cs_") ? input.objectId : null);
    const invoiceId = input.invoiceId ?? (input.objectId.startsWith("in_") ? input.objectId : null);
    const piId = input.paymentIntentId;

    await Promise.allSettled([
      sessionId ? stripe.checkout.sessions.update(sessionId, { metadata }) : Promise.resolve(),
      invoiceId ? stripe.invoices.update(invoiceId, { metadata }) : Promise.resolve(),
      piId ? stripe.paymentIntents.update(piId, { metadata }) : Promise.resolve(),
    ]);
  } catch (err) {
    console.warn("[ledger] stripe metadata write-back skipped:", err);
  }
}

// ---------------------------------------------------------------------------
// Public entry points used by the webhook
// ---------------------------------------------------------------------------

/**
 * Upsert a pending receipt, anchor it, record the outcome.
 * Always resolves. Callers must not await-and-throw on this.
 */
export async function anchorStripeSale(input: AnchorSaleInput): Promise<AnchorResult> {
  const source: LedgerSource = input.source ?? "live";
  const currency = (input.currency ?? "usd").toLowerCase();
  const stripeRef = stripeRefHash(input.objectId);

  try {
    if (!input.objectId) return { ok: false, status: "skipped", reason: "missing objectId" };
    if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
      return { ok: false, status: "skipped", reason: "non-positive amount" };
    }

    const db = ledgerDb();

    // --- idempotency gate -------------------------------------------------
    if (db) {
      const { data: existing } = await db
        .from("ledger_receipts")
        .select("id,status,tx_hash,sale_id")
        .eq("stripe_object_id", input.objectId)
        .maybeSingle();

      if (existing && (existing.status === "anchored" || existing.status === "reversed")) {
        return {
          ok: true,
          status: existing.status as LedgerStatus,
          stripeRef,
          saleId: existing.sale_id ?? undefined,
          txHash: existing.tx_hash ?? undefined,
          explorerUrl: existing.tx_hash ? `${EXPLORER_TX_BASE}${existing.tx_hash}` : undefined,
          reason: "already anchored",
        };
      }

      await db.from("ledger_receipts").upsert(
        {
          stripe_event_id: input.eventId ?? null,
          stripe_object_id: input.objectId,
          sku: input.sku || "unknown",
          amount_cents: Math.round(input.amountCents),
          currency,
          buyer_wallet: normalizeBuyer(input.buyerWallet) === ethers.ZeroAddress
            ? null
            : normalizeBuyer(input.buyerWallet),
          stripe_ref_hash: stripeRef,
          source,
          status: "pending",
          stripe_created_at: isoOrNull(input.stripeCreated),
        },
        { onConflict: "stripe_object_id" }
      );
    }

    // --- chain ------------------------------------------------------------
    const chain = await recordSaleOnchain({
      stripeRef,
      sku: input.sku,
      amountCents: input.amountCents,
      currency,
      buyerWallet: input.buyerWallet,
      source,
      stripeCreated: input.stripeCreated,
    });

    if (!chain.ok) {
      if (db) {
        await db
          .from("ledger_receipts")
          .update({ status: "failed", error: chain.error?.slice(0, 500) ?? "unknown error" })
          .eq("stripe_object_id", input.objectId);
      }
      console.error("[ledger] anchor failed", input.objectId, chain.error);
      return { ok: false, status: "failed", reason: chain.error, stripeRef };
    }

    if (chain.unconfirmed) {
      if (db) {
        await db
          .from("ledger_receipts")
          .update({ status: "pending", tx_hash: chain.txHash, error: "confirmation timeout" })
          .eq("stripe_object_id", input.objectId);
      }
      return { ok: true, status: "pending", stripeRef, txHash: chain.txHash, reason: "confirmation timeout" };
    }

    if (db) {
      await db
        .from("ledger_receipts")
        .update({
          status: "anchored",
          tx_hash: chain.txHash ?? null,
          sale_id: chain.saleId ?? null,
          error: null,
          anchored_at: new Date().toISOString(),
        })
        .eq("stripe_object_id", input.objectId);
    }

    if (chain.txHash) {
      await writeBackStripeMetadata(input, chain.txHash, chain.saleId);
    }

    return {
      ok: true,
      status: "anchored",
      stripeRef,
      saleId: chain.saleId,
      txHash: chain.txHash,
      explorerUrl: chain.txHash ? `${EXPLORER_TX_BASE}${chain.txHash}` : undefined,
    };
  } catch (err) {
    // Absolute backstop: the webhook must never 500 because of the ledger.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ledger] anchorStripeSale threw (swallowed)", input.objectId, message);
    try {
      await ledgerDb()
        ?.from("ledger_receipts")
        .update({ status: "failed", error: message.slice(0, 500) })
        .eq("stripe_object_id", input.objectId);
    } catch {
      /* give up quietly */
    }
    return { ok: false, status: "failed", reason: message, stripeRef };
  }
}

/**
 * Mark a previously anchored sale reversed. `candidateObjectIds` is tried in
 * order — a refund arrives as ch_/pi_ but the sale was anchored under cs_/in_.
 * Unknown sales are skipped, not errors.
 */
export async function anchorStripeReversal(params: {
  eventId?: string | null;
  candidateObjectIds: (string | null | undefined)[];
}): Promise<AnchorResult> {
  const candidates = params.candidateObjectIds.filter(Boolean) as string[];
  if (candidates.length === 0) return { ok: true, status: "skipped", reason: "no candidate object id" };

  try {
    const db = ledgerDb();

    for (const objectId of candidates) {
      const stripeRef = stripeRefHash(objectId);

      let row: { status: string } | null = null;
      if (db) {
        const { data } = await db
          .from("ledger_receipts")
          .select("status")
          .eq("stripe_object_id", objectId)
          .maybeSingle();
        row = data;
        if (!row) continue; // never anchored under this id — try the next
        if (row.status === "reversed") {
          return { ok: true, status: "reversed", stripeRef, reason: "already reversed" };
        }
      }

      const chain = await reverseSaleOnchain(stripeRef);

      if (!chain.ok) {
        if (chain.error === "sale not anchored on-chain") continue;
        if (db) {
          await db
            .from("ledger_receipts")
            .update({ error: chain.error?.slice(0, 500) ?? "reversal failed" })
            .eq("stripe_object_id", objectId);
        }
        return { ok: false, status: "failed", reason: chain.error, stripeRef };
      }

      if (db) {
        await db
          .from("ledger_receipts")
          .update({
            status: "reversed",
            tx_hash: chain.txHash ?? undefined,
            sale_id: chain.saleId ?? undefined,
            error: chain.unconfirmed ? "confirmation timeout" : null,
          })
          .eq("stripe_object_id", objectId);
      }

      return {
        ok: true,
        status: "reversed",
        stripeRef,
        saleId: chain.saleId,
        txHash: chain.txHash,
        explorerUrl: chain.txHash ? `${EXPLORER_TX_BASE}${chain.txHash}` : undefined,
      };
    }

    return { ok: true, status: "skipped", reason: "no anchored sale for these ids" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ledger] anchorStripeReversal threw (swallowed)", message);
    return { ok: false, status: "failed", reason: message };
  }
}

// ---------------------------------------------------------------------------
// Metadata extraction helpers for the webhook
// ---------------------------------------------------------------------------

type MetaBag = Record<string, string | undefined> | null | undefined;

/** metadata.sku || metadata.planKey || metadata.plan || priceId || "unknown" */
export function resolveSku(metadata: MetaBag, priceId?: string | null): string {
  return (
    metadata?.sku?.trim() ||
    metadata?.planKey?.trim() ||
    metadata?.plan?.trim() ||
    priceId?.trim() ||
    "unknown"
  );
}

/** Reads a buyer wallet out of any of the metadata bags on the object. */
export function resolveBuyerWallet(...bags: MetaBag[]): string | null {
  for (const bag of bags) {
    const candidate = bag?.buyerWallet || bag?.buyer_wallet || bag?.wallet;
    if (candidate && normalizeBuyer(candidate) !== ethers.ZeroAddress) {
      return normalizeBuyer(candidate);
    }
  }
  return null;
}
