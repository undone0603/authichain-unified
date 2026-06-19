'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Building2, Calendar, DollarSign, FileText, ExternalLink,
  Share2, Copy, CheckCircle, AlertCircle,
} from 'lucide-react';

const BLUE = '#3b82f6';

interface Opportunity {
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

export default function OpportunityDetail() {
  const params = useParams();
  const id = params.id as string;
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // In a real implementation, this would fetch from the API
    // For now, we'll show a placeholder
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading opportunity details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/brand/govchain/datalog" className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Back to Datalog</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-black mb-4">Opportunity Details</h1>
              <p className="text-zinc-400">
                For a specific opportunity ID: <span className="font-mono text-blue-400">{id}</span>
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-xl p-6 mt-8 border border-zinc-800">
            <div className="flex items-center gap-2 text-amber-400 mb-4">
              <AlertCircle className="w-5 h-5" />
              <p className="font-bold">Opportunity data is real-time populated</p>
            </div>
            <p className="text-zinc-400 text-sm">
              This page displays detailed information about a specific government opportunity. The data is fetched from the public GovChain datalog and updated in real-time as new opportunities are ingested from SAM.gov and state/local RFP portals.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-bold">What You'll Find Here:</h2>
            <ul className="space-y-2 text-zinc-400">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Complete opportunity details including funding amount, deadline, and requirements</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Direct links to the official RFP or SAM.gov listing</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>GovChain's AI-powered match score for your company</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>One-click proposal drafting and submission tracking</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Compliance and eligibility assessment</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 p-6 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <h2 className="text-lg font-bold mb-2" style={{ color: BLUE }}>Get Started with GovChain</h2>
            <p className="text-zinc-400 mb-4">
              To view and respond to this opportunity, sign up for GovChain and create your company profile.
            </p>
            <Link
              href="/governance"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1e40af 100%)` }}
            >
              Get Started <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <footer className="mt-16 text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
            GovChain.us · Transparent Government Data
          </p>
        </footer>
      </div>
    </div>
  );
}
