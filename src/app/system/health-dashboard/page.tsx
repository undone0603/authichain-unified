'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, CheckCircle, TrendingUp, BarChart3, Zap,
  RefreshCw, AlertCircle, Clock, Server,
} from 'lucide-react';

interface JobDetail {
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  isRunning: boolean;
}

interface HealthData {
  system: {
    isActive: boolean;
    activeJobs: number;
    totalJobs: number;
    timestamp: string;
    healthScore: number;
    recentJobsLast24h: number;
    failuresLast24h: number;
  };
  jobs: {
    registered: number;
    enabled: number;
    active: number;
    details: JobDetail[];
  };
  recentHistory: any[];
  lastUpdated: string;
}

export default function HealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/system/health');
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      } catch (err) {
        console.error('Failed to fetch health data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/health');
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data)
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading system health...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-green-500" />
            <span className="font-black text-xl">System Health</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/system/workers-dashboard"
              className="text-xs font-bold uppercase px-4 py-2 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 transition-colors text-blue-400"
            >
              Workers Status
            </Link>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 transition-colors text-sm font-bold text-blue-400 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </nav>

      {data && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* System Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className={`rounded-2xl border p-6 ${
              data.system.healthScore >= 95
                ? 'border-green-500/30 bg-green-500/10'
                : data.system.healthScore >= 80
                  ? 'border-yellow-500/30 bg-yellow-500/10'
                  : 'border-red-500/30 bg-red-500/10'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-zinc-600">System Health</span>
                {data.system.healthScore >= 95 ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : data.system.healthScore >= 80 ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className="text-3xl font-black">{data.system.healthScore}%</div>
              <p className="text-xs text-zinc-600 mt-2">Last 24 hours</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-zinc-600">Active Jobs</span>
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-black">{data.system.activeJobs}</div>
              <p className="text-xs text-zinc-600 mt-2">Of {data.system.totalJobs} registered</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-zinc-600">Jobs Last 24h</span>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-black">{data.system.recentJobsLast24h}</div>
              <p className="text-xs text-zinc-600 mt-2">{data.system.failuresLast24h} failed</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-zinc-600">Status</span>
                <Server className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-sm font-black text-green-400 mt-2">
                {data.system.isActive ? 'OPERATIONAL' : 'OFFLINE'}
              </div>
              <p className="text-xs text-zinc-600 mt-1">All systems nominal</p>
            </div>
          </div>

          {/* Job Registration Status */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 mb-8">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              Job Registration
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-bold uppercase text-zinc-600 mb-2">Registered</p>
                <p className="text-3xl font-black text-blue-400">{data.jobs.registered}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-600 mb-2">Enabled</p>
                <p className="text-3xl font-black text-green-400">{data.jobs.enabled}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-600 mb-2">Currently Active</p>
                <p className="text-3xl font-black text-yellow-400">{data.jobs.active}</p>
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 mb-8">
            <h2 className="text-2xl font-black mb-4">Scheduled Jobs</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.jobs.details.map(job => (
                <div
                  key={job.name}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 flex items-start justify-between"
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-sm mb-1">{job.name}</h3>
                    <p className="text-xs text-zinc-500">{job.description}</p>
                    <p className="text-xs text-zinc-600 mt-2">Schedule: {job.schedule}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {job.isRunning && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-xs font-bold text-blue-400">Running</span>
                      </span>
                    )}
                    {job.enabled ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Job History */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-yellow-500" />
              Recent Job Runs
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.recentHistory.map((run, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 flex items-center justify-between text-sm ${
                    run.status === 'completed'
                      ? 'bg-green-500/10 border border-green-500/30'
                      : run.status === 'failed'
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'bg-yellow-500/10 border border-yellow-500/30'
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-bold">{run.jobName}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(run.startedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xs">{run.status.toUpperCase()}</p>
                    {run.duration && (
                      <p className="text-xs text-zinc-500">{run.duration}ms</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Last Updated */}
          <div className="mt-8 text-center text-xs text-zinc-600">
            Last updated: {lastRefresh.toLocaleTimeString()} • Auto-refresh every 60 seconds
          </div>
        </div>
      )}
    </div>
  );
}
