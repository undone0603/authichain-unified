"use client";

import { useEffect, useState } from "react";

const AGENTS = [
  "Vision",
  "Compliance",
  "Fraud",
  "Provenance",
  "Risk",
] as const;

export function ConsensusRing() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i < AGENTS.length) {
        setActiveIndex(i);
        i++;
      } else {
        setDone(true);
        clearInterval(id);
      }
    }, 700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-6 flex flex-col items-center gap-4 md:flex-row md:gap-8">
      <div className="relative h-40 w-40">
        {AGENTS.map((agent, idx) => {
          const angle = (idx / AGENTS.length) * Math.PI * 2;
          const r = 70;
          const x = 50 + r * Math.cos(angle);
          const y = 50 + r * Math.sin(angle);
          const active = activeIndex !== null && idx <= activeIndex;
          return (
            <div
              key={agent}
              className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[9px] ${
                active
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                  : "border-white/20 bg-white/5 text-white/60"
              }`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {agent[0]}
            </div>
          );
        })}
        <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-[10px] text-white/70">
          {done ? "Consensus" : "Evaluating"}
        </div>
      </div>
      <ul className="space-y-1 text-xs text-white/70">
        {AGENTS.map((agent, idx) => {
          const active = activeIndex !== null && idx <= activeIndex;
          return (
            <li key={agent} className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  active ? "bg-emerald-400" : "bg-white/30"
                }`}
              />
              <span className={active ? "text-white" : ""}>
                {agent} model signal
              </span>
            </li>
          );
        })}
        {done && (
          <li className="pt-1 text-[11px] text-emerald-300">
            Consensus achieved. Action cleared by all five agents.
          </li>
        )}
      </ul>
    </div>
  );
}
