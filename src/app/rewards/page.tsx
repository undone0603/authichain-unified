'use client';

import { useMemo, useState } from 'react';
import { Coins, Info } from 'lucide-react';
import {
  CATEGORY_MULTIPLIERS,
  BASE_REWARD,
  DAILY_CAP,
  estimateReward,
  type RewardCalculationInput,
} from '@/lib/reward-calculator';

const CATEGORY_LABELS: Record<string, string> = {
  luxury_fashion: 'Luxury Fashion',
  pharma: 'Pharmaceuticals',
  electronics: 'Electronics',
  automotive: 'Automotive Parts',
  food_bev: 'Food & Beverage',
  cosmetics: 'Cosmetics',
  cannabis: 'Cannabis',
  art_collectibles: 'Art & Collectibles',
  sports: 'Sports Merchandise',
  fashion_apparel: 'Fashion Apparel',
  other: 'Other',
};

const SCAN_TYPES: Array<{ value: RewardCalculationInput['scanType']; label: string }> = [
  { value: 'authentic', label: 'Authentic (verified genuine)' },
  { value: 'suspicious', label: 'Suspicious (flagged for review)' },
  { value: 'fake', label: 'Counterfeit (confirmed fake)' },
];

export default function RewardsCalculatorPage() {
  const [category, setCategory] = useState('other');
  const [scanType, setScanType] = useState<RewardCalculationInput['scanType']>('authentic');
  const [dailyTotal, setDailyTotal] = useState(0);

  const result = useMemo(
    () => estimateReward(category, scanType, dailyTotal),
    [category, scanType, dailyTotal],
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="pt-32 pb-16 px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6">
          <Coins className="w-3.5 h-3.5" />
          $QRON Rewards
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">
          What Does a <span className="gold-text">Scan</span> Earn?
        </h1>
        <p className="max-w-2xl mx-auto text-zinc-500 text-lg font-medium">
          Every verified scan earns $QRON. High-counterfeit-risk categories, consensus-aligned
          accuracy, and first-to-flag counterfeits all pay more. Estimate a scan below.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-32 grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Product Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            >
              {Object.keys(CATEGORY_MULTIPLIERS).map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key] ?? key} (x{CATEGORY_MULTIPLIERS[key]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Scan Outcome
            </label>
            <select
              value={scanType}
              onChange={(e) => setScanType(e.target.value as RewardCalculationInput['scanType'])}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            >
              {SCAN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              $QRON Already Earned Today: {dailyTotal.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={DAILY_CAP}
              step={0.1}
              value={dailyTotal}
              onChange={(e) => setDailyTotal(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>0 QRON</span>
              <span>{DAILY_CAP} QRON daily cap</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-zinc-600 border border-zinc-900 rounded p-4">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Base reward is {BASE_REWARD} QRON per scan. This estimate assumes consensus-aligned
              accuracy and normal scan velocity (no anti-gaming penalty).
            </span>
          </div>
        </div>

        {/* Result */}
        <div className="border border-zinc-800 rounded-xl p-8 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Estimated Reward
            </div>
            <div className="text-6xl font-black tracking-tighter gold-text mb-1">
              {result.finalReward.toFixed(4)}
            </div>
            <div className="text-sm text-zinc-500 uppercase tracking-widest mb-8">$QRON</div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span className="text-zinc-500">Base reward</span>
                <span>{result.baseReward.toFixed(4)} QRON</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span className="text-zinc-500">Category multiplier</span>
                <span>x{result.categoryMultiplier}</span>
              </div>
              {result.accuracyBonus > 0 && (
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500">Accuracy bonus</span>
                  <span>+{result.accuracyBonus.toFixed(4)}</span>
                </div>
              )}
              {result.firstFlagBonus > 0 && (
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500">First-flag bonus</span>
                  <span>+{result.firstFlagBonus.toFixed(4)}</span>
                </div>
              )}
              {result.dailyCapped && (
                <div className="flex justify-between text-amber-400">
                  <span>Daily cap applied</span>
                  <span>{DAILY_CAP} QRON</span>
                </div>
              )}
            </div>
          </div>

          <a
            href="/pricing"
            className="mt-8 w-full bg-blue-700 hover:bg-blue-600 text-white font-black uppercase tracking-widest py-4 rounded text-center transition-colors"
          >
            Start Scanning
          </a>
        </div>
      </section>
    </div>
  );
}
