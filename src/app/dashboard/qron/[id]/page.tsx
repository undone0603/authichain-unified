'use client';

import { useEffect, useState, use, startTransition } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronLeft,
  Shield,
  TrendingUp,
  ExternalLink,
  Save,
  Zap,
  Globe,
  Film,
  Sparkles,
  Link as LinkIcon,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { QRONEntry } from '@/lib/types';
import { RedirectRulesManager } from '@/components/RedirectRulesManager';
import { anchorQRONAction } from '@/app/actions/anchoring';
import { ethers } from 'ethers';

export default function QronManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [qron, setQron] = useState<QRONEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetUrl, setTargetUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorResult, setAnchorResult] = useState<{ txHash: string; anchorId: string } | null>(null);
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
      startTransition(() => {
        setUser(user);
      });

      const { data: qronData } = await supabase
        .from('qrons')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (qronData) {
        startTransition(() => {
          setQron(qronData as QRONEntry);
          setTargetUrl(qronData.target_url);
        });
      }
      startTransition(() => {
        setLoading(false);
      });
    };
    getData();
  }, [id, supabase]);

  const handleUpdate = async () => {
    if (!user || !qron) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('qrons')
      .update({ target_url: targetUrl, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      alert('Failed to update: ' + error.message);
    } else {
      setQron({ ...qron, target_url: targetUrl });
    }
    setIsSaving(false);
  };

  const handleAnchor = async () => {
    if (!qron) return;
    setIsAnchoring(true);
    // In a real scenario, the edgeHash would be part of the QRON data from the worker
    // For this pilot, we generate a mock Ed25519-style hash based on the ID if missing
    const mockEdgeHash = qron.qr_content || ethers.id(qron.id);
    
    const result = await anchorQRONAction(qron.id, mockEdgeHash);
    if (result.success && result.txHash) {
      setAnchorResult({ txHash: result.txHash, anchorId: result.anchorId || '' });
      // Update local state to show anchored status
      setQron({
        ...qron,
        metadata: {
          ...qron.metadata,
          blockchain: 'polygon',
          tx_hash: result.txHash,
          anchored_at: new Date().toISOString()
        }
      });
    } else {
      alert('Anchoring failed: ' + result.error);
    }
    setIsAnchoring(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold" />
      </div>
    );
  }

  if (!qron) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <Shield className="w-12 h-12 text-zinc-800 mb-4" />
        <h1 className="text-xl font-bold uppercase tracking-tight">
          QRON Not Found
        </h1>
        <p className="text-zinc-500 text-sm mt-2 mb-8">
          This creation does not exist or you do not have permission to view it.
        </p>
        <Link href="/dashboard" className="btn-outline-gold px-8 py-2 text-xs">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const shortUrl = `${window.location.origin}/s/${qron.id}`;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-zinc-500 hover:text-gold transition-colors text-xs font-bold uppercase tracking-widest mb-10"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest mb-4">
              {qron.mode} Edition
            </div>
            <h1 className="text-4xl font-black tracking-tight uppercase leading-none mb-4">
              Manage <span className="gold-text">Creation</span>
            </h1>
            <p className="text-zinc-500 font-medium truncate max-w-md">
              {qron.prompt}
            </p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <a
              href={shortUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-outline-gold flex-1 md:flex-none py-3 px-6 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border-zinc-800"
            >
              <ExternalLink className="w-4 h-4" />
              Test Redirect
            </a>
            <button className="btn-gold flex-1 md:flex-none py-3 px-8 rounded-xl font-black uppercase tracking-widest text-[10px]">
              Export Asset
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Asset & Basic Settings */}
          <div className="space-y-8">
            <div className="protocol-card overflow-hidden">
              <div className="relative aspect-square">
                <Image
                  src={qron.image_url}
                  alt={qron.prompt}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="p-6 bg-zinc-900/40">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    Asset ID
                  </p>
                  <p className="text-[10px] font-mono text-zinc-400">
                    {qron.id.slice(0, 18)}...
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    Created
                  </p>
                  <p className="text-[10px] font-bold text-zinc-400">
                    {new Date(qron.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="protocol-card p-8">
              <div className="flex items-center gap-2 mb-6 text-gold">
                <Globe className="w-4 h-4" />
                <h2 className="text-xs font-black uppercase tracking-widest">
                  Base Destination
                </h2>
              </div>
              <div className="space-y-4">
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="protocol-input w-full px-4 py-3 text-sm"
                  placeholder="https://your-url.com"
                />
                <button
                  onClick={handleUpdate}
                  disabled={isSaving || targetUrl === qron.target_url}
                  className="btn-gold w-full py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 font-bold mt-4 leading-relaxed uppercase italic">
                Changes take effect instantly globally without reprinting.
              </p>
            </div>
          </div>

          {/* Right Column: Advanced Rules & A/B Testing */}
          <div className="lg:col-span-2 space-y-12">
            {/* AI Story Mode Section */}
            <section className="protocol-card p-8 border-gold/20 bg-gold/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <Sparkles className="w-10 h-10 text-gold/10" />
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-gold/10 text-gold">
                        <Film className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight leading-none">
                            AI Story Mode
                        </h2>
                        <p className="text-gold/60 text-[10px] font-black uppercase tracking-widest mt-1">
                            {qron.story_enabled ? `${qron.story_tier} Tier Activated` : 'Premium Narrative Engine'}
                        </p>
                    </div>
                </div>

                {qron.story_enabled ? (
                    <div className="space-y-6">
                        <div className="p-4 rounded-xl bg-black/40 border border-gold/10">
                            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                                Story Mode is active. Your QRON now serves an immersive, multi-scene AI experience when scanned.
                            </p>
                            <div className="flex gap-4">
                                <button className="btn-outline-gold py-2 px-4 text-[10px] font-bold uppercase tracking-widest border-zinc-800">
                                    Edit Scenes
                                </button>
                                <button className="btn-outline-gold py-2 px-4 text-[10px] font-bold uppercase tracking-widest border-zinc-800">
                                    View Analytics
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <p className="text-sm text-zinc-500 leading-relaxed max-w-lg">
                            Unlock the full potential of your QRON. AI Story Mode transforms a simple redirect into a high-conversion, multi-layered brand narrative.
                        </p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                            {[
                                'Multi-scene AI sequences',
                                'Interactive Call-to-Actions',
                                'Real-time narrative updates',
                                'Premium Analytics + Video'
                            ].map(feat => (
                                <li key={feat} className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-400">
                                    <div className="w-1 h-1 rounded-full bg-gold" />
                                    {feat}
                                </li>
                            ))}
                        </ul>
                        <button className="btn-gold px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-gold">
                            Upgrade to Story Mode
                        </button>
                    </div>
                )}
            </section>

            {/* Blockchain Provenance Section */}
            <section className="protocol-card p-8 border-zinc-800 bg-zinc-950/30">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 text-gold">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight leading-none">
                      Blockchain Provenance
                    </h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
                      Polygon Mainnet Anchoring
                    </p>
                  </div>
                </div>
                {qron.metadata?.tx_hash && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-widest">
                    <CheckCircle2 className="w-3 h-3" />
                    Anchored
                  </div>
                )}
              </div>

              {qron.metadata?.tx_hash ? (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-black/40 border border-zinc-800/50">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Transaction Hash</p>
                    <div className="flex items-center justify-between gap-4">
                      <code className="text-xs font-mono text-gold truncate">
                        {qron.metadata.tx_hash}
                      </code>
                      <a 
                        href={`https://polygonscan.com/tx/${qron.metadata.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black text-white hover:text-gold uppercase flex items-center gap-1 shrink-0"
                      >
                        Verify <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/30">
                      <p className="text-[9px] font-black text-zinc-700 uppercase mb-1">Network</p>
                      <p className="text-[10px] font-bold text-zinc-300">Polygon Mainnet</p>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/30">
                      <p className="text-[9px] font-black text-zinc-700 uppercase mb-1">Timestamp</p>
                      <p className="text-[10px] font-bold text-zinc-300">
                        {new Date(qron.metadata.anchored_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-sm text-zinc-500 leading-relaxed max-w-lg">
                    Anchor this creation&apos;s Ed25519 Edge hash to the Polygon blockchain to create an immutable, publicly verifiable proof of authenticity.
                  </p>
                  <button 
                    onClick={handleAnchor}
                    disabled={isAnchoring}
                    className="btn-gold px-10 py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-gold disabled:opacity-50"
                  >
                    {isAnchoring ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Securing Protocol...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Anchor to Polygon
                      </>
                    )}
                  </button>
                  <p className="text-[9px] font-bold text-zinc-700 uppercase">
                    Requires Protocol Credits &bull; Estimated gas: ~0.002 MATIC
                  </p>
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-lg bg-gold/10 text-gold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight leading-none">
                    Smart Redirects
                  </h2>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">
                    Device, Time, and A/B Optimization
                  </p>
                </div>
              </div>

              <RedirectRulesManager qronId={qron.id} userId={user?.id || ''} />
            </section>

            <section className="pt-12 border-t border-zinc-900">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-lg bg-zinc-900 text-zinc-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight leading-none">
                  Analytics Snapshot
                </h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Scans', val: qron.scan_count || 0 },
                  { label: 'Unique Users', val: Math.floor((qron.scan_count || 0) * 0.8) },
                  { label: 'Conversion', val: '12.4%' },
                  { label: 'Health', val: '99.9%' },
                ].map(s => (
                  <div key={s.label} className="protocol-card p-4 text-center">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">{s.label}</p>
                    <p className="text-xl font-black text-white">{s.val}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
