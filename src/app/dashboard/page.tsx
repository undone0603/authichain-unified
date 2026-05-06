'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  LayoutDashboard,
  QrCode,
  Zap,
  Shield,
  Plus,
  TrendingUp,
  FolderOpen,
  Vote,
  FileDown,
  Activity,
} from 'lucide-react';
import { QRONGallery } from '@/components/QRONGallery';
import { FolderManager } from '@/components/FolderManager';
import { TagManager } from '@/components/TagManager';
import { APIKeyManager } from '@/components/APIKeyManager';
import { WebhookManager } from '@/components/WebhookManager';

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, scans: 0, credits: 0 });
  const supabase = createClient();

  useEffect(() => {
    const getData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign('/login');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data: userQrons } = await supabase
        .from('qrons')
        .select('scan_count')
        .eq('user_id', user.id);

      if (userQrons) {
        const totalScans = userQrons.reduce(
          (acc, q) => acc + (q.scan_count || 0),
          0
        );
        setStats({
          total: userQrons.length,
          scans: totalScans,
          credits: profile ? profile.generations_limit - profile.generations_used : 0,
        });
      }
      setLoading(false);
    };
    getData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-r border-zinc-900 flex flex-col p-6 space-y-8">
        <div className="flex items-center gap-2 px-2">
          <Shield className="w-6 h-6 text-gold" />
          <span className="text-xl font-black gold-text">QRON</span>
        </div>

        <div className="space-y-6">
          <nav className="space-y-1">
            <button
              onClick={() => {
                setSelectedFolderId(null);
                setSelectedTagId(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                !selectedFolderId && !selectedTagId
                  ? 'bg-gold/10 text-gold'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </button>
            <Link
              href="/governance"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all"
            >
              <Vote className="w-4 h-4 text-gold/40" />
              Governance
            </Link>
          </nav>

          <FolderManager
            userId={user?.id || ''}
            onFolderSelected={setSelectedFolderId}
          />
          <TagManager userId={user?.id || ''} onTagSelected={setSelectedTagId} />

          <div className="p-4 rounded-xl bg-gold/5 border border-gold/10">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black uppercase text-zinc-500">
                Credits
              </p>
              <p className="text-[10px] font-black uppercase text-gold">
                {stats.credits} Left
              </p>
            </div>
            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gold h-full"
                style={{ width: `${(stats.credits / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight uppercase">
              My <span className="gold-text">Registry</span>
            </h1>
            <p className="text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">
              {selectedFolderId
                ? 'Filtered by Folder'
                : selectedTagId
                  ? 'Filtered by Tag'
                  : 'Full Collection'}
            </p>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={() => alert('Exporting PDF Report...')}
                className="btn-outline-gold px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-zinc-800"
             >
                <FileDown className="w-3.5 h-3.5" /> PDF
             </button>
             <button 
                onClick={() => alert('Exporting CSV Data...')}
                className="btn-outline-gold px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-zinc-800"
             >
                <FileDown className="w-3.5 h-3.5" /> CSV
             </button>
             <Link
                href="/"
                className="btn-gold px-8 py-3 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-gold"
              >
                <Plus className="w-4 h-4" />
                New QRON
              </Link>
          </div>
        </header>

        {/* Stats Strip */}
        {!selectedFolderId && !selectedTagId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'Total QRONs', val: stats.total, icon: QrCode, color: 'text-gold' },
              { label: 'Total Scans', val: stats.scans, icon: TrendingUp, color: 'text-blue-400' },
              { label: 'Fraud Prevented', val: Math.floor(stats.scans * 0.04), icon: Shield, color: 'text-green-400' },
              { label: 'System Uptime', val: '99.98%', icon: Activity, color: 'text-purple-400' },
            ].map((s) => (
              <div
                key={s.label}
                className="protocol-card p-6 bg-zinc-950/50 border-zinc-900 group hover:border-gold/30 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                    <span className="text-[10px] font-black text-zinc-800 uppercase tracking-widest group-hover:text-zinc-700 transition-colors flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Real-time
                    </span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">
                    {s.label}
                  </p>
                  <p className="text-3xl font-black text-white tracking-tighter">{s.val}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Library */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-gold/40" />
              Library
            </h2>
            <div className="h-px flex-1 bg-zinc-900 mx-6" />
          </div>

          <QRONGallery
            currentUserId={user?.id}
            selectedFolderId={selectedFolderId}
            selectedTagId={selectedTagId}
          />
        </section>

        {/* Affiliate Hub */}
        {!selectedFolderId && !selectedTagId && (
            <section className="mt-16 pt-12 border-t border-zinc-900">
                <div className="flex items-center gap-3 mb-8">
                    <TrendingUp className="w-5 h-5 text-gold" />
                    <h2 className="text-xl font-black uppercase tracking-tight">Affiliate Hub</h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 protocol-card p-8 bg-gold/5 border-gold/10">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                          <div className="max-w-md">
                              <h3 className="text-lg font-bold text-white mb-2">Earn 20% Recurring Commission</h3>
                              <p className="text-zinc-500 text-sm leading-relaxed">
                                  Share QRON with your audience. For every user who signs up via your link, 
                                  you earn 20% of their generation pack or subscription purchases for life.
                              </p>
                          </div>
                          <button 
                              onClick={async () => {
                                  const res = await fetch('/api/affiliate/join', { method: 'POST' });
                                  if (res.ok) alert('Welcome to the Affiliate Program!');
                                  window.location.reload();
                              }}
                              className="btn-gold px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]"
                          >
                              Activate My Affiliate Link
                          </button>
                      </div>
                  </div>

                  {/* Growth Leaderboard */}
                  <div className="protocol-card p-6 bg-zinc-950">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">Local Growth Leaderboard</h3>
                    <div className="space-y-4">
                      {[
                        { name: 'Elite Partners', count: 142, earned: '$2,480' },
                        { name: 'Visual Web', count: 89, earned: '$1,640' },
                        { name: 'Industrial Supply', count: 64, earned: '$1,120' },
                        { name: 'Beta Block', count: 42, earned: '$620' },
                        { name: 'Modern Mkt', count: 31, earned: '$440' }
                      ].map((a, i) => (
                        <div key={i} className="flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-zinc-800">0{i+1}</span>
                            <span className="text-xs font-bold text-zinc-400 group-hover:text-gold transition-colors uppercase">{a.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-white">{a.count}</p>
                            <p className="text-[8px] font-bold text-zinc-700 uppercase">Referrals</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
            </section>
        )}

        {/* Industrial Access (API Keys) */}
        {!selectedFolderId && !selectedTagId && (
            <section className="mt-16 pt-12 border-t border-zinc-900">
                <APIKeyManager userId={user?.id || ''} />
            </section>
        )}

        {/* Webhooks Hub */}
        {!selectedFolderId && !selectedTagId && (
            <section className="mt-16 pt-12 border-t border-zinc-900">
                <WebhookManager userId={user?.id || ''} />
            </section>
        )}
      </main>
    </div>
  );
}
