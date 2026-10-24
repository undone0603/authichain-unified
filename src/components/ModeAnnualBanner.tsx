'use client';

import { gatedCheckoutUrl } from '@/lib/plans';

interface ModeAnnualBannerProps {
  modeId?: string;
  remainingCredits?: number;
}

export function ModeAnnualBanner({ modeId, remainingCredits }: ModeAnnualBannerProps) {
  if (!modeId || (remainingCredits != null && remainingCredits >= 30)) return null;

  return (
    <div className="mt-4 p-4 border border-gold/30 rounded-lg bg-gold/5 text-sm">
      <p className="text-white">
        Save 2 months. Switch to Launch Annual — $190/yr for 1,200 generations. Cancel any time.
      </p>
      <a
        href={gatedCheckoutUrl('qron_launch_annual')}
        className="mt-2 inline-block px-4 py-2 bg-gold text-black font-bold rounded text-sm hover:bg-gold/90"
      >
        Upgrade to Annual
      </a>
      <p className="mt-1 text-xs text-zinc-500">Uses existing Launch Annual plan. No new SKU.</p>
    </div>
  );
}
