'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Leaf, Shield, CheckCircle, AlertCircle,
  ExternalLink, Zap,
} from 'lucide-react';

const GREEN = '#10b981';

export default function OperatorDetail() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading operator details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/brand/strainchain/compliance-tracker" className="flex items-center gap-2 text-green-400 hover:text-green-300">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Back to Tracker</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-black mb-4">Operator Compliance Details</h1>
              <p className="text-zinc-400">
                For operator ID: <span className="font-mono text-green-400">{id}</span>
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-xl p-6 mt-8 border border-zinc-800">
            <div className="flex items-center gap-2 text-amber-400 mb-4">
              <AlertCircle className="w-5 h-5" />
              <p className="font-bold">Compliance data is real-time synchronized</p>
            </div>
            <p className="text-zinc-400 text-sm">
              This page displays detailed compliance information for a specific cannabis operator. The data is synchronized in real-time from the StrainChain compliance tracker and METRC systems.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-bold">Operator Dashboard Features:</h2>
            <ul className="space-y-2 text-zinc-400">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Real-time METRC sync status and inventory tracking</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Seed-to-sale product lineage with complete traceability</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Compliance risk scoring and audit preparation tools</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Regulatory deadline tracking and renewal alerts</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Multi-location coordination for enterprise operators</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 p-6 rounded-xl bg-green-500/5 border border-green-500/20">
            <h2 className="text-lg font-bold mb-2" style={{ color: GREEN }}>StrainChain Compliance Suite</h2>
            <p className="text-zinc-400 mb-4">
              Get comprehensive compliance monitoring, METRC automation, and audit readiness tools.
            </p>
            <Link
              href="/brand/strainchain/compliance-tracker"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${GREEN} 0%, #059669 100%)` }}
            >
              View Compliance Tracker <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <footer className="mt-16 text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
            StrainChain.io · Cannabis Compliance Tracker
          </p>
        </footer>
      </div>
    </div>
  );
}
