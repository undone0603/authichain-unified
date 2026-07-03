'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Copy, CheckCircle, ExternalLink, Zap, TrendingUp, DollarSign, Users } from 'lucide-react';

interface AffiliateStats {
  affiliateCode: string;
  tier: string;
  status: string;
  commissionRate: number;
  totalReferrals: number;
  totalConversions: number;
  totalEarned: string;
  pendingPayout: string;
  payoutConnected: boolean;
  currency: string;
}

interface ConnectStatus {
  connected: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}

function AffiliateDashboardInner() {
  const searchParams = useSearchParams();
  const justJoined = searchParams.get('joined') === '1';
  const connectResult = searchParams.get('connect');

  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAffiliate, setNotAffiliate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, connectRes] = await Promise.all([
      fetch('/api/affiliate/stats'),
      fetch('/api/affiliate/connect'),
    ]);

    if (statsRes.status === 404 || statsRes.status === 401) {
      setNotAffiliate(true);
      setLoading(false);
      return;
    }

    if (statsRes.ok) setStats(await statsRes.json());
    if (connectRes.ok) setConnect(await connectRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConnect() {
    setConnectLoading(true);
    setConnectError('');
    try {
      const res = await fetch('/api/affiliate/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setConnectError(data.error || 'Failed'); setConnectLoading(false); return; }
      window.location.href = data.url;
    } catch {
      setConnectError('Network error');
      setConnectLoading(false);
    }
  }

  function copyLink() {
    if (!stats) return;
    const url = `https://qron.space/?ref=${stats.affiliateCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tierPct = stats ? Math.round(stats.commissionRate * 100) : 20;
  const refLink = stats ? `https://qron.space/?ref=${stats.affiliateCode}` : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (notAffiliate) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-black mb-4">Not enrolled yet</h1>
          <p className="text-zinc-400 mb-8">Join the affiliate program to get your referral link and start earning.</p>
          <a href="/affiliate/apply" className="btn-gold px-10 py-4 font-black">
            Join Now →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold uppercase tracking-widest mb-3">
              <Zap className="w-3 h-3" />
              {stats?.tier ?? 'Starter'} · {tierPct}% commission
            </div>
            <h1 className="text-3xl font-black">Affiliate Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-1">Code: <span className="text-zinc-300 font-mono">{stats?.affiliateCode}</span></p>
          </div>
          {justJoined && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" /> You&apos;re enrolled — share your link below
            </div>
          )}
          {connectResult === 'done' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" /> Stripe account connected
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Referral Clicks', value: stats?.totalReferrals ?? 0, icon: <Users className="w-4 h-4" />, color: 'text-blue-400' },
            { label: 'Conversions', value: stats?.totalConversions ?? 0, icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-400' },
            { label: 'Total Earned', value: `$${stats?.totalEarned ?? '0.00'}`, icon: <DollarSign className="w-4 h-4" />, color: 'text-gold' },
            { label: 'Pending Payout', value: `$${stats?.pendingPayout ?? '0.00'}`, icon: <DollarSign className="w-4 h-4" />, color: 'text-yellow-400' },
          ].map((s) => (
            <div key={s.label} className="protocol-card p-5">
              <div className={`mb-3 ${s.color}`}>{s.icon}</div>
              <div className={`text-2xl font-black mb-1 ${s.color}`}>{s.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Referral link */}
        <div className="protocol-card p-6 mb-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Your Referral Link</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 font-mono text-sm text-zinc-300 truncate">
              {refLink}
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-lg bg-gold/10 border border-gold/20 text-gold text-sm font-bold hover:bg-gold/20 transition-colors"
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Share this link anywhere. You earn {tierPct}% on every sale from referred visitors (30-day cookie).
          </p>
        </div>

        {/* Stripe Connect */}
        <div className="protocol-card p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Payout Account</h2>

          {connect?.payouts_enabled ? (
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-emerald-400">Stripe Connected — payouts enabled</p>
                <p className="text-xs text-zinc-500 mt-0.5">Monthly transfers are automatic when your balance exceeds $1.00</p>
              </div>
            </div>
          ) : connect?.connected && !connect?.payouts_enabled ? (
            <div className="space-y-3">
              <p className="text-sm text-yellow-400 font-semibold">Stripe connected but onboarding incomplete</p>
              <p className="text-xs text-zinc-500">Finish your Stripe Express setup to enable payouts.</p>
              <button
                onClick={handleConnect}
                disabled={connectLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold text-black text-sm font-black hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                {connectLoading ? 'Opening Stripe…' : 'Finish Stripe Setup'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">Connect your Stripe account to receive monthly payouts.</p>
              <p className="text-xs text-zinc-500">Takes ~2 minutes. Stripe handles all banking info securely.</p>
              {connectError && (
                <p className="text-xs text-red-400">{connectError}</p>
              )}
              <button
                onClick={handleConnect}
                disabled={connectLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold text-black text-sm font-black hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                {connectLoading ? 'Opening Stripe…' : 'Connect Stripe for Payouts'}
              </button>
            </div>
          )}
        </div>

        {/* Tier ladder */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {[
            { name: 'Starter', range: '1–10 sales/mo', pct: '20%', active: tierPct === 20 },
            { name: 'Partner', range: '11–50 sales/mo', pct: '25%', active: tierPct === 25 },
            { name: 'Agency', range: '51+ sales/mo', pct: '30%', active: tierPct === 30 },
          ].map((t) => (
            <div
              key={t.name}
              className={`protocol-card p-5 ${t.active ? 'border-gold/40' : 'border-zinc-800 opacity-60'}`}
            >
              <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1">{t.name}</div>
              <div className="text-2xl font-black gold-text mb-1">{t.pct}</div>
              <div className="text-xs text-zinc-500">{t.range}</div>
              {t.active && <div className="mt-2 text-[10px] font-bold text-gold uppercase tracking-widest">Current tier</div>}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default function AffiliateDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading…</div>
      </div>
    }>
      <AffiliateDashboardInner />
    </Suspense>
  );
}
