import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Auth is handled by src/app/dashboard/layout.tsx — no need to duplicate here.
// Remove conflicting revalidate (force-dynamic already opts out of caching).
export const dynamic = 'force-dynamic';

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">QRON Dashboard</h1>
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
          { label: 'Total QR Codes', value: stats ? stats.totalQr.toLocaleString() : '\u2014', color: 'text-blue-400' },
          { label: 'Registered Users', value: stats ? stats.totalUsers.toLocaleString() : '\u2014', color: 'text-green-400' },
          { label: 'Active Edge Nodes', value: '300+', color: 'text-purple-400' },
          { label: 'Uptime (30d)', value: '99.97%', color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-5 gap-4 mb-8">
        {[
          { href: '/studio', label: 'Create QRON', desc: 'Generate AI-powered QR art', color: 'from-blue-600 to-blue-800' },
          { href: '/dashboard/products', label: 'Products & QR Codes', desc: 'Manage products and tamper-evident QR codes', color: 'from-emerald-600 to-teal-800' },
          { href: '/gallery', label: 'Browse Gallery', desc: 'View all generated QRONs', color: 'from-purple-600 to-purple-800' },
          { href: '/dashboard/autonomous', label: 'Autonomous Ops', desc: 'AgentZ pipeline, scheduled jobs, control panel', color: 'from-yellow-600 to-orange-700' },
          { href: '/founders', label: 'DreamDash', desc: 'Real-time deal pipeline & revenue', color: 'from-amber-600 to-amber-800' },
        ].map(({ href, label, desc, color }) => (
          <Link key={href} href={href}
            className={`block p-6 rounded-xl bg-gradient-to-br ${color} text-white hover:opacity-90 transition-opacity`}
            style={{ textDecoration: 'none' }}>
            <p className="font-black text-lg mb-1">{label}</p>
            <p className="text-sm opacity-80">{desc}</p>
          </Link>
        ))}
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
