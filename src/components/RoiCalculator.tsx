'use client';

import { useMemo, useState } from 'react';
import { Calculator, ShieldAlert, TrendingUp } from 'lucide-react';

/**
 * Compact ROI calculator. Estimates the counterfeit loss AuthiChain/QRON
 * prevents and the resulting ROI against the subscription cost.
 *
 *   counterfeit loss (monthly) = units * value * 0.02
 *   ROI %                       = counterfeit loss prevented / subscription cost * 100
 */
export function RoiCalculator({
  accent = '#f59e0b',
  subscriptionCost = 199,
  planLabel = 'AuthiChain',
}: {
  accent?: string;
  subscriptionCost?: number;
  planLabel?: string;
}) {
  const [units, setUnits] = useState(10000);
  const [value, setValue] = useState(50);

  const { lossPrevented, annualPrevented, roi } = useMemo(() => {
    const monthly = Math.max(0, units) * Math.max(0, value) * 0.02;
    const roiPct = subscriptionCost > 0 ? (monthly / subscriptionCost) * 100 : 0;
    return {
      lossPrevented: monthly,
      annualPrevented: monthly * 12,
      roi: roiPct,
    };
  }, [units, value, subscriptionCost]);

  const money = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <div className="mb-10 text-center">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ borderColor: `${accent}40`, color: accent, backgroundColor: `${accent}0d` }}
        >
          <Calculator className="h-3 w-3" />
          ROI Calculator
        </span>
        <h2 className="mt-6 text-3xl font-black uppercase tracking-tighter md:text-4xl">
          What Counterfeits <span style={{ color: accent }}>Cost You</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm font-medium uppercase tracking-widest text-zinc-500">
          Estimate the loss you prevent by authenticating every unit.
        </p>
      </div>

      <div className="grid gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 md:grid-cols-2 md:p-10">
        {/* Inputs */}
        <div className="space-y-8">
          <div>
            <label className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-zinc-400">
              Units / month
              <span style={{ color: accent }}>{units.toLocaleString('en-US')}</span>
            </label>
            <input
              type="range"
              min={100}
              max={500000}
              step={100}
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
              className="w-full accent-current"
              style={{ accentColor: accent }}
            />
            <input
              type="number"
              min={0}
              value={units}
              onChange={(e) => setUnits(Number(e.target.value) || 0)}
              className="protocol-input mt-3 w-full px-4 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-zinc-400">
              Avg product value
              <span style={{ color: accent }}>{money(value)}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5000}
              step={1}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: accent }}
            />
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(Number(e.target.value) || 0)}
              className="protocol-input mt-3 w-full px-4 py-2 text-sm"
            />
          </div>
        </div>

        {/* Outputs */}
        <div className="flex flex-col justify-center gap-6 rounded-xl border border-zinc-800 bg-black/40 p-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <ShieldAlert className="h-3.5 w-3.5" style={{ color: accent }} />
              Counterfeit loss prevented / mo
            </div>
            <div className="mt-1 text-3xl font-black tracking-tighter" style={{ color: accent }}>
              {money(lossPrevented)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              {money(annualPrevented)} per year
            </div>
          </div>

          <div className="h-px bg-zinc-800" />

          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <TrendingUp className="h-3.5 w-3.5" style={{ color: accent }} />
              Return on {planLabel} ({money(subscriptionCost)}/mo)
            </div>
            <div className="mt-1 text-4xl font-black tracking-tighter text-white">
              {roi >= 1000
                ? `${(roi / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
                : roi.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              <span className="text-xl" style={{ color: accent }}>
                % ROI
              </span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[9px] font-bold uppercase tracking-widest text-zinc-700">
        Estimate only. Assumes a 2% counterfeit exposure rate on protected units.
      </p>
    </section>
  );
}
