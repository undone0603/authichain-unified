'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Target, 
  Activity, 
  BarChart3, 
  Users, 
  Package, 
  ShieldCheck, 
  Zap, 
  Flame,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  Mail,
  Sparkles,
  Trophy
} from 'lucide-react';

interface AdminStats {
  creative: { total_qrons: number; total_scans: number };
  industrial: { total_products: number; total_certifications: number };
  governance: { total_staked_qron: number; total_burned_qron: number; active_brands: number };
  pipeline: { total_leads: number };
  recent_logs: Array<{ workflow_name: string; status: string; created_at: string; payload?: any }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch admin stats', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Executive Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-[0.3em] mb-4">
              <Shield className="w-3 h-3" />
              Ecosystem Command Center
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-none">
              Protocol <span className="gold-text">Intelligence</span>
            </h1>
            <p className="text-zinc-500 text-lg font-medium mt-4 uppercase tracking-widest">
              Global Observability v1.4.2
            </p>
          </div>
          <div className="flex gap-4">
            <div className="protocol-card px-6 py-3 bg-zinc-950 border-zinc-900 flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Systems Operational</span>
            </div>
          </div>
        </header>

        {/* Global Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Global Scans', val: stats?.creative?.total_scans?.toLocaleString(), icon: Activity, color: 'text-gold' },
            { label: 'Industrial Assets', val: stats?.industrial?.total_products, icon: Package, color: 'text-blue-400' },
            { label: '$QRON Staked', val: stats?.governance?.total_staked_qron?.toLocaleString(), icon: Zap, color: 'text-purple-400' },
            { label: 'Protocol Burn', val: stats?.governance?.total_burned_qron?.toFixed(2), icon: Flame, color: 'text-red-500' },
          ].map((m) => (
            <div key={m.label} className="protocol-card p-8 bg-zinc-950/50 border-zinc-900 group hover:border-gold/30 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-zinc-900 border border-zinc-800 ${m.color}`}>
                  <m.icon className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-800 group-hover:text-gold transition-colors" />
              </div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">{m.label}</p>
              <p className="text-3xl font-black text-white">{m.val}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Brand Performance */}
          <div className="lg:col-span-2 space-y-8">
            <section className="protocol-card p-8 bg-zinc-950/50 border-zinc-900">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-gold" />
                        <h2 className="text-sm font-black uppercase tracking-widest">Ecosystem Distribution</h2>
                    </div>
                    <div className="flex gap-2">
                        <span className="w-3 h-3 rounded-full bg-gold" />
                        <span className="w-3 h-3 rounded-full bg-zinc-800" />
                    </div>
                </div>
                
                <div className="space-y-12">
                    {/* Creative Studio */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                                    QRON.space <span className="px-2 py-0.5 rounded bg-gold/10 text-gold text-[8px] font-black uppercase">Story Mode Active</span>
                                </h3>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight">Creative AI Utility & Digital Reveal</p>
                            </div>
                            <p className="text-sm font-black text-gold">{stats?.creative?.total_qrons} Creations</p>
                        </div>
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="bg-gold h-full w-[85%]" />
                        </div>
                    </div>

                    {/* Industrial */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                                    StrainChain.io <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase animate-pulse">Watchdog Enabled</span>
                                </h3>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight">Industrial Provenance & Geo-fencing</p>
                            </div>
                            <p className="text-sm font-black text-blue-400">{stats?.industrial?.total_certifications} Certifications</p>
                        </div>
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="bg-blue-400 h-full w-[45%]" />
                        </div>
                    </div>

                    {/* Governance */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                                    GovChain.us <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase">Yield: 12.4%</span>
                                </h3>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight">Ecosystem Governance & DAO Rewards</p>
                            </div>
                            <p className="text-sm font-black text-purple-400">{stats?.governance?.active_brands} Registered Brands</p>
                        </div>
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="bg-purple-400 h-full w-[65%]" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Navigation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link href="/admin/products" className="protocol-card p-6 flex items-center justify-between group hover:border-gold/40 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-zinc-900 text-zinc-500 group-hover:text-gold transition-colors">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white uppercase text-sm">Industrial Catalog</h4>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Manage Products</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                </Link>
                <Link href="/admin/certifications" className="protocol-card p-6 flex items-center justify-between group hover:border-gold/40 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-zinc-900 text-zinc-500 group-hover:text-gold transition-colors">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white uppercase text-sm">Registry Manager</h4>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Issue Certificates</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                </Link>
                <Link href="/admin/analytics" className="protocol-card p-6 flex items-center justify-between group hover:border-gold/40 transition-all md:col-span-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-zinc-900 text-zinc-500 group-hover:text-gold transition-colors">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white uppercase text-sm">Executive ROI Dashboard</h4>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Autonomous Pipeline & Token Economics</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                </Link>
                <Link href="/admin/ops" className="protocol-card p-6 flex items-center justify-between group hover:border-gold/40 transition-all md:col-span-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-zinc-900 text-zinc-500 group-hover:text-gold transition-colors">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white uppercase text-sm">Operations Console</h4>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Workflow health · last 24h</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                </Link>
                <Link href="/admin/email-campaigns" className="protocol-card p-6 flex items-center justify-between group hover:border-gold/40 transition-all md:col-span-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-zinc-900 text-zinc-500 group-hover:text-gold transition-colors">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white uppercase text-sm">Autonomous Outreach</h4>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">AgentZ Mission Control · Review Drafts</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                </Link>
                <Link href="/admin/onboarding" className="protocol-card p-6 flex items-center justify-between group hover:border-gold/40 transition-all md:col-span-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-zinc-900 text-zinc-500 group-hover:text-gold transition-colors">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white uppercase text-sm">Sovereign Activator</h4>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Pilot Activation · L1 Anchoring</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                </Link>
                <Link href="/admin/marketing" className="protocol-card p-6 flex items-center justify-between group hover:border-gold/40 transition-all md:col-span-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-zinc-900 text-zinc-500 group-hover:text-gold transition-colors">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white uppercase text-sm">Marketing Factory</h4>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">StoryMode Assets · HeyGen Avatars</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800" />
                </Link>
            </div>
          </div>

          {/* Lead Pipeline & Alerts */}
          <div className="space-y-6">
            <section className="protocol-card p-8 border-gold/10 bg-gold/[0.02]">
                <div className="flex items-center gap-3 mb-8">
                    <Users className="w-5 h-5 text-gold" />
                    <h2 className="text-sm font-black uppercase tracking-widest">Lead Pipeline</h2>
                </div>
                <div className="text-center py-8 border-y border-zinc-900 mb-8">
                    <p className="text-5xl font-black text-white mb-2">{stats?.pipeline?.total_leads}</p>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Total Captured Leads</p>
                </div>
                <Link href="/admin/leads" className="btn-gold w-full py-4 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                    Enter CRM <ChevronRight className="w-4 h-4" />
                </Link>
            </section>

            <section className="protocol-card p-8 bg-zinc-950">
                <div className="flex items-center gap-3 mb-6">
                    <Target className="w-5 h-5 text-zinc-500" />
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Autonomous Heartbeat</h2>
                </div>
                <div className="space-y-4">
                    {stats?.recent_logs && stats.recent_logs.length > 0 ? stats.recent_logs.map((l, i) => (
                        <div key={i} className="flex justify-between items-start gap-4">
                            <div>
                                <p className="text-[10px] text-zinc-400 leading-tight uppercase font-medium">
                                    {l.workflow_name.replace(/_/g, ' ')}
                                </p>
                                <p className="text-[8px] text-zinc-700 font-bold uppercase mt-1">Status: {l.status}</p>
                            </div>
                            <span className="text-[9px] text-zinc-800 font-black uppercase whitespace-nowrap">
                                {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )) : (
                        <p className="text-[10px] text-zinc-700 font-black uppercase text-center py-4">Waiting for Protocol Pulse...</p>
                    )}
                </div>
            </section>

            {/* Recent Autonomous Wins */}
            <section className="protocol-card p-8 bg-emerald-500/5 border-emerald-500/10">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-emerald-400" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-white">Recent Autonomous Wins</h2>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Revenue Active</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {stats?.recent_logs.filter(l => l.workflow_name === 'first_autonomous_sale').map((log, i) => {
                        const payload = JSON.parse(typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload));
                        return (
                            <div key={i} className="bg-black/40 border border-emerald-500/10 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-emerald-500/30 transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-emerald-500/30 transition-colors">
                                        <ShieldCheck className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-white uppercase text-sm">{payload.brand} Pilot</h3>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Closed Won &bull; {new Date(log.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8 w-full md:w-auto">
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Contract Revenue</p>
                                        <p className="text-xl font-black text-emerald-400">${payload.revenue.toLocaleString()}</p>
                                    </div>
                                    <Link href={payload.l2_anchor ? `https://amoy.polygonscan.com/tx/${payload.l2_anchor}` : '#'} target="_blank" className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-white hover:border-emerald-500/50 transition-all">
                                        <Activity className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                    {(!stats?.recent_logs.some(l => l.workflow_name === 'first_autonomous_sale')) && (
                        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                           <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Waiting for first autonomous conversion...</p>
                        </div>
                    )}
                </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
