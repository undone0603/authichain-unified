'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, Loader2, RefreshCw, TrendingUp, Users, Target, Activity,
  BarChart3, Zap, Lock
} from 'lucide-react';

interface AnalyticsData {
  generated_at: string;
  pipeline: {
    scoutedLeads: number;
    hubspotDeals: number;
    storyModesQueued: number;
    pilotConversionRate: number;
  };
  economics: {
    totalQronIssued: number;
    totalUsdValue: number;
    activePilots: number;
    qronBurned: number;
  };
  recentDeals: Array<{
    name: string;
    industry: string;
    score: number;
    status: string;
    time: string;
  }>;
}

// Mock data generator for the dashboard
// In production, this would fetch from a real /api/admin/analytics endpoint aggregating Supabase + HubSpot data
const generateMockData = (): AnalyticsData => ({
  generated_at: new Date().toISOString(),
  pipeline: {
    scoutedLeads: 124,
    hubspotDeals: 38,
    storyModesQueued: 38,
    pilotConversionRate: 30.6,
  },
  economics: {
    totalQronIssued: 14500,
    totalUsdValue: 3452, // At $0.238/QRON approx
    activePilots: 12,
    qronBurned: 1250,
  },
  recentDeals: [
    { name: 'Detroit Artisan Brews', industry: 'Brewery', score: 100, status: 'Provisioned', time: '10 mins ago' },
    { name: 'Founders Brewing Co.', industry: 'Brewery', score: 100, status: 'Provisioned', time: '15 mins ago' },
    { name: 'City Herbals', industry: 'Dispensary', score: 90, status: 'Review', time: '1 hour ago' },
    { name: 'House of Pure Vin', industry: 'Boutique', score: 80, status: 'Scouted', time: '2 hours ago' },
  ]
});

export default function ExecutiveAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    // Simulate API delay
    await new Promise(r => setTimeout(r, 800));
    setData(generateMockData());
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-zinc-500 hover:text-gold text-xs font-bold uppercase tracking-widest mb-3">
              <ChevronLeft className="w-3 h-3" /> Admin
            </Link>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
              Executive <span className="gold-text">ROI Dashboard</span>
            </h1>
            <p className="text-zinc-500 mt-2 text-sm uppercase tracking-widest">
              Autonomous Pipeline & Economics · refreshed {data ? new Date(data.generated_at).toLocaleTimeString() : '—'}
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 rounded text-xs uppercase tracking-widest hover:border-gold/40 hover:bg-gold/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-gold' : ''}`} /> Sync Data
          </button>
        </header>

        {/* Top KPIs - Pipeline */}
        <div className="mb-8">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" /> Autonomous Pipeline (Last 30 Days)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="protocol-card p-6 bg-zinc-900/50 border-zinc-800/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Scouted Leads</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{data?.pipeline.scoutedLeads}</span>
              </div>
            </div>
            <div className="protocol-card p-6 bg-emerald-500/5 border-emerald-500/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">HubSpot Deals Created</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">{data?.pipeline.hubspotDeals}</span>
              </div>
            </div>
            <div className="protocol-card p-6 bg-zinc-900/50 border-zinc-800/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">StoryModes Queued</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{data?.pipeline.storyModesQueued}</span>
              </div>
            </div>
            <div className="protocol-card p-6 bg-gold/5 border-gold/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gold mb-2">Pilot Conv. Rate</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-gold">{data?.pipeline.pilotConversionRate}%</span>
                <TrendingUp className="w-4 h-4 text-gold" />
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section - Economics & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* QRON Economics */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" /> Token Economics
            </h2>
            
            <div className="protocol-card p-6 bg-purple-500/5 border-purple-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity className="w-24 h-24 text-purple-400" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1 relative z-10">Total QRON Issued</p>
              <div className="flex items-baseline gap-2 mb-4 relative z-10">
                <span className="text-4xl font-black text-white">{data?.economics.totalQronIssued.toLocaleString()}</span>
                <span className="text-sm text-purple-500 font-bold uppercase">QRON</span>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-purple-500/20 relative z-10">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400 font-medium">Estimated USD Value</span>
                  <span className="text-sm font-black text-white">${data?.economics.totalUsdValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400 font-medium">Active $199 Pilots</span>
                  <span className="text-sm font-black text-white">{data?.economics.activePilots}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400 font-medium">QRON Burned (L2 Siphon)</span>
                  <span className="text-sm font-black text-red-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {data?.economics.qronBurned.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="protocol-card p-6 bg-zinc-900/50 border-zinc-800/50">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Treasury Status</h3>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-zinc-500">Polygon Hot Wallet</span>
                <span className="text-xs font-mono text-emerald-400">Connected</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 w-[85%] h-full" />
              </div>
              <p className="text-[9px] text-zinc-600 mt-2 text-right uppercase tracking-widest">85% Liquidity Available</p>
            </div>
          </div>

          {/* Recent Deals */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" /> Live Autonomous Feed
            </h2>
            
            <div className="protocol-card border-zinc-800/50 bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/50 bg-zinc-900/20">
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Target Entity</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Vertical</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fit Score</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Pipeline Status</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Time</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data?.recentDeals.map((deal, i) => (
                      <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                        <td className="p-4 font-bold text-white">{deal.name}</td>
                        <td className="p-4 text-zinc-400">{deal.industry}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                            deal.score >= 90 ? 'bg-gold/10 text-gold border border-gold/20' : 
                            deal.score >= 70 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {deal.score}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${
                            deal.status === 'Provisioned' ? 'text-emerald-400 flex items-center gap-1' : 'text-zinc-500'
                          }`}>
                            {deal.status === 'Provisioned' && <Lock className="w-3 h-3" />}
                            {deal.status}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-500 text-xs font-mono">{deal.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-zinc-900/50 border-t border-zinc-800/50 text-center">
                <Link href="/admin/leads" className="text-[10px] font-black text-cyan-500 uppercase tracking-widest hover:text-cyan-400">
                  View All Hubspot Deals &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
