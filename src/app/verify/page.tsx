"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { QrScanner, validateAndExtract } from "./scanner";

const STARTER_SUB_URL = "https://buy.stripe.com/9B67sL87n7Fkh0SgXW1NE04";
const STARTER_ONE_TIME_URL = "/checkout/starter";
const DPP_URL = "/checkout/dpp_readiness";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id") || "";
  const [id, setId] = useState(initialId);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const runVerify = async (sealId: string) => {
    setLoading(true);
    setVerdict(null);
    setReasons([]);
    try {
      const res = await fetch(`/api/verify-proxy?id=${encodeURIComponent(sealId)}`);
      const body = await res.json();
      setVerdict(body.verdict || body.decision || body.error || "indeterminate");
      setReasons(Array.isArray(body.reasons) ? body.reasons.map(String) : []);
      (window as any).track?.('verify_result_viewed', { id: sealId });
    } catch {
      setVerdict("verification_failed");
    } finally {
      setLoading(false);
    }
  };

  const onScan = (scanned: string) => {
    const v = validateAndExtract(scanned);
    if (!v.ok) return;
    setId(v.id);
    router.replace(`/verify?id=${encodeURIComponent(v.id)}`);
    runVerify(v.id);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateAndExtract(id);
    if (!v.ok) {
      setVerdict("invalid_id");
      return;
    }
    router.replace(`/verify?id=${encodeURIComponent(v.id)}`);
    runVerify(v.id);
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-xl mx-auto">
        <h1 className="text-4xl font-black tracking-tight mb-2">Check a seal</h1>
        <p className="text-zinc-400 mb-8">
          Scan the QR on the product or paste a seal ID. We return the exact protocol verdict.
        </p>

        <QrScanner onResult={onScan} />

        <form onSubmit={onSubmit} className="flex gap-2 mt-6 mb-8">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="or paste seal ID / object_id"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm"
          />
          <button
            type="submit"
            className="bg-zinc-800 text-white font-black px-6 py-3 rounded-lg text-sm uppercase"
            disabled={loading}
          >
            {loading ? "…" : "Verify"}
          </button>
        </form>

        {verdict && (
          <div className="border border-zinc-800 rounded-xl p-6 mb-8">
            <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">
              Protocol verdict
            </div>
            <div className="text-xl font-black mb-2">{verdict}</div>
            {reasons.length > 0 && (
              <p className="text-sm text-zinc-400">
                {reasons.map(r => r.replace(/_/g, " ")).join(", ")}
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
              A “verified” verdict means the signature is valid and the hash matches the anchor. It does not prove the physical product is authentic.
            </p>
            <div className="mt-6 rounded-lg border border-steel/20 bg-ivory/50 p-4 text-sm">
              <h3 className="font-medium text-ink">Protect your own products</h3>
              <p className="mt-1 text-charcoal">
                Start with 100 AI QR generations. $29 one-time or $19/mo Launch. Self-serve Stripe. No call.
              </p>
              <div className="mt-3 flex gap-2">
                <a
                  href="/onboard?plan=starter-pack-29"
                  className="rounded bg-navy px-3 py-1.5 text-ivory text-xs font-medium"
                  onClick={() => (window as any).track?.('verify_cta_clicked', { plan: '29' })}
                >
                  Buy Starter Pack — $29
                </a>
                <a
                  href="/onboard?plan=launch-19"
                  className="rounded border border-steel px-3 py-1.5 text-xs"
                  onClick={() => (window as any).track?.('verify_cta_clicked', { plan: '19' })}
                >
                  $19/mo Launch
                </a>
              </div>
              <p className="mt-2 text-xs text-steel">
                A verified result confirms the on-chain record. It does not by itself prove the physical item is authentic.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href={STARTER_SUB_URL}
            className="block w-full text-center bg-white text-black font-black py-4 rounded-xl text-sm uppercase tracking-wide"
          >
            Issue seals for your products — Starter $49/mo
          </Link>
          <Link
            href={STARTER_ONE_TIME_URL}
            className="block w-full text-center border border-zinc-700 py-3 rounded-xl text-sm font-bold"
          >
            Try 100 generations once — $29
          </Link>
          <Link href={DPP_URL} className="block w-full text-center text-zinc-400 py-2 text-xs">
            EU DPP Readiness workspace — $299
          </Link>
        </div>
      </div>
    </main>
  );
}

// useSearchParams() needs a Suspense boundary or the static prerender of
// /verify fails the production build (same pattern as /success, /login).
export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <VerifyContent />
    </Suspense>
  );
}
