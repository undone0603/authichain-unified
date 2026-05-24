"use client";

import { useEffect, useState } from "react";

function getDaysLeft(target: Date) {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function DppCountdown() {
  const [days, setDays] = useState(() =>
    getDaysLeft(new Date("2026-01-01T00:00:00"))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setDays(getDaysLeft(new Date("2026-01-01T00:00:00")));
    }, 1000 * 60 * 60);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-4 inline-flex items-baseline gap-3 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
      <span className="text-[11px] uppercase tracking-wide">
        EU Digital Product Passport
      </span>
      <span className="text-sm font-semibold">
        Launches in {days} day{days === 1 ? "" : "s"}
      </span>
    </div>
  );
}
