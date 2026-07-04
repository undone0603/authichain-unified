import type { ReactNode } from 'react';
import { Globe, Zap, ShieldCheck, BadgeCheck, Award } from 'lucide-react';

export interface TrustRailItem {
  icon: ReactNode;
  label: string;
}

const DEFAULT_ITEMS: TrustRailItem[] = [
  { icon: <Globe className="h-4 w-4" />, label: '38 Global Markets' },
  { icon: <Zap className="h-4 w-4" />, label: '< 1 Second Verification' },
  { icon: <ShieldCheck className="h-4 w-4" />, label: 'DFARS / FAR Compliant' },
  { icon: <BadgeCheck className="h-4 w-4" />, label: 'EU DPP Ready' },
  { icon: <Award className="h-4 w-4" />, label: 'NSF SBIR Awardee' },
];

/**
 * Social-proof / trust rail. A compact stats + credential strip designed to
 * sit directly below a hero section on any brand landing page. Server-safe
 * (no client state). Accent color is passed per-brand so it matches the host.
 */
export function TrustRail({
  accent = '#f59e0b',
  items = DEFAULT_ITEMS,
}: {
  accent?: string;
  items?: TrustRailItem[];
}) {
  return (
    <section
      aria-label="Trust indicators"
      className="border-y border-zinc-900 bg-zinc-950/60 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-6xl px-6 py-5">
        <p className="mb-4 text-center text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600">
          Trusted infrastructure for regulated supply chains
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map((it, i) => (
            <div key={it.label} className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-300">
                <span style={{ color: accent }}>{it.icon}</span>
                {it.label}
              </div>
              {i < items.length - 1 && (
                <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:inline-block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
