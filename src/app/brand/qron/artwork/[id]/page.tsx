'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Sparkles, Download, Copy, Share2, CheckCircle,
  ExternalLink, AlertCircle,
} from 'lucide-react';

const PURPLE = '#8b5cf6';

export default function ArtworkDetail() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading artwork details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/brand/qron/gallery" className="flex items-center gap-2 text-purple-400 hover:text-purple-300">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Back to Gallery</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Artwork Preview */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
            <div
              className="h-96 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10" />
              <Sparkles className="w-20 h-20 text-zinc-600" />
            </div>
            <div className="p-6">
              <h1 className="text-3xl font-black mb-4">Artwork Customizer</h1>
              <p className="text-zinc-400 mb-6">
                Download, customize, and integrate this QRON QR art into your campaigns.
              </p>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-white" style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, #7c3aed 100%)` }}>
                  <Download className="w-5 h-5" />
                  Download (SVG / PNG)
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-purple-500/30 hover:bg-purple-500/10 transition-colors text-purple-400 font-bold">
                  <Copy className="w-5 h-5" />
                  Copy QR Code URL
                </button>
              </div>
            </div>
          </div>

          {/* Details & Analytics */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <h2 className="text-xl font-bold mb-4">Details</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Artwork ID</span>
                  <span className="font-mono text-purple-400">{id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Style</span>
                  <span>Abstract</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Category</span>
                  <span>Marketing</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Creator</span>
                  <span>QRON Studio</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <h2 className="text-xl font-bold mb-4">Analytics</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-bold">Scans</span>
                    <span className="font-black text-pink-400">1,247</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full w-3/4 rounded-full bg-pink-400" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-bold">Views</span>
                    <span className="font-black text-blue-400">8,932</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full w-full rounded-full bg-blue-400" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-bold">Shares</span>
                    <span className="font-black text-purple-400">342</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-purple-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
          <h2 className="text-2xl font-black mb-4">How to Use QRON</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${PURPLE}15`, border: `1px solid ${PURPLE}30` }}>
                <Download className="w-5 h-5" style={{ color: PURPLE }} />
              </div>
              <h3 className="font-bold mb-2">1. Download</h3>
              <p className="text-xs text-zinc-500">Download the QRON artwork in SVG or PNG format optimized for print or digital</p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${PURPLE}15`, border: `1px solid ${PURPLE}30` }}>
                <Sparkles className="w-5 h-5" style={{ color: PURPLE }} />
              </div>
              <h3 className="font-bold mb-2">2. Customize</h3>
              <p className="text-xs text-zinc-500">Adjust colors, sizing, and branding to match your campaign needs</p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${PURPLE}15`, border: `1px solid ${PURPLE}30` }}>
                <Share2 className="w-5 h-5" style={{ color: PURPLE }} />
              </div>
              <h3 className="font-bold mb-2">3. Deploy</h3>
              <p className="text-xs text-zinc-500">Use on packaging, marketing materials, or digital campaigns. Track scans in real-time</p>
            </div>
          </div>
        </div>

        <footer className="mt-16 text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
            QRON.space · AI QR Art Studio
          </p>
        </footer>
      </div>
    </div>
  );
}
