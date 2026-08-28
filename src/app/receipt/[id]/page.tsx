/**
 * app/receipt/[id]/page.tsx
 *
 * Public, PII-free proof-of-sale page.
 *   /receipt/cs_live_a1b2...      (Stripe object id)
 *   /receipt/0x9f3c...            (stripeRef hash)
 *
 * Shows only what is already on-chain. No email, no name, no card, no invoice.
 * Copy is explicit about whether the anchor is contemporaneous (live) or
 * published later from Stripe records (backfill) — a backfill block time is
 * never presented as the payment time.
 */

import { notFound } from "next/navigation";

import { ledgerDb } from "@/lib/ledger-service";
import { EXPLORER_TX_BASE } from "@/lib/ledger-contract";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Receipt {
  stripe_object_id: string;
  stripe_ref_hash: string;
  sku: string;
  amount_cents: number;
  currency: string;
  buyer_wallet: string | null;
  source: "live" | "backfill";
  status: "pending" | "anchored" | "reversed" | "failed";
  tx_hash: string | null;
  sale_id: string | null;
  stripe_created_at: string | null;
  anchored_at: string | null;
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
}

const STATUS_COPY: Record<Receipt["status"], { label: string; tone: string }> = {
  anchored: { label: "Anchored on Polygon", tone: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  reversed: { label: "Reversed (refunded or voided)", tone: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  pending: { label: "Anchor pending", tone: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  failed: { label: "Anchor failed — retry queued", tone: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
};

async function loadReceipt(id: string): Promise<Receipt | null> {
  const db = ledgerDb();
  if (!db) return null;

  const column = id.startsWith("0x") && id.length === 66 ? "stripe_ref_hash" : "stripe_object_id";

  const { data } = await db
    .from("ledger_receipts")
    .select(
      "stripe_object_id,stripe_ref_hash,sku,amount_cents,currency,buyer_wallet,source,status,tx_hash,sale_id,stripe_created_at,anchored_at"
    )
    .eq(column, id)
    .maybeSingle();

  return (data as Receipt) ?? null;
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await loadReceipt(decodeURIComponent(id));

  if (!receipt) notFound();

  const status = STATUS_COPY[receipt.status];

  const provenance =
    receipt.source === "live"
      ? "Anchored at payment time."
      : `Published from Stripe records on ${formatDate(receipt.anchored_at)}; original Stripe time ${formatDate(receipt.stripe_created_at)}.`;

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="text-xs uppercase tracking-widest text-neutral-500">AuthiChain Ledger</p>
      <h1 className="mt-1 text-2xl font-semibold">Sale receipt</h1>

      <div className={`mt-4 inline-block rounded-full border px-3 py-1 text-sm ${status.tone}`}>
        {status.label}
      </div>

      <dl className="mt-8 divide-y divide-neutral-800 border-y border-neutral-800 text-sm">
        <Row label="SKU" value={receipt.sku} />
        <Row label="Amount" value={formatMoney(receipt.amount_cents, receipt.currency)} />
        <Row label="Currency" value={receipt.currency.toUpperCase()} />
        <Row label="Payment time (Stripe)" value={formatDate(receipt.stripe_created_at)} />
        <Row label="Anchored" value={formatDate(receipt.anchored_at)} />
        <Row label="Source" value={receipt.source === "live" ? "Live" : "Backfill"} />
        {receipt.sale_id ? <Row label="Sale ID" value={`#${receipt.sale_id}`} /> : null}
        {receipt.buyer_wallet ? <Row label="Buyer wallet" value={receipt.buyer_wallet} mono /> : null}
        <Row label="Stripe reference hash" value={receipt.stripe_ref_hash} mono />
      </dl>

      <p className="mt-4 text-sm text-neutral-400">{provenance}</p>

      {receipt.tx_hash ? (
        <a
          href={`${EXPLORER_TX_BASE}${receipt.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-500"
        >
          View on Polygonscan ↗
        </a>
      ) : null}

      <p className="mt-8 text-xs leading-relaxed text-neutral-500">
        This record contains no personal information. The Stripe reference hash is a one-way
        keccak256 commitment to the payment object id — anyone holding that id can verify this
        receipt, and no one can derive it from the chain.
      </p>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="shrink-0 text-neutral-400">{label}</dt>
      <dd className={`text-right ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
