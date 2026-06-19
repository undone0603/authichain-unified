'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, Zap,
  BarChart3, AlertCircle, RefreshCw, Server,
} from 'lucide-react';

interface WorkerStatus {
  name: string;
  domain: string;
  status: string;
  health: string;
  responseTime: number;
  errorRate: number;
  uptime: number;
  lastDeployment: string | null;
}

interface WorkersSummary {
  totalWorkers: number;
  deploymentStatus: {
    deployed: number;
    pending: number;
    error: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  healthStatus: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  metrics: {
    avgResponseTime: number;
    avgErrorRate: number;
    avgUptime: number;
  };
}

export default function WorkersDashboard() {
  const [data, setData] = useState<{
    summary: WorkersSummary;
    workers: WorkerStatus[];
    byBrand: Record<string, WorkerStatus[]>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/system/workers-status');
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      } catch (err) {
        console.error('Failed to fetch worker status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/workers-status');
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'text-green-400';
      case 'degraded':
        return 'text-yellow-400';
      case 'unhealthy':
        return 'text-red-500';
      default:
        return 'text-zinc-500';
    }
  };

  const getHealthBg = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'bg-green-500/10 border-green-500/30';
      case 'degraded':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'unhealthy':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-zinc-500/10 border-zinc-500/30';
    }
  };

  if (loading && !data)
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading worker status...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-blue-500" />
            <span className="font-black text-xl">Worker Status</span>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 transition-colors text-sm font-bold text-blue-400 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </nav>

      {data && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-zinc-600">Total Workers</span>
                <Server className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-black">{data.summary.totalWorkers}</div>
              <p className="text-xs text-zinc-600 mt-2">Across all brands</p>
            </div>

            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-green-600">Healthy</span>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-3xl font-black text-green-400">
                {data.summary.healthStatus.healthy}
              </div>
              <p className="text-xs text-green-600/80 mt-2">
                {Math.round((data.summary.healthStatus.healthy / data.summary.totalWorkers) * 100)}%
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-yellow-600">Degraded</span>
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-3xl font-black text-yellow-400">
                {data.summary.healthStatus.degraded}
              </div>
              <p className="text-xs text-yellow-600/80 mt-2">Monitor closely</p>
            </div>

            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-red-600">Unhealthy</span>
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-3xl font-black text-red-400">
                {data.summary.healthStatus.unhealthy}
              </div>
              <p className="text-xs text-red-600/80 mt-2">Action required</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold uppercase text-zinc-600">Avg Response Time</span>
              </div>
              <p className="text-2xl font-black">{data.summary.metrics.avgResponseTime}ms</p>
              <p className="text-xs text-zinc-500 mt-2">Target: &lt;500ms</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-xs font-bold uppercase text-zinc-600">Avg Uptime</span>
              </div>
              <p className="text-2xl font-black text-green-400">
                {(data.summary.metrics.avgUptime * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-zinc-500 mt-2">All-time average</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold uppercase text-zinc-600">Avg Error Rate</span>
              </div>
              <p className="text-2xl font-black">
                {(data.summary.metrics.avgErrorRate * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-zinc-500 mt-2">Target: &lt;1%</p>
            </div>
          </div>

          {/* Brand Filter */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedBrand(null)}
              className={`px-4 py-2 rounded-lg text-sm font-bold uppercase whitespace-nowrap transition-all ${
                selectedBrand === null
                  ? 'bg-blue-500 text-white'
                  : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              All Brands
            </button>
            {Object.keys(data.byBrand).map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-4 py-2 rounded-lg text-sm font-bold uppercase whitespace-nowrap transition-all ${
                  selectedBrand === brand
                    ? 'bg-blue-500 text-white'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>

          {/* Workers List */}
          <div className="space-y-3">
            {(selectedBrand ? data.byBrand[selectedBrand] : data.workers).map((worker) => (
              <div
                key={worker.name}
                className={`rounded-2xl border p-4 transition-all ${getHealthBg(worker.health)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{worker.name}</h3>
                    <p className="text-xs text-zinc-500">{worker.domain}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase ${getHealthColor(worker.health)}`}>
                      {worker.health}
                    </span>
                    {worker.health === 'healthy' && (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    )}
                    {worker.health === 'degraded' && (
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    )}
                    {worker.health === 'unhealthy' && (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-600">Status</span>
                    <p className="font-bold mt-1">{worker.status}</p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Response Time</span>
                    <p className="font-bold mt-1">{worker.responseTime}ms</p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Error Rate</span>
                    <p className="font-bold mt-1">{(worker.errorRate * 100).toFixed(2)}%</p>
                  </div>
                </div>

                {worker.lastDeployment && (
                  <div className="mt-3 pt-3 border-t border-zinc-700/50">
                    <p className="text-xs text-zinc-600">
                      Last deployment:{' '}
                      {new Date(worker.lastDeployment).toLocaleDateString()} at{' '}
                      {new Date(worker.lastDeployment).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Last Updated */}
          <div className="mt-8 text-center text-xs text-zinc-600">
            Last updated: {lastRefresh.toLocaleTimeString()} • Auto-refresh every 30 seconds
          </div>
        </div>
      )}
    </div>
  );
}
