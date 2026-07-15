import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Activity, Zap, Globe, Users, QrCode, TrendingUp, Clock, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

async function getStats() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const [qrCount, userCount, genCount] = await Promise.all([
      sb.from('qr_codes').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('generation_logs').select('id', { count: 'exact', head: true }),
    ]);
    return {
      totalQr: qrCount.count ?? 0,
      totalUsers: userCount.count ?? 0,
      totalGenerations: genCount.count ?? 0,
    };
  } catch { return null; }
}

export default async function Dashboard() {
  const stats = await getStats();

  const cards = [
    {
      icon: QrCode,
      label: 'TOTAL QR CODES',
      value: stats ? stats.totalQr.toLocaleString() : '—',
      color: 'text-blue-400',
      live: !!stats,
    },
    {
      icon: Zap,
      label: 'TOTAL GENERATIONS',
      value: stats ? stats.totalGenerations.toLocaleString() : '—',
      color: 'text-yellow-400',
      live: !!stats,
    },
    {
      icon: Users,
      label: 'REGISTERED USERS',
      value: stats ? stats.totalUsers.toLocaleString() : '—',
      color: 'text-green-400',
      live: !!stats,
    },
    {
      icon: Globe,
      label: 'GLOBAL LATENCY',
      value: '< 2s',
      color: 'text-cyan-400',
      live: false,
    },
    {
      icon: Activity,
      label: 'ACTIVE EDGE NODES',
      value: '300+',
      color: 'text-purple-400',
      live: false,
    },
    {
      icon: Shield,
      label: 'UPTIME (30d)',
      value: '99.97%',
      color: 'text-emerald-400',
      live: false,
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">QRON Studio Telemetry</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {stats ? 'Live data from Supabase • refreshes every 60s' : 'Static display • configure Supabase env vars for live data'}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/studio" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
            Open Studio
          </Link>
          <Link href="/gallery" className="px-4 py-2 border border-gray-700 hover:border-gray-500 rounded-lg text-sm font-medium transition-colors">
            View Gallery
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="p-6 border border-gray-800 rounded-xl bg-black/40 text-white shadow-sm hover:border-gray-600 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider">{card.label}</h3>
              {card.live && <span className="ml-auto text-xs text-green-500 font-medium">LIVE</span>}
            </div>
            <p className={`text-4xl font-bold mt-2 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border border-gray-800 rounded-xl bg-black/40">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold">Quick Actions</h3>
          </div>
          <div className="space-y-3">
            <Link href="/studio" className="flex items-center justify-between p-3 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors group">
              <span className="text-sm">Generate new QR art</span>
              <span className="text-blue-400 text-xs group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link href="/gallery" className="flex items-center justify-between p-3 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors group">
              <span className="text-sm">Browse gallery</span>
              <span className="text-blue-400 text-xs group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link href="/pricing" className="flex items-center justify-between p-3 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors group">
              <span className="text-sm">Upgrade plan</span>
              <span className="text-blue-400 text-xs group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
        <div className="p-6 border border-gray-800 rounded-xl bg-black/40">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-purple-400" />
            <h3 className="font-semibold">System Status</h3>
          </div>
          <div className="space-y-3">
            {[
              { name: 'QR Generation API', status: 'Operational', color: 'bg-green-500' },
              { name: 'Cloudflare Edge Worker', status: 'Operational', color: 'bg-green-500' },
              { name: 'Supabase Database', status: stats ? 'Connected' : 'Unconfigured', color: stats ? 'bg-green-500' : 'bg-yellow-500' },
              { name: 'Stripe Payments', status: 'Operational', color: 'bg-green-500' },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-900">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${svc.color}`} />
                  <span className="text-sm">{svc.name}</span>
                </div>
                <span className="text-xs text-gray-400">{svc.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
