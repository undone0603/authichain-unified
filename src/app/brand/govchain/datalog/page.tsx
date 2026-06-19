'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Filter, Search, TrendingUp, Calendar, MapPin, DollarSign,
  ExternalLink, ChevronDown, Clock, CheckCircle, AlertCircle,
  FileText, Building2, Target, Zap,
} from 'lucide-react';

const BLUE = '#3b82f6';
const GREEN = '#10b981';
const AMBER = '#f59e0b';

interface GovOpportunity {
  id: string;
  title: string;
  agency: string;
  level: 'federal' | 'state' | 'local';
  type: 'rfp' | 'grant' | 'contract' | 'loan' | 'initiative';
  fundingAmount?: number;
  deadline?: string;
  description: string;
  tags: string[];
  status: 'active' | 'closing_soon' | 'closed' | 'published';
  samNoticeId?: string;
  cfda?: string;
  source: string;
  createdAt: string;
}

export default function GovChainDatalog() {
  const [opportunities, setOpportunities] = useState<GovOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'federal' | 'state' | 'local'>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'rfp' | 'grant' | 'contract' | 'loan' | 'initiative'>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'funding' | 'recent'>('deadline');

  useEffect(() => {
    fetchOpportunities();
    const interval = setInterval(fetchOpportunities, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchOpportunities = async () => {
    try {
      const res = await fetch('/api/govchain/opportunities');
      const data = await res.json();
      setOpportunities(data.opportunities || []);
    } catch (err) {
      console.error('Failed to fetch opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOpportunities = opportunities
    .filter(opp => {
      const matchesSearch = searchTerm === '' ||
        opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.agency.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesLevel = selectedLevel === 'all' || opp.level === selectedLevel;
      const matchesType = selectedType === 'all' || opp.type === selectedType;

      return matchesSearch && matchesLevel && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'deadline') {
        if (!a.deadline || !b.deadline) return 0;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === 'funding') {
        return (b.fundingAmount || 0) - (a.fundingAmount || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const stats = {
    total: opportunities.length,
    federal: opportunities.filter(o => o.level === 'federal').length,
    state: opportunities.filter(o => o.level === 'state').length,
    local: opportunities.filter(o => o.level === 'local').length,
    totalFunding: opportunities.reduce((sum, o) => sum + (o.fundingAmount || 0), 0),
    closingSoon: opportunities.filter(o => o.status === 'closing_soon').length,
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      rfp: FileText,
      grant: Target,
      contract: FileText,
      loan: DollarSign,
      initiative: Zap,
    };
    return icons[type as keyof typeof icons] || FileText;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: { bg: `${GREEN}15`, border: `${GREEN}30`, text: GREEN, label: 'Active' },
      closing_soon: { bg: `${AMBER}15`, border: `${AMBER}30`, text: AMBER, label: 'Closing Soon' },
      closed: { bg: '#64748b15', border: '#64748b30', text: '#64748b', label: 'Closed' },
      published: { bg: `${BLUE}15`, border: `${BLUE}30`, text: BLUE, label: 'Published' },
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getLevelLabel = (level: string) => {
    const labels = { federal: 'Federal', state: 'State', local: 'Local' };
    return labels[level as keyof typeof labels] || level;
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'Not specified';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const daysUntil = (deadline?: string) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return null;
    return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/brand/govchain" className="flex items-center gap-3">
            <FileText className="w-6 h-6" style={{ color: BLUE }} />
            <span className="font-black text-xl">GovChain Datalog</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-zinc-500">Live Updates Every Minute</span>
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
            Federal & State Opportunities
          </h1>
          <p className="text-zinc-400 text-lg mb-8">
            Transparent, real-time datalog of government contracts, grants, and initiatives powered by SAM.gov and state agency APIs.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black" style={{ color: BLUE }}>{stats.total.toLocaleString()}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Total Opportunities</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black">{stats.federal}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Federal</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black">{stats.state}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">State</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black">{stats.local}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Local</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-lg font-black text-green-400">${(stats.totalFunding / 1e9).toFixed(1)}B</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Total Funding</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black" style={{ color: AMBER }}>{stats.closingSoon}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Closing Soon</div>
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
                placeholder="Search opportunities, agencies, keywords..."
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
              <option value="deadline">Sort: Deadline</option>
              <option value="funding">Sort: Funding Amount</option>
              <option value="recent">Sort: Recently Posted</option>
            </select>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">Level:</span>
            </div>
            {(['all', 'federal', 'state', 'local'] as const).map(level => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedLevel === level
                    ? 'bg-blue-500 text-white border border-blue-400'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {level === 'all' ? 'All Levels' : getLevelLabel(level)}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-4">
              <FileText className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">Type:</span>
            </div>
            {(['all', 'rfp', 'grant', 'contract', 'loan', 'initiative'] as const).map(type => (
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
          </div>
        </div>

        {/* Opportunities List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-500 mt-4 text-sm">Loading opportunities...</p>
              </div>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-zinc-800 bg-zinc-950/40">
              <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold">No opportunities match your filters</p>
              <p className="text-zinc-600 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredOpportunities.map(opp => {
              const statusColor = getStatusColor(opp.status);
              const TypeIcon = getTypeIcon(opp.type);
              const daysLeft = daysUntil(opp.deadline);

              return (
                <div
                  key={opp.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 hover:border-zinc-700 transition-all hover:bg-zinc-950/60"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${statusColor.text}15`, border: `1px solid ${statusColor.border}` }}>
                        <TypeIcon className="w-5 h-5" style={{ color: statusColor.text }} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-2 line-clamp-2">{opp.title}</h3>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-zinc-600" />
                            <span className="text-sm font-bold text-zinc-400">{opp.agency}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase text-zinc-600">•</span>
                          <span className="text-sm font-bold text-zinc-400">{getLevelLabel(opp.level)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
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
                    </div>
                  </div>

                  <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{opp.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 py-4 border-y border-zinc-800">
                    {opp.fundingAmount && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-zinc-600">Funding</span>
                        <p className="font-bold text-green-400">{formatCurrency(opp.fundingAmount)}</p>
                      </div>
                    )}
                    {opp.deadline && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-zinc-600">Deadline</span>
                        <div className="font-bold flex items-center gap-2 mt-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(opp.deadline).toLocaleDateString()}</span>
                        </div>
                        {daysLeft && (
                          <p className={`text-xs font-bold mt-1 ${
                            parseInt(daysLeft) <= 7 ? 'text-amber-400' : 'text-zinc-500'
                          }`}>
                            {daysLeft}
                          </p>
                        )}
                      </div>
                    )}
                    {opp.samNoticeId && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-zinc-600">SAM ID</span>
                        <p className="font-mono text-xs mt-1 text-blue-400">{opp.samNoticeId}</p>
                      </div>
                    )}
                    {opp.cfda && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-zinc-600">CFDA</span>
                        <p className="font-mono text-xs mt-1 text-blue-400">{opp.cfda}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {opp.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 rounded-lg bg-zinc-900 text-[10px] font-bold text-zinc-400 uppercase">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Link
                      href={`/brand/govchain/opportunity/${opp.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 transition-colors text-blue-400 font-bold text-sm"
                    >
                      View Details <ExternalLink className="w-4 h-4" />
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
            <h2 className="text-2xl font-black mb-4">Transparent Government Data</h2>
            <p className="text-zinc-400 mb-4 leading-relaxed">
              GovChain operates with complete transparency into federal and state government opportunities. All data displayed here is sourced from:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-3 text-zinc-400">
                <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
                <span><strong>SAM.gov API:</strong> Real-time federal contract opportunities and funding announcements</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
                <span><strong>State Agency Feeds:</strong> Individual state RFP portals, grant databases, and procurement systems</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
                <span><strong>CFDA Database:</strong> Catalog of Federal Domestic Assistance programs and grant eligibility</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
                <span><strong>SBA Programs:</strong> Small Business Administration disaster loans, grants, and contracting opportunities</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4">How GovChain Helps You Win</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}30` }}>
                  <Target className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <h3 className="font-bold mb-2">Opportunity Matching</h3>
                <p className="text-xs text-zinc-500">AI-powered matching finds opportunities aligned with your capabilities and past performance</p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${GREEN}15`, border: `1px solid ${GREEN}30` }}>
                  <Zap className="w-5 h-5" style={{ color: GREEN }} />
                </div>
                <h3 className="font-bold mb-2">Proposal Automation</h3>
                <p className="text-xs text-zinc-500">Auto-generate proposal templates and compliance documentation with your company details pre-filled</p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${AMBER}15`, border: `1px solid ${AMBER}30` }}>
                  <Clock className="w-5 h-5" style={{ color: AMBER }} />
                </div>
                <h3 className="font-bold mb-2">Deadline Alerts</h3>
                <p className="text-xs text-zinc-500">Real-time notifications for opportunities matching your profile with deadline reminders</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-16 text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
            GovChain.us · Transparent Government Data · Last Updated: {new Date().toLocaleString()}
          </p>
        </footer>
      </div>
    </div>
  );
}
