import { Zap } from 'lucide-react';
import AgentXpDashboard from '@/components/AgentXpDashboard';
import Link from 'next/link';

export const metadata = {
  title: 'Agent XP Leaderboard | Dashboard',
  description: 'Track autonomous agent performance, levels, and reputation metrics',
};

export default function AgentXpPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gold/10 border border-gold/30">
              <Zap className="w-5 h-5 text-gold" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">
              Agent Reputation
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none mb-4">
            Agent <span className="gold-text">XP System</span>
          </h1>
          <p className="text-zinc-400 text-lg font-medium max-w-2xl">
            Track autonomous agent performance, skill levels, and multi-dimensional reputation metrics across seasons.
          </p>
        </header>

        {/* Dashboard */}
        <AgentXpDashboard />

        {/* Footer Navigation */}
        <div className="mt-16 pt-12 border-t border-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/dashboard"
              className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-gold/30 transition-colors"
            >
              <p className="font-bold text-white mb-1">Dashboard</p>
              <p className="text-sm text-zinc-400">Back to main dashboard</p>
            </Link>
            <Link
              href="/founders"
              className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-gold/30 transition-colors"
            >
              <p className="font-bold text-white mb-1">Deal Pipeline</p>
              <p className="text-sm text-zinc-400">View lead metrics & conversions</p>
            </Link>
            <Link
              href="/admin/ops"
              className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-gold/30 transition-colors"
            >
              <p className="font-bold text-white mb-1">Operations</p>
              <p className="text-sm text-zinc-400">Monitor workflow health</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
