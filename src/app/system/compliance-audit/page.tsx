'use client';

import { useState, useEffect } from 'react';
import {
  Shield, CheckCircle, AlertTriangle, BarChart3,
  Lock, RefreshCw, AlertCircle,
} from 'lucide-react';

interface ComplianceData {
  summary: any;
  analysis: any;
  policies: Record<string, string>;
  evidence: any;
  certification: any;
}

export default function ComplianceAuditDashboard() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async (daysParam: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/system/compliance-audit?days=${daysParam}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch compliance audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(days);
  }, [days]);

  if (loading || !data)
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading compliance audit...</p>
        </div>
      </div>
    );

  const { summary, analysis, policies, evidence, certification } = data;
  const complianceStatus = summary.complianceScore >= 95 ? 'compliant' : summary.complianceScore >= 85 ? 'warning' : 'critical';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-blue-500" />
            <span className="font-black text-xl">AI Compliance Audit</span>
          </div>
          <button
            onClick={() => fetchData(days)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 transition-colors text-sm font-bold text-blue-400"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Time Period Selector */}
        <div className="mb-8 flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                days === d
                  ? 'bg-blue-500 text-white'
                  : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              Last {d} days
            </button>
          ))}
        </div>

        {/* Certification Status */}
        <div
          className={`rounded-2xl border p-8 mb-8 ${
            complianceStatus === 'compliant'
              ? 'border-green-500/50 bg-green-500/10'
              : complianceStatus === 'warning'
                ? 'border-yellow-500/50 bg-yellow-500/10'
                : 'border-red-500/50 bg-red-500/10'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {complianceStatus === 'compliant' ? (
                <CheckCircle className="w-10 h-10 text-green-400" />
              ) : complianceStatus === 'warning' ? (
                <AlertTriangle className="w-10 h-10 text-yellow-400" />
              ) : (
                <AlertCircle className="w-10 h-10 text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black mb-2">{certification.statement}</h2>
              <p className="text-sm text-zinc-300 mb-4">
                Based on analysis of {summary.totalDecisions} autonomous decisions over the last {days} days.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-bold">Confidence: {certification.confidence}</span>
                <span className="text-xs text-zinc-500">Last Audit: {new Date(certification.lastAudit).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
            <p className="text-xs font-bold uppercase text-zinc-600 mb-2">Compliance Score</p>
            <p className="text-3xl font-black text-blue-400 mb-1">{summary.complianceScore.toFixed(1)}%</p>
            <p className="text-xs text-zinc-500">{summary.totalDecisions} decisions analyzed</p>
          </div>

          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
            <p className="text-xs font-bold uppercase text-green-600 mb-2">Allowed</p>
            <p className="text-3xl font-black text-green-400 mb-1">{summary.allowed}</p>
            <p className="text-xs text-green-600/80">
              {((summary.allowed / summary.totalDecisions) * 100).toFixed(1)}% of decisions
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="text-xs font-bold uppercase text-red-600 mb-2">Blocked</p>
            <p className="text-3xl font-black text-red-400 mb-1">{summary.blocked}</p>
            <p className="text-xs text-red-600/80">Prevented non-compliant execution</p>
          </div>

          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
            <p className="text-xs font-bold uppercase text-purple-600 mb-2">Avg Confidence</p>
            <p className="text-3xl font-black text-purple-400 mb-1">{summary.avgConfidence.toFixed(0)}%</p>
            <p className="text-xs text-purple-600/80">Decision accuracy</p>
          </div>
        </div>

        {/* Policy Violations */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 mb-8">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            Policy Violations Analysis
          </h3>

          {Object.keys(analysis.violationsByPolicy).length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              No policy violations detected — all decisions compliant! ✅
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(analysis.violationsByPolicy).map(([policy, count]: [string, any]) => (
                <div
                  key={policy}
                  className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/50"
                >
                  <div>
                    <p className="font-bold text-sm">{policy}</p>
                    <p className="text-xs text-zinc-500 mt-1">{policies[policy]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-red-400">{count}</p>
                    <p className="text-xs text-zinc-500">
                      {((count / summary.totalDecisions) * 100).toFixed(1)}% of decisions
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence: Recent Decisions */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 mb-8">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-500" />
            Recent Autonomous Decisions (Audit Trail)
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {evidence.recentDecisions.slice(0, 20).map((decision: any, idx: number) => (
              <div
                key={idx}
                className={`rounded-lg border p-4 ${
                  decision.decision === 'allowed'
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-bold text-sm">{decision.jobName}</p>
                    <p className="text-xs text-zinc-500 mt-1">{new Date(decision.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        decision.decision === 'allowed'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {decision.decision.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 mb-2">{decision.reasoning}</p>

                {decision.blockedReason && (
                  <p className="text-xs text-red-300 mb-2">🚫 {decision.blockedReason}</p>
                )}

                <div className="flex items-center gap-4 text-xs">
                  <span>Threat: {decision.threat}%</span>
                  <span>Confidence: {decision.confidence.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Policy Checklist */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-500" />
            Compliance Policies
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(policies).map(([policyKey, description]) => {
              const policyEvidence = evidence.policyCompletion[policyKey];
              const compliance = policyEvidence
                ? (policyEvidence.passed / policyEvidence.total) * 100
                : 0;

              return (
                <div
                  key={policyKey}
                  className={`rounded-lg border p-4 ${
                    compliance >= 95
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-yellow-500/30 bg-yellow-500/5'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    {compliance >= 95 ? (
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-sm">{policyKey}</p>
                      <p className="text-xs text-zinc-500 mt-1">{description}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">Compliance</span>
                      <span className="text-xs text-zinc-500">
                        {policyEvidence?.passed}/{policyEvidence?.total}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${compliance >= 95 ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(100, compliance)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-zinc-600">
          <p>Audit Trail: All decisions logged and verifiable</p>
          <p>Last Updated: {lastRefresh.toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
}
