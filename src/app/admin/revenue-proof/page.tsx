"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import type { RevenueProof } from "@/lib/revenue-proof";

const LABELS: Record<
  keyof Omit<RevenueProof, "generated_at" | "revenue_by_surface">,
  string
> = {
  verification_requests: "Verification requests",
  verified_objects: "Verified objects",
  failed_counterfeit_review: "Failed / counterfeit / review",
  checkout_visits: "Checkout visits",
  stripe_conversions: "Stripe conversions",
  activated_merchants: "Activated merchants",
  provisioning_success: "Provisioning success",
  retained_merchants: "Retained merchants",
  failed_autonomous_actions: "Failed autonomous actions",
  visit_count: "Visits in window",
};

export default function RevenueProofPage() {
  const [data, setData] = useState<RevenueProof | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue-proof", {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="text-zinc-500 text-sm inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Admin
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="text-zinc-400 text-xs uppercase tracking-widest inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2">
            Observable loop
          </p>
          <h1 className="text-3xl font-black uppercase">Revenue proof</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Derived from funnel_events at read time. Not a stored total.
          </p>
        </header>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {data && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map(key => (
                <div
                  key={key}
                  className="border border-zinc-900 bg-zinc-950 p-6"
                >
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                    {LABELS[key]}
                  </p>
                  <p className="text-3xl font-black">{data[key]}</p>
                </div>
              ))}
            </div>
            <section className="border border-zinc-900 bg-zinc-950 p-6">
              <h2 className="text-sm font-black uppercase tracking-widest mb-4">
                Revenue by surface
              </h2>
              {Object.keys(data.revenue_by_surface).length === 0 ? (
                <p className="text-zinc-600 text-sm">No surface events yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(data.revenue_by_surface).map(
                    ([surface, count]) => (
                      <li
                        key={surface}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-zinc-400">{surface}</span>
                        <span className="font-black">{count}</span>
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
