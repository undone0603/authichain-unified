'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Filter, Search, TrendingUp, Calendar, Leaf, AlertCircle,
  ExternalLink, ChevronDown, Clock, CheckCircle, BarChart3,
  Shield, Zap, Target,
} from 'lucide-react';

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';

interface ComplianceRecord {
  id: string;
  cultivatorName: string;
  state: string;
  licenseNumber: string;
  licenseType: 'cultivator' | 'processor' | 'retailer' | 'microbusiness';
  status: 'active' | 'pending' | 'suspended' | 'expired';
  metrcStatus: 'connected' | 'syncing' | 'error' | 'not_connected';
  seedToSaleProgress: number; // 0-100
  complianceScore: number; // 0-100
  lastAudit?: string;
  nextAuditDue?: string;
  trackedProducts: number;
  seedLineages: number;
  tags: string[];
  source: string;
  updatedAt: string;
}

export default function StrainChainComplianceTracker() {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'cultivator' | 'processor' | 'retailer' | 'microbusiness'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'pending' | 'suspended' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'compliance' | 'recent' | 'progress'>('compliance');

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 120000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/strainchain/compliance');
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error('Failed to fetch compliance records:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records
    .filter(rec => {
      const matchesSearch = searchTerm === '' ||
        rec.cultivatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesState = selectedState === 'all' || rec.state === selectedState;
      const matchesType = selectedType === 'all' || rec.licenseType === selectedType;
      const matchesStatus = selectedStatus === 'all' || rec.status === selectedStatus;

      return matchesSearch && matchesState && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'compliance') return b.complianceScore - a.complianceScore;
      if (sortBy === 'progress') return b.seedToSaleProgress - a.seedToSaleProgress;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const stats = {
    total: records.length,
    active: records.filter(r => r.status === 'active').length,
    metrcConnected: records.filter(r => r.metrcStatus === 'connected').length,
    avgCompliance: records.length > 0
      ? (records.reduce((sum, r) => sum + r.complianceScore, 0) / records.length).toFixed(1)
      : 0,
    avgProgress: records.length > 0
      ? (records.reduce((sum, r) => sum + r.seedToSaleProgress, 0) / records.length).toFixed(1)
      : 0,
  };

  const states = ['Michigan', 'California', 'Colorado', 'Oregon', 'Washington', 'Massachusetts'];

  const getMetrcStatusColor = (status: string) => {
    const colors = {
      connected: { bg: `${GREEN}15`, border: `${GREEN}30`, text: GREEN, label: '✓ Connected' },
      syncing: { bg: `${BLUE}15`, border: `${BLUE}30`, text: BLUE, label: '↻ Syncing' },
      error: { bg: `${AMBER}15`, border: `${AMBER}30`, text: AMBER, label: '⚠ Error' },
      not_connected: { bg: '#64748b15', border: '#64748b30', text: '#64748b', label: 'Not Connected' },
    };
    return colors[status as keyof typeof colors] || colors.not_connected;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: { bg: `${GREEN}15`, border: `${GREEN}30`, text: GREEN, label: 'Active' },
      pending: { bg: `${BLUE}15`, border: `${BLUE}30`, text: BLUE, label: 'Pending' },
      suspended: { bg: `${AMBER}15`, border: `${AMBER}30`, text: AMBER, label: 'Suspended' },
      expired: { bg: '#64748b15', border: '#64748b30', text: '#64748b', label: 'Expired' },
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/brand/strainchain" className="flex items-center gap-3">
            <Leaf className="w-6 h-6" style={{ color: GREEN }} />
            <span className="font-black text-xl">StrainChain Compliance Tracker</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-zinc-500">Live METRC Sync</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
              <span className="text-xs font-bold" style={{ color: GREEN }}>Live</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Stats */}
        <div className="mb-12">
          <h1 className="text-5xl font-black mb-4 tracking-tighter">
            Cannabis Compliance & Tracking
          </h1>
          <p className="text-zinc-400 text-lg mb-8">
            Real-time compliance monitoring and seed-to-sale tracking for cultivators, processors, and retailers across regulated markets.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black" style={{ color: GREEN }}>{stats.total}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Total Operators</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black">{stats.active}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Active Licenses</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black" style={{ color: GREEN }}>{stats.metrcConnected}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">METRC Connected</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black text-blue-400">{stats.avgCompliance}%</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Avg Compliance</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black text-amber-400">{stats.avgProgress}%</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Tracking Progress</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Search by business name or license number..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="compliance">Sort: Compliance Score</option>
              <option value="progress">Sort: Tracking Progress</option>
              <option value="recent">Sort: Recently Updated</option>
            </select>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">State:</span>
            </div>
            {(['all', ...states] as const).map(state => (
              <button
                key={state}
                onClick={() => setSelectedState(state)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedState === state
                    ? 'bg-blue-500 text-white border border-blue-400'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {state === 'all' ? 'All States' : state}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-4">
              <Leaf className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">Type:</span>
            </div>
            {(['all', 'cultivator', 'processor', 'retailer', 'microbusiness'] as const).map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedType === type
                    ? 'bg-blue-500 text-white border border-blue-400'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {type === 'all' ? 'All Types' : type}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-4">
              <Shield className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">Status:</span>
            </div>
            {(['all', 'active', 'pending', 'suspended', 'expired'] as const).map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedStatus === status
                    ? 'bg-blue-500 text-white border border-blue-400'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {status === 'all' ? 'All Statuses' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Compliance Records */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-500 mt-4 text-sm">Loading compliance records...</p>
              </div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-zinc-800 bg-zinc-950/40">
              <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold">No records match your filters</p>
              <p className="text-zinc-600 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredRecords.map(rec => {
              const statusColor = getStatusColor(rec.status);
              const metrcColor = getMetrcStatusColor(rec.metrcStatus);

              return (
                <div
                  key={rec.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 hover:border-zinc-700 transition-all hover:bg-zinc-950/60"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-2">{rec.cultivatorName}</h3>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-bold text-zinc-400">{rec.state}</span>
                        <span className="text-[10px] font-bold uppercase text-zinc-600">•</span>
                        <span className="text-xs font-mono text-blue-400">{rec.licenseNumber}</span>
                        <span className="text-[10px] font-bold uppercase text-zinc-600">•</span>
                        <span className="text-sm font-bold text-zinc-400 capitalize">{rec.licenseType}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase border"
                        style={{
                          background: statusColor.bg,
                          borderColor: statusColor.border,
                          color: statusColor.text,
                        }}
                      >
                        {statusColor.label}
                      </span>
                      <span
                        className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase border"
                        style={{
                          background: metrcColor.bg,
                          borderColor: metrcColor.border,
                          color: metrcColor.text,
                        }}
                      >
                        {metrcColor.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 py-4 border-y border-zinc-800">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-600">Compliance Score</span>
                      <div className="mt-2">
                        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${rec.complianceScore}%`,
                              background: rec.complianceScore >= 80 ? GREEN : rec.complianceScore >= 60 ? AMBER : '#ef4444',
                            }}
                          />
                        </div>
                        <p className="text-xs font-bold mt-1" style={{ color: rec.complianceScore >= 80 ? GREEN : rec.complianceScore >= 60 ? AMBER : '#ef4444' }}>
                          {rec.complianceScore}%
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-600">Seed-to-Sale Progress</span>
                      <div className="mt-2">
                        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${rec.seedToSaleProgress}%`, background: GREEN }}
                          />
                        </div>
                        <p className="text-xs font-bold mt-1" style={{ color: GREEN }}>
                          {rec.seedToSaleProgress}%
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-600">Products Tracked</span>
                      <p className="font-bold text-lg mt-2">{rec.trackedProducts}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-600">Seed Lineages</span>
                      <p className="font-bold text-lg mt-2">{rec.seedLineages}</p>
                    </div>
                    {rec.nextAuditDue && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-zinc-600">Next Audit</span>
                        <p className="font-bold text-sm mt-2">{new Date(rec.nextAuditDue).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {rec.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 rounded-lg bg-zinc-900 text-[10px] font-bold text-zinc-400 uppercase">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Link
                      href={`/brand/strainchain/operator/${rec.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 transition-colors text-blue-400 font-bold text-sm"
                    >
                      Details <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Info Section */}
        <div className="mt-16 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4">StrainChain Compliance Platform</h2>
            <p className="text-zinc-400 mb-4 leading-relaxed">
              StrainChain provides real-time compliance monitoring and seed-to-sale tracking for cannabis operators across regulated jurisdictions.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-3 text-zinc-400">
                <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
                <span><strong>METRC Integration:</strong> Direct integration with state METRC systems for real-time tracking updates</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
                <span><strong>Seed-to-Sale Visibility:</strong> Complete product lineage tracking from cultivation through retail</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
                <span><strong>Compliance Scoring:</strong> AI-powered audit preparation and compliance risk assessment</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
                <span><strong>Multi-State Support:</strong> Licensed operators across Michigan, California, Colorado, Oregon, and more</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4">How StrainChain Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${GREEN}15`, border: `1px solid ${GREEN}30` }}>
                  <Shield className="w-5 h-5" style={{ color: GREEN }} />
                </div>
                <h3 className="font-bold mb-2">Compliance Monitoring</h3>
                <p className="text-xs text-zinc-500">Real-time tracking of regulatory requirements and audit readiness</p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}30` }}>
                  <Zap className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <h3 className="font-bold mb-2">METRC Automation</h3>
                <p className="text-xs text-zinc-500">Auto-sync with state tracking systems for accurate inventory management</p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${AMBER}15`, border: `1px solid ${AMBER}30` }}>
                  <Target className="w-5 h-5" style={{ color: AMBER }} />
                </div>
                <h3 className="font-bold mb-2">Supply Chain Visibility</h3>
                <p className="text-xs text-zinc-500">Track products from seed/cultivation through final retail sale</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-16 text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
            StrainChain.io · Cannabis Compliance Tracker · Last Updated: {new Date().toLocaleString()}
          </p>
        </footer>
      </div>
    </div>
  );
}
