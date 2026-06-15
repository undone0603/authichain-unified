'use client';

import React from 'react';

type SystemStatus = {
  isActive: boolean;
  activeJobs: number;
  totalJobs: number;
};

const mockStatus: SystemStatus = {
  isActive: false,
  activeJobs: 0,
  totalJobs: 0,
};

export default function SystemControlPanel() {
  const status = mockStatus;
  const isLoading = false;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Control Panel</h2>
          <p className="text-sm text-slate-400">Autonomous pipeline status and job activity.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
          {status.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
          <div className="text-sm text-slate-400">Active jobs</div>
          <div className="mt-1 text-2xl font-semibold">{isLoading ? '…' : status.activeJobs}</div>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
          <div className="text-sm text-slate-400">Total jobs</div>
          <div className="mt-1 text-2xl font-semibold">{isLoading ? '…' : status.totalJobs}</div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
          Start
        </button>
        <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
          Stop
        </button>
        <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">
          Refresh
        </button>
      </div>
    </div>
  );
}
