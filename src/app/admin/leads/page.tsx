'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { 
  Users, 
  ArrowLeft, 
  Search, 
  Mail, 
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Target
} from 'lucide-react';

interface Lead {
  id: string;
  email: string;
  status: string;
  product_interest: string;
  score?: number;
  created_at: string;
}

export default function LeadCRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', source: '' });
  const [search, setSearch] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.source) params.append('source', filter.source);
      
      const res = await fetch(`/api/admin/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data || []);
    } catch (_err) {
      console.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    startTransition(() => {
      fetchLeads();
    });
  }, [fetchLeads]);

  const filteredLeads = leads.filter(l => 
    l.email.toLowerCase().includes(search.toLowerCase())
  );

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) fetchLeads();
    } catch (err) {
      console.error('Failed to update lead', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'contacted': return <Clock className="w-3 h-3 text-blue-400" />;
      default: return <AlertCircle className="w-3 h-3 text-zinc-500" />;
    }
  };

  const getBrandColor = (brand: string) => {
    switch (brand?.toLowerCase()) {
      case 'govchain': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'strainchain': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'authichain': return 'text-gold bg-gold/10 border-gold/20';
      default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Lead Intelligence</h1>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Cross-Domain CRM Dashboard</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input 
                type="text" 
                placeholder="Search leads..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-gold outline-none transition-colors"
              />
            </div>
            <select 
              value={filter.source}
              onChange={(e) => setFilter({ ...filter, source: e.target.value })}
              className="bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none focus:border-gold appearance-none"
            >
              <option value="">All Domains</option>
              <option value="qron">QRON.space</option>
              <option value="authichain">AuthiChain.com</option>
              <option value="govchain">GovChain.us</option>
              <option value="strainchain">StrainChain.io</option>
            </select>
          </div>
        </header>

        <div className="protocol-card overflow-hidden bg-zinc-950/50 border-zinc-900">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-900/30">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subscriber</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Entry Domain</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Captured</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gold mx-auto mb-4" />
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Syncing lead database...</p>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                    <td colSpan={5} className="py-20 text-center">
                        <Users className="w-8 h-8 text-zinc-800 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">No leads found.</p>
                    </td>
                </tr>
              ) : (
                filteredLeads.map((l) => (
                  <tr key={l.id} className="group hover:bg-zinc-900/20 transition-colors">
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-black text-zinc-500 border border-zinc-800">
                          {l.email.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{l.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Target className="w-3 h-3 text-zinc-700" />
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">Score: {l.score || 0}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase border ${getBrandColor(l.product_interest)}`}>
                        {l.product_interest || 'Ecosystem'}
                      </span>
                    </td>
                    <td className="px-6 py-6">
                        <div className="flex items-center gap-2">
                            {getStatusIcon(l.status)}
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{l.status}</span>
                        </div>
                    </td>
                    <td className="px-6 py-6 text-zinc-600 text-[10px] font-bold uppercase">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-6 text-right">
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => updateStatus(l.id, 'contacted')}
                                className="p-2 hover:bg-blue-500/10 hover:text-blue-400 text-zinc-700 rounded-lg transition-all"
                                title="Mark Contacted"
                            >
                                <Mail className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => updateStatus(l.id, 'converted')}
                                className="p-2 hover:bg-green-500/10 hover:text-green-400 text-zinc-700 rounded-lg transition-all"
                                title="Mark Converted"
                            >
                                <CheckCircle className="w-4 h-4" />
                            </button>
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
