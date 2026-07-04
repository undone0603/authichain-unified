'use client';

import { useEffect, useRef, useState } from 'react';

interface StatDef {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
}

const DEFAULT_STATS: StatDef[] = [
  { value: 10000, suffix: '+', label: 'QRONs Generated' },
  { value: 2.4, prefix: '$', suffix: 'B', decimals: 1, label: 'EU DPP Market Opportunity' },
  { value: 19, label: 'Deployed Edge Workers' },
  { value: 2.1, suffix: 's', decimals: 1, label: 'Avg Verification Time' },
];

function formatNumber(n: number, decimals: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function Counter({ stat, active, accent }: { stat: StatDef; active: boolean; accent: string }) {
  const [display, setDisplay] = useState(0);
  const decimals = stat.decimals ?? 0;

  useEffect(() => {
    if (!active) return;
    const duration = 1800;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutExpo for a punchy count-up
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(stat.value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, stat.value]);

  return (
    <div className="text-center">
      <div
        className="text-4xl font-black tracking-tighter md:text-5xl"
        style={{ color: accent }}
      >
        {stat.prefix}
        {formatNumber(display, decimals)}
        {stat.suffix}
      </div>
      <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {stat.label}
      </div>
    </div>
  );
}

/**
 * Animated "live stats" counter band. Uses an IntersectionObserver to trigger
 * a requestAnimationFrame count-up the first time it scrolls into view.
 */
export function LiveStatsCounter({
  accent = '#f59e0b',
  stats = DEFAULT_STATS,
}: {
  accent?: string;
  stats?: StatDef[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="border-y border-zinc-900 bg-zinc-950/50 px-6 py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-10 md:grid-cols-4">
        {stats.map((s) => (
          <Counter key={s.label} stat={s} active={active} accent={accent} />
        ))}
      </div>
    </section>
  );
}
