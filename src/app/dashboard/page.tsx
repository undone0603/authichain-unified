import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const BRAND_LABELS: Record<string, string> = {
  authichain: 'AuthiChain',
  qron: 'QRON',
  strainchain: 'StrainChain',
  govchain: 'GovChain',
};

async function getStats() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const [qrCount, userCount] = await Promise.all([
      sb.from('qr_codes').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
    ]);
    return { totalQr: qrCount.count ?? 0, totalUsers: userCount.count ?? 0 };
  } catch { return null; }
}

export default async function Dashboard() {
  const stats = await getStats();
  const hdrs = await headers();
  const brandId = hdrs.get('x-brand') ?? 'qron';
  const brandLabel = BRAND_LABELS[brandId] ?? 'QRON';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{brandLabel} Dashboard</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {stats ? 'Live data from Supabase' : 'Configure Supabase env vars for live data'}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/studio" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
            Open Studio
          </Link>
          <Link href="/gallery" className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-semibold hover:bg-zinc-700 transition-colors">
            Gallery
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total QR Codes', value: stats ? stats.totalQr.toLocaleString() : '—', color: 'text-blue-400' },
          { label: 'Registered Users', value: stats ? stats.totalUsers.toLocaleString() : '—', color: 'text-green-400' },
          { label: 'Active Edge Nodes', value: '300+', color: 'text-purple-400' },
          { label: 'Uptime (30d)', value: '99.97%', color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { href: '/studio', label: 'Create QRON', desc: 'Generate AI-powered QR art', color: 'from-blue-600 to-blue-800' },
          { href: '/dashboard/products', label: 'Products & QR Codes', desc: 'Manage products and tamper-evident QR codes', color: 'from-emerald-600 to-teal-800' },
          { href: '/gallery', label: 'Browse Gallery', desc: 'View all generated QRONs', color: 'from-purple-600 to-purple-800' },
          { href: '/dashboard/autonomous', label: 'Autonomous Ops', desc: 'AgentZ pipeline, scheduled jobs, control panel', color: 'from-yellow-600 to-orange-700' },
        ].map(({ href, label, desc, color }) => (
          <Link key={href} href={href} className={`bg-gradient-to-br ${color} rounded-xl p-5 hover:opacity-90 transition-opacity`}>
            <p className="font-semibold text-white">{label}</p>
            <p className="text-xs text-white/70 mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      {/* YouTube Channel */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <p className="text-xs text-gray-500 mb-1">@AuthiChain-Qronspace</p>
        <h2 className="text-xl font-semibold mb-2">Latest from Our Channel</h2>
        <p className="text-sm text-gray-400 mb-4">Watch QRON use cases, tutorials, and ecosystem updates</p>
        <Link href="https://www.youtube.com/@AuthiChain-Qronspace" target="_blank" className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
          QRON Overview
        </Link>
      </div>

      {/* Ecosystem Links */}
      <div className="mt-8 flex gap-4 text-sm text-gray-500">
        <Link href="https://authichain.com" className="hover:text-white transition-colors">AuthiChain</Link>
        <Link href="https://strainchain.io" className="hover:text-white transition-colors">StrainChain</Link>
        <Link href="https://govchain.us" className="hover:text-white transition-colors">GovChain</Link>
      </div>
    </div>
  );
}
