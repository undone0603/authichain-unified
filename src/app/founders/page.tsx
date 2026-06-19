'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Target,
  Zap,
  Activity,
  ArrowRight,
  Loader2,
  Users,
  DollarSign,
  Flame,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  MapPin,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';

interface DashboardData {
  timestamp: string;
  summary: {
    total_leads: number;
    total_converted: number;
    conversion_rate: string;
    estimated_revenue: string;
    avg_lead_score: string;
  };
  pipeline: {
    new: number;
    contacted: number;
    qualified: number;
    demoed: number;
    contracted: number;
    signed: number;
    converted: number;
  };
  domain_metrics: Array<{
    domain: string;
    total: number;
    converted: number;
    conversion_rate: string;
    avg_score: string;
  }>;
  recent_events: Array<{
    workflow: string;
    status: string;
    timestamp: string;
  }>;
  high_intent_leads: Array<{
    email: string;
    score: number;
    status: string;
    domain: string;
  }>;
}

export default function FoundersDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/founders/dashboard');
        const dashboard = await res.json();
        setData(dashboard);
      } catch (err) {
        console.error('Failed to fetch founders dashboard', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const getDomainColor = (domain: string) => {
    switch (domain?.toLowerCase()) {
      case 'govchain':
        return { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' };
      case 'strainchain':
        return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' };
      case 'authichain':
        return { bg: 'bg-gold/10', border: 'border-gold/30', text: 'text-gold' };
      case 'qron':
        return { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' };
      default:
        return { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-400' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted':
        return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      case 'signed':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      case 'contracted':
        return <Clock className="w-3 h-3 text-blue-400" />;
      case 'demoed':
        return <Zap className="w-3 h-3 text-yellow-500" />;
      case 'qualified':
        return <Target className="w-3 h-3 text-orange-400" />;
      case 'contacted':
        return <Activity className="w-3 h-3 text-cyan-400" />;
      default:
        return <AlertCircle className="w-3 h-3 text-zinc-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-gold mx-auto mb-4" />
          <p className="text-zinc-400 font-medium">Loading real-time metrics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <p className="text-center text-red-500">Failed to load dashboard</p>
      </div>
    );
  }

  const pipelineStages = [
    { name: 'New', value: data.pipeline.new, color: 'bg-zinc-600' },
    { name: 'Contacted', value: data.pipeline.contacted, color: 'bg-cyan-600' },
    { name: 'Qualified', value: data.pipeline.qualified, color: 'bg-orange-600' },
    { name: 'Demoed', value: data.pipeline.demoed, color: 'bg-yellow-600' },
    { name: 'Contracted', value: data.pipeline.contracted, color: 'bg-blue-600' },
    { name: 'Signed', value: data.pipeline.signed, color: 'bg-emerald-600' },
    { name: 'Converted', value: data.pipeline.converted, color: 'bg-green-600' },
  ];

  const maxStage = Math.max(...pipelineStages.map(s => s.value));

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gold/10 border border-gold/30">
              <Lightbulb className="w-5 h-5 text-gold" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">
              Founders DreamDash
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none mb-4">
            Real-Time <span className="gold-text">Deal Command</span>
          </h1>
          <p className="text-zinc-400 text-lg font-medium max-w-2xl">
            Autonomous lead engagement. Pragmatic deal closing. Real-time revenue impact across your four-domain empire.
          </p>
        </header>

        {/* Executive KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Leads Captured', value: data.summary.total_leads, icon: Users, color: 'text-blue-400' },
            { label: 'Closed Deals', value: data.summary.total_converted, icon: CheckCircle2, color: 'text-green-400' },
            { label: 'Conversion Rate', value: data.summary.conversion_rate, icon: TrendingUp, color: 'text-gold' },
            { label: 'Est. Revenue', value: data.summary.estimated_revenue, icon: DollarSign, color: 'text-emerald-400' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="group p-6 rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 border border-zinc-800 hover:border-gold/30 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-zinc-900 border border-zinc-800 ${kpi.color}`}>
                  <kpi.icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-gold transition-colors" />
              </div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">
                {kpi.label}
              </p>
              <p className="text-3xl font-black text-white">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Pipeline Waterfall */}
          <div className="lg:col-span-2 p-8 rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 border border-zinc-800">
            <div className="flex items-center gap-3 mb-8">
              <BarChart3 className="w-5 h-5 text-gold" />
              <h2 className="text-sm font-black uppercase tracking-widest">Deal Pipeline (7-Stage Funnel)</h2>
            </div>

            <div className="space-y-6">
              {pipelineStages.map((stage) => (
                <div key={stage.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">{stage.name}</span>
                    <span className="text-sm font-black text-white">{stage.value}</span>
                  </div>
                  <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div
                      className={`h-full ${stage.color} transition-all`}
                      style={{ width: `${maxStage > 0 ? (stage.value / maxStage) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 rounded-lg bg-gold/5 border border-gold/20">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Pipeline Health
              </p>
              <p className="text-sm text-gold font-bold">
                {data.pipeline.contracted + data.pipeline.signed > 0
                  ? `🔥 ${data.pipeline.contracted + data.pipeline.signed} deals in final stages — high close probability`
                  : 'Build qualified pipeline'}
              </p>
            </div>
          </div>

          {/* Domain Leaders */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 border border-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <MapPin className="w-5 h-5 text-gold" />
              <h2 className="text-sm font-black uppercase tracking-widest">Domain Performance</h2>
            </div>

            <div className="space-y-4">
              {data.domain_metrics.map((d) => {
                const colors = getDomainColor(d.domain);
                return (
                  <div
                    key={d.domain}
                    className={`p-4 rounded-xl border ${colors.border} ${colors.bg} transition-all hover:border-gold/50`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className={`text-xs font-black uppercase tracking-tighter ${colors.text}`}>
                          {d.domain.charAt(0).toUpperCase() + d.domain.slice(1)}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-bold mt-1">
                          {d.total} leads
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black ${colors.text}`}>
                          {d.conversion_rate}%
                        </p>
                        <p className="text-[8px] text-zinc-600 uppercase font-bold">
                          {d.converted} converted
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${
                          d.domain === 'govchain'
                            ? 'from-purple-600 to-purple-400'
                            : d.domain === 'strainchain'
                              ? 'from-blue-600 to-blue-400'
                              : d.domain === 'authichain'
                                ? 'from-yellow-600 to-yellow-400'
                                : 'from-green-600 to-green-400'
                        }`}
                        style={{ width: `${Math.min(parseFloat(d.conversion_rate), 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* High-Intent Leads Ready to Close */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 border border-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <Flame className="w-5 h-5 text-red-500" />
              <h2 className="text-sm font-black uppercase tracking-widest">Hot Leads (Ready to Close)</h2>
            </div>

            {data.high_intent_leads.length > 0 ? (
              <div className="space-y-3">
                {data.high_intent_leads.map((lead, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-gold/20 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(lead.status)}
                          <p className="text-xs font-bold text-white truncate">{lead.email}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[8px] font-black bg-gold/10 text-gold px-2 py-1 rounded border border-gold/20">
                            Score: {lead.score}
                          </span>
                          <span
                            className={`text-[8px] font-black px-2 py-1 rounded border ${getDomainColor(lead.domain).text} ${getDomainColor(lead.domain).bg} ${getDomainColor(lead.domain).border}`}
                          >
                            {lead.domain}
                          </span>
                        </div>
                      </div>
                      <button className="p-2 rounded-lg bg-zinc-800 hover:bg-gold/10 text-zinc-500 hover:text-gold transition-all group-hover:border group-hover:border-gold/30 opacity-0 group-hover:opacity-100">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-zinc-600 text-sm py-6">Build your qualified pipeline</p>
            )}
          </div>

          {/* Autonomous Heartbeat */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 border border-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="w-5 h-5 text-gold" />
              <h2 className="text-sm font-black uppercase tracking-widest">Autonomous Heartbeat</h2>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.recent_events.length > 0 ? (
                data.recent_events.map((event, i) => (
                  <div key={i} className="flex justify-between items-start gap-4 pb-3 border-b border-zinc-800 last:border-0">
                    <div>
                      <p className="text-xs text-zinc-300 font-bold uppercase tracking-tighter">
                        {event.workflow.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[8px] text-zinc-600 mt-1">
                        Status: <span className="text-zinc-400 font-bold">{event.status}</span>
                      </p>
                    </div>
                    <span className="text-[8px] text-zinc-600 font-bold whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-zinc-700 font-black uppercase text-center py-6">
                  Awaiting protocol heartbeat...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/20">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
                Ready to scale?
              </h3>
              <p className="text-zinc-400 text-sm max-w-xl">
                Connect to your CRM, automate lead scoring, and let the system engage prospects 24/7 across all
                domains.
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/admin/leads"
                className="px-6 py-3 rounded-lg bg-gold text-black font-black uppercase text-xs tracking-widest hover:bg-gold/80 transition-colors"
              >
                Review Leads
              </Link>
              <Link
                href="/admin"
                className="px-6 py-3 rounded-lg bg-zinc-900 text-white border border-zinc-800 font-black uppercase text-xs tracking-widest hover:border-gold/30 transition-colors"
              >
                Full Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
