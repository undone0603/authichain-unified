'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Eye, CheckCircle, AlertTriangle, TrendingUp, BarChart3, Shield,
  Zap, RefreshCw, Lock, Globe,
} from 'lucide-react';

interface TransparencyMetrics {
  doraMetrics: any;
  deploymentGates: any;
  workerStatus: any;
}

export default function TransparencyDashboard() {
  const [data, setData] = useState<TransparencyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [doraRes, gatesRes, workersRes] = await Promise.all([
          fetch('/api/system/dora-metrics'),
          fetch('/api/system/deployment-gates'),
          fetch('/api/system/workers-status'),
        ]);

        const doraMetrics = await doraRes.json();
        const deploymentGates = await gatesRes.json();
        const workerStatus = await workersRes.json();

        setData({
          doraMetrics,
          deploymentGates,
          workerStatus,
        });

        setLastRefresh(new Date());
      } catch (err) {
        console.error('Failed to fetch transparency data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data)
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading transparency report...</p>
        </div>
      </div>
    );

  const { doraMetrics, deploymentGates, workerStatus } = data;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-green-500" />
            <span className="font-black text-xl">Public Transparency Report</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 hover:bg-green-500/10 transition-colors text-sm font-bold text-green-400"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Message */}
        <div className="rounded-2xl border border-green-500/50 bg-green-500/10 p-8 mb-8">
          <h1 className="text-3xl font-black mb-4 flex items-center gap-3">
            <Lock className="w-8 h-8 text-green-400" />
            We Measure Everything. You Can Verify Everything.
          </h1>
          <p className="text-lg text-zinc-300 mb-4">
            AuthiChain's autonomous system makes millions of decisions daily. Every deployment, every failure, every
            recovery is logged and benchmarked against industry standards.
          </p>
          <p className="text-sm text-zinc-500">
            All metrics below are computed in real-time from our production systems and updated every 60 seconds.
            Public API endpoints available at <code className="bg-zinc-900 px-2 py-1 rounded">/api/system/*</code>
          </p>
        </div>

        {/* DORA Metrics Showcase */}
        {doraMetrics && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 mb-8">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              DORA Metrics (2025 Industry Benchmarks)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                <p className="text-xs font-bold uppercase text-blue-600 mb-2">Deployment Frequency</p>
                <p className="text-2xl font-black text-blue-400 mb-1">
                  {doraMetrics.metrics?.deploymentFrequency || 'N/A'}
                </p>
                <p className="text-xs text-blue-600/80">per year (vs 128 industry avg)</p>
                <div className="mt-2 text-xs font-bold">
                  <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                    {doraMetrics.tiers?.deploymentFrequency === 'elite' ? '⚡ Elite' : doraMetrics.tiers?.deploymentFrequency}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
                <p className="text-xs font-bold uppercase text-purple-600 mb-2">Lead Time</p>
                <p className="text-2xl font-black text-purple-400 mb-1">
                  {doraMetrics.metrics?.leadTime || 'N/A'}h
                </p>
                <p className="text-xs text-purple-600/80">from commit to prod (vs 24h avg)</p>
                <div className="mt-2 text-xs font-bold">
                  <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                    {doraMetrics.tiers?.leadTime === 'elite' ? '⚡ Elite' : doraMetrics.tiers?.leadTime}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="text-xs font-bold uppercase text-orange-600 mb-2">MTTR</p>
                <p className="text-2xl font-black text-orange-400 mb-1">
                  {doraMetrics.metrics?.mttr || 'N/A'}m
                </p>
                <p className="text-xs text-orange-600/80">mean time to recovery (vs 96m avg)</p>
                <div className="mt-2 text-xs font-bold">
                  <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded">
                    {doraMetrics.tiers?.mttr === 'elite' ? '⚡ Elite' : doraMetrics.tiers?.mttr}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-xs font-bold uppercase text-red-600 mb-2">Failure Rate</p>
                <p className="text-2xl font-black text-red-400 mb-1">
                  {doraMetrics.metrics?.changeFailureRate || 'N/A'}%
                </p>
                <p className="text-xs text-red-600/80">change failures (vs 15.5% avg)</p>
                <div className="mt-2 text-xs font-bold">
                  <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded">
                    {doraMetrics.tiers?.changeFailureRate === 'elite' ? '⚡ Elite' : doraMetrics.tiers?.changeFailureRate}
                  </span>
                </div>
              </div>
            </div>

            {doraMetrics.interpretation && (
              <div className="rounded-lg bg-zinc-900/50 p-4 border border-zinc-700">
                <p className="text-sm text-zinc-300 mb-2">
                  <strong>What this means:</strong>
                </p>
                <ul className="space-y-1 text-xs text-zinc-400">
                  <li>
                    <strong>Deployment Frequency:</strong> {doraMetrics.interpretation?.deploymentFrequency}
                  </li>
                  <li>
                    <strong>Lead Time:</strong> {doraMetrics.interpretation?.leadTime}
                  </li>
                  <li>
                    <strong>MTTR:</strong> {doraMetrics.interpretation?.mttr}
                  </li>
                  <li>
                    <strong>Failure Rate:</strong> {doraMetrics.interpretation?.changeFailureRate}
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Deployment Gates (Real-time Safety) */}
        {deploymentGates && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 mb-8">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
              <Shield className="w-6 h-6 text-green-500" />
              Real-Time Deployment Safety Gates
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className={`rounded-lg border p-4 ${
                deploymentGates.safeForAutonomousDeployment
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-red-500/30 bg-red-500/10'
              }`}>
                <p className="text-xs font-bold uppercase mb-2">
                  {deploymentGates.safeForAutonomousDeployment ? 'System Status' : 'Alert'}
                </p>
                <p className="text-lg font-black mb-2">
                  {deploymentGates.safeForAutonomousDeployment ? '✅ Safe to Deploy' : '🚫 Deployment Blocked'}
                </p>
                <p className="text-xs text-zinc-400 mb-3">{deploymentGates.decision?.recommendation}</p>
                <p className="text-xs font-bold">
                  Confidence: {deploymentGates.decision?.confidence || 0}%
                </p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="text-xs font-bold uppercase text-zinc-600 mb-2">Threat Assessment</p>
                <p className="text-2xl font-black text-zinc-300 mb-1">
                  {deploymentGates.threatLevel || 0}%
                </p>
                <p className="text-xs text-zinc-500 mb-3">System-wide threat score</p>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                    style={{ width: `${Math.min(100, deploymentGates.threatLevel || 0)}%` }}
                  />
                </div>
              </div>
            </div>

            {deploymentGates.blockedBrands && deploymentGates.blockedBrands.length > 0 && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4">
                <p className="text-xs font-bold text-yellow-600 mb-2">Currently Blocked:</p>
                <p className="text-sm text-yellow-300">{deploymentGates.blockedBrands.join(', ')}</p>
              </div>
            )}
          </div>
        )}

        {/* Worker Status */}
        {workerStatus && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 mb-8">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-500" />
              32 Cloudflare Workers - Real-Time Status
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                <p className="text-xs font-bold uppercase text-green-600">Healthy</p>
                <p className="text-3xl font-black text-green-400">
                  {workerStatus.summary?.healthStatus?.healthy || 0}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                <p className="text-xs font-bold uppercase text-yellow-600">Degraded</p>
                <p className="text-3xl font-black text-yellow-400">
                  {workerStatus.summary?.healthStatus?.degraded || 0}
                </p>
              </div>
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-xs font-bold uppercase text-red-600">Unhealthy</p>
                <p className="text-3xl font-black text-red-400">
                  {workerStatus.summary?.healthStatus?.unhealthy || 0}
                </p>
              </div>
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                <p className="text-xs font-bold uppercase text-blue-600">Avg Uptime</p>
                <p className="text-3xl font-black text-blue-400">
                  {((workerStatus.summary?.metrics?.avgUptime || 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-500">
              All 32 workers monitored in real-time via JOB 33. Full details at{' '}
              <Link href="/system/workers-dashboard" className="text-blue-400 hover:underline">
                /system/workers-dashboard
              </Link>
            </p>
          </div>
        )}

        {/* Trust Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-500" />
              Security Auditing
            </h3>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>✅ Secret scanning on every commit</li>
              <li>✅ Dependency vulnerability tracking</li>
              <li>✅ Cross-vertical threat intelligence</li>
              <li>✅ Autonomous incident response</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Public APIs
            </h3>
            <ul className="space-y-2 text-sm text-zinc-400 font-mono text-xs">
              <li>
                <code className="bg-zinc-900 px-1 rounded">/api/system/health</code>
              </li>
              <li>
                <code className="bg-zinc-900 px-1 rounded">/api/system/dora-metrics</code>
              </li>
              <li>
                <code className="bg-zinc-900 px-1 rounded">/api/system/deployment-gates</code>
              </li>
              <li>
                <code className="bg-zinc-900 px-1 rounded">/api/system/workers-status</code>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              Benchmarking
            </h3>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>Measured against DORA 2025</li>
              <li>GitHub Octoverse standards</li>
              <li>Atlassian DevOps benchmarks</li>
              <li>Updated hourly from production</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-zinc-600 border-t border-zinc-800 pt-8">
          <p>Updated: {lastRefresh.toLocaleTimeString()}</p>
          <p className="mt-2">
            All data is real-time and verifiable. Questions?{' '}
            <a href="mailto:hello@authichain.com" className="text-blue-400 hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
