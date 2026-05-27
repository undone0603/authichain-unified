"use client";

import { useMemo, useState } from "react";

export function PricingCalculator() {
  const [products, setProducts] = useState(10000);
  const [scans, setScans] = useState(50000);

  const { monthly, plan, savings } = useMemo(() => {
    const base = 0.0005; // per-scan rate
    const est = scans * base;
    let plan = "Starter";
    if (scans > 100000) plan = "Growth";
    if (scans > 500000) plan = "Enterprise";
    const rack = est * 1.3;
    const savings = rack - est;
    return { monthly: est, plan, savings };
  }, [scans]);

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-white/50">
          Cost estimator
        </div>
        <div className="text-[11px] text-white/60">
          Rough illustration · not a quote
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-[11px] text-white/70">
            Products under management
            <input
              type="number"
              value={products}
              onChange={(e) => setProducts(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs"
            />
          </label>
          <label className="block text-[11px] text-white/70">
            Monthly scans
            <input
              type="number"
              value={scans}
              onChange={(e) => setScans(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs"
            />
          </label>
        </div>
        <div className="space-y-2 text-xs">
          <div>
            <div className="text-white/50">Estimated monthly cost</div>
            <div className="text-lg font-semibold">
              ${monthly.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-white/50">Recommended plan</div>
            <div className="text-sm text-white">{plan}</div>
          </div>
          <div>
            <div className="text-white/50">Savings vs rack‑rate</div>
            <div className="text-sm text-emerald-300">
              ${savings.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
