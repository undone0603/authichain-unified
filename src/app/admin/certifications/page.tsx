'use client';

import { useState, useEffect, Suspense, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Plus, 
  Loader2, 
  ExternalLink, 
  Ban,
  ShieldAlert,
  Clock,
  History
} from 'lucide-react';

interface Certification {
  id: string;
  serial_number: string;
  status: 'pending' | 'approved' | 'revoked';
  created_at: string;
  approved_at?: string;
  products: { name: string; manufacturer: string };
  product_id?: string;
}

function CertificationsContent() {
  const searchParams = useSearchParams();
  const filterProductId = searchParams.get('product_id');

  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCertifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/certifications');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (filterProductId) {
        setCertifications(data.filter((c: Certification) => c.product_id === filterProductId));
      } else {
        setCertifications(data);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [filterProductId]);

  useEffect(() => {
    startTransition(() => {
      fetchCertifications();
    });
  }, [fetchCertifications]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/certifications/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'admin' }),
      });
      if (!res.ok) throw new Error('Approval failed');
      await fetchCertifications();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (id: string) => {
    const reason = prompt('Enter revocation reason:');
    if (!reason) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/certifications/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked_by: 'admin', revocation_reason: reason }),
      });
      if (!res.ok) throw new Error('Revocation failed');
      await fetchCertifications();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  const statusIcons = {
    pending: <Clock className="w-3 h-3 text-yellow-500" />,
    approved: <ShieldCheck className="w-3 h-3 text-green-500" />,
    revoked: <ShieldAlert className="w-3 h-3 text-red-500" />,
  };

  const statusColors = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    approved: 'bg-green-500/10 text-green-500 border-green-500/20',
    revoked: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gold/10 border border-gold/20 rounded-2xl text-gold">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight uppercase">
                CERTIFICATION <span className="gold-text">LOCK</span>
              </h1>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                Blockchain Compliance Ledger
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/products" className="text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Assets
            </Link>
            <Link
              href="/admin/certifications/new"
              className="btn-gold px-8 py-3 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-gold"
            >
              <Plus className="w-4 h-4" />
              New Cert
            </Link>
          </div>
        </header>

        {error && (
          <div className="protocol-card p-6 bg-red-500/5 border-red-500/20 text-red-400 mb-8 font-bold text-sm uppercase">
            Protocol Error: {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-zinc-800" />
          </div>
        ) : certifications.length === 0 ? (
          <div className="protocol-card p-20 text-center border-zinc-900 bg-zinc-950/50">
            <History className="w-12 h-12 text-zinc-800 mx-auto mb-6" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm mb-8">No active certifications found</p>
            <Link href="/admin/certifications/new" className="text-gold font-black uppercase tracking-tighter hover:underline">
              Issue first certificate â†’
            </Link>
          </div>
        ) : (
          <div className="protocol-card overflow-hidden bg-zinc-950/30 border-zinc-900">
            <table className="w-full text-left">
              <thead className="bg-zinc-900/50 border-b border-zinc-800">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Serial Number</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Target Product</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Issued</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Ledger Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {certifications.map((cert) => (
                  <tr key={cert.id} className="group hover:bg-gold/[0.02] transition-colors">
                    <td className="px-8 py-6 font-mono text-xs text-gold font-bold">{cert.serial_number}</td>
                    <td className="px-8 py-6">
                      <div className="font-black text-white uppercase tracking-tight text-xs mb-0.5">{cert.products?.name}</div>
                      <div className="text-[10px] font-bold text-zinc-600 uppercase">{cert.products?.manufacturer}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${statusColors[cert.status]}`}>
                        {statusIcons[cert.status]}
                        {cert.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-zinc-500 font-bold uppercase text-[10px]">
                      {new Date(cert.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-3">
                        {cert.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(cert.id)}
                            disabled={actionLoading === cert.id}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest transition-colors disabled:opacity-50"
                          >
                            {actionLoading === cert.id ? '...' : 'Approve'}
                          </button>
                        )}
                        {cert.status === 'approved' && (
                          <>
                            <a
                              href={`/p/${cert.serial_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-colors"
                            >
                              Verify <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => handleRevoke(cert.id)}
                              disabled={actionLoading === cert.id}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest flex items-center gap-2 border border-red-500/20 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === cert.id ? '...' : <Ban className="w-3 h-3" />}
                            </button>
                          </>
                        )}
                        {cert.status === 'revoked' && (
                           <span className="text-[10px] font-black text-zinc-800 uppercase tracking-widest py-2">Archived</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminCertificationsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <CertificationsContent />
        </Suspense>
    );
}
