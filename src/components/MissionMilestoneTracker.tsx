'use client';
import React, { useEffect, useState } from 'react';

export function MissionMilestoneTracker() {
  const [metrics, setMetrics] = useState({ secured: 0, intercepted: 0 });

  useEffect(() => {
    // Fetch live metrics from the database via your API/Worker
    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => setMetrics({ secured: data.secured || 0, intercepted: data.intercepted || 0 }))
      .catch(console.error);
  }, []);

  return (
    <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6">Mission Control: Supply Chain Integrity</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wider">Products Secured</p>
          <p className="text-5xl font-black text-emerald-500 mt-2">{metrics.secured.toLocaleString()}</p>
        </div>
        <div className="p-6 bg-rose-900/20 border border-rose-500/30 rounded-lg">
          <p className="text-rose-400 text-sm font-semibold uppercase tracking-wider">Counterfeits Intercepted</p>
          <p className="text-5xl font-black text-rose-500 mt-2">{metrics.intercepted.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
