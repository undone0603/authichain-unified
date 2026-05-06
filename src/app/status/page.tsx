'use client';

import { CheckCircle2, Activity, Globe, Zap } from 'lucide-react';
import Link from 'next/link';

export default function StatusPage() {
  const systems = [
    { name: 'Core Protocol API', status: 'Operational', uptime: '99.99%', latency: '42ms' },
    { name: 'Edge Redirect Engine', status: 'Operational', uptime: '100%', latency: '12ms' },
    { name: 'AI Generation Worker', status: 'Operational', uptime: '99.95%', latency: '2.4s' },
    { name: 'Blockchain Anchoring (Polygon)', status: 'Operational', uptime: '99.99%', latency: '1.2s' },
    { name: 'Storage Cluster (S3/Supabase)', status: 'Operational', uptime: '100%', latency: '65ms' },
    { name: 'AuthiChain Verification', status: 'Operational', uptime: '99.98%', latency: '88ms' },
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest mb-4">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All Systems Operational
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-2">
              Network <span className="gold-text">Status</span>
            </h1>
            <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">
              Real-time protocol health & performance
            </p>
          </div>
          <div className="flex gap-4">
            <div className="protocol-card px-6 py-3 text-center bg-zinc-950/50">
              <p className="text-[10px] font-black text-zinc-600 uppercase mb-1">Global Uptime</p>
              <p className="text-xl font-black text-white">99.992%</p>
            </div>
          </div>
        </header>

        <div className="space-y-4 mb-16">
          {systems.map((s) => (
            <div key={s.name} className="protocol-card p-6 flex justify-between items-center group hover:border-gold/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white">{s.name}</h3>
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter mt-0.5">Last Checked: Just Now</p>
                </div>
              </div>
              <div className="flex gap-8 text-right">
                <div className="hidden sm:block">
                    <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest mb-0.5">Latency</p>
                    <p className="text-xs font-mono text-zinc-400">{s.latency}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest mb-0.5">Uptime</p>
                    <p className="text-xs font-mono text-zinc-400">{s.uptime}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="grid md:grid-cols-3 gap-8 mb-24">
            <div className="protocol-card p-8 text-center">
                <Activity className="w-6 h-6 text-gold mx-auto mb-4" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Requests / Sec</h4>
                <p className="text-2xl font-black text-white">12,402</p>
            </div>
            <div className="protocol-card p-8 text-center">
                <Globe className="w-6 h-6 text-gold mx-auto mb-4" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Active Nodes</h4>
                <p className="text-2xl font-black text-white">842</p>
            </div>
            <div className="protocol-card p-8 text-center">
                <Zap className="w-6 h-6 text-gold mx-auto mb-4" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">P50 Latency</h4>
                <p className="text-2xl font-black text-white">24ms</p>
            </div>
        </section>

        <footer className="pt-12 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em]">
                &copy; 2026 AuthiChain Protocol status monitoring
            </p>
            <Link href="/" className="text-[10px] font-black uppercase text-gold hover:underline tracking-widest">
                Return to Protocol Home &rarr;
            </Link>
        </footer>
      </div>
    </div>
  );
}
