import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import AgentXPDisplay from '@/components/AgentXPDisplay';
import { Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

async function getDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [qrCount, profileCount, agent] = await Promise.all([
    supabase.from('qr_codes').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('protocol_agents').select('*').eq('user_id', user.id).eq('status', 'active').single()
  ]);

  return { 
    totalQr: qrCount.count ?? 0, 
    totalUsers: profileCount.count ?? 0,
    agent: agent.data
  };
}

export default async function Dashboard() {
  const data = await getDashboardData();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Protocol <span className="text-blue-500">Dashboard</span></h1>
          <p className="text-gray-500 mt-1 text-[10px] font-black uppercase tracking-widest">
            {data ? 'Live Truth Layer Feed' : 'Offline Mode'}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/studio" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95">
            Open Studio
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        {/* Left: Stats & Links */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total QR Codes', value: data ? data.totalQr.toLocaleString() : '—', color: 'text-blue-400' },
              { label: 'Registered Users', value: data ? data.totalUsers.toLocaleString() : '—', color: 'text-green-400' },
              { label: 'Active Edge Nodes', value: '300+', color: 'text-purple-400' },
              { label: 'Uptime (30d)', value: '99.97%', color: 'text-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
                <p className={`text-xl font-black ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { href: '/studio', label: 'Create QRON', desc: 'Generate AI-powered QR art', color: 'from-blue-600 to-blue-800' },
              { href: '/dashboard/products', label: 'Products & QR Codes', desc: 'Manage products and tamper-evident QR codes', color: 'from-emerald-600 to-teal-800' },
              { href: '/gallery', label: 'Browse Gallery', desc: 'View all generated QRONs', color: 'from-purple-600 to-purple-800' },
              { href: '/dashboard/autonomous', label: 'Autonomous Ops', desc: 'AgentZ pipeline, scheduled jobs, control panel', color: 'from-yellow-600 to-orange-700' },
            ].map(({ href, label, desc, color }) => (
              <Link key={href} href={href}
                className={`block p-6 rounded-xl bg-gradient-to-br ${color} text-white hover:opacity-90 transition-opacity`}
                style={{ textDecoration: 'none' }}>
                <p className="font-black text-lg mb-1 uppercase tracking-tight">{label}</p>
                <p className="text-xs opacity-80 uppercase font-bold">{desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Agent Status */}
        <div className="space-y-8">
           {data?.agent ? (
             <AgentXPDisplay agent={{
               name: data.agent.name,
               level: data.agent.level || 1,
               xp: data.agent.xp || 0,
               reputationScore: data.agent.reputationScore || 0,
               totalVerifications: data.agent.totalVerifications || 0,
               agentType: data.agent.agentType || 'Standard'
             }} />
           ) : (
             <div className="protocol-card p-8 bg-zinc-950/50 border-zinc-900 text-center">
                <Zap className="w-8 h-8 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-xs font-black uppercase text-zinc-500 mb-2">No Active Agent</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase mb-6">Initialize your protocol guardian to start earning $QRON</p>
                <Link href="/studio" className="btn-gold py-3 text-[10px]">Initialize Agent</Link>
             </div>
           )}
        </div>
      </div>

      {/* YouTube Channel */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-2">@AuthiChain-Qronspace</p>
        <h2 className="text-xl font-bold mb-1">Latest from Our Channel</h2>
        <p className="text-zinc-400 text-sm mb-4">Watch QRON use cases, tutorials, and ecosystem updates</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg overflow-hidden aspect-video">
            <iframe
              src="https://www.youtube.com/embed/mfckohgDrNk?rel=0&modestbranding=1"
              title="QRON Overview"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <div className="rounded-lg overflow-hidden aspect-video">
            <iframe
              src="https://www.youtube.com/embed/70KG5d2fFUo?rel=0&modestbranding=1"
              title="QRON Token Economy"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
        <div className="mt-4">
          <a href="https://www.youtube.com/@AuthiChain-Qronspace" target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-full hover:bg-red-700 transition-colors"
             style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/>
            </svg>
            Subscribe · @AuthiChain-Qronspace
          </a>
        </div>
      </div>

      {/* Ecosystem Links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { name: 'AuthiChain', url: 'https://authichain.com', color: '#34d399' },
          { name: 'StrainChain', url: 'https://strainchain.io', color: '#22c55e' },
          { name: 'GovChain', url: 'https://govchain.us', color: '#60a5fa' },
        ].map(({ name, url, color }) => (
          <a key={name} href={url} target="_blank" rel="noopener noreferrer"
             className="text-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors"
             style={{ textDecoration: 'none' }}>
            <span className="text-sm font-black block" style={{ color }}>{name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
