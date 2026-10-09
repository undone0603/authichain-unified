import { useState, useEffect } from "react";

export default function MissionMilestoneTracker({
  genesisDate = new Date("2026-06-27T00:00:00Z"),
  isAchieved = false,
}) {
  const [elapsed, setElapsed] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (isAchieved) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = now - genesisDate.getTime();

      setElapsed({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        ),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [genesisDate, isAchieved]);

  return (
    <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 font-mono text-slate-200 shadow-2xl">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-1">
            Primary Objective
          </h2>
          <p className="text-lg font-semibold text-emerald-400">
            1 human life saved directly from the effects of this software.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-widest text-slate-500 block mb-1">
            Status
          </span>
          {isAchieved ? (
            <span className="inline-flex items-center text-emerald-400 font-bold">
              CONFIRMED
            </span>
          ) : (
            <span className="inline-flex items-center text-amber-400">
              AWAITING ATTESTATION
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-3xl font-light text-slate-100">
            {String(elapsed.days).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
            Days
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-3xl font-light text-slate-100">
            {String(elapsed.hours).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
            Hours
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-3xl font-light text-slate-100">
            {String(elapsed.minutes).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
            Minutes
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-3xl font-light text-emerald-400/80">
            {String(elapsed.seconds).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
            Seconds
          </div>
        </div>
      </div>
    </div>
  );
}
