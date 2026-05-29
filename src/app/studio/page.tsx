'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Download, ArrowRight, Zap, Shield, Lock, CheckCircle, QrCode } from 'lucide-react';

const VISUAL_MODES = [
  { id: 'static', label: 'Static', desc: 'Classic AI QR art for print & social. Max scan reliability.' },
  { id: 'stereographic', label: 'Stereographic', desc: 'Depth-layered with parallax effect.' },
  { id: 'holographic', label: 'Holographic', desc: 'Iridescent, light-reactive surface.' },
  { id: 'memory', label: 'Memory', desc: 'Time-evolving design that changes on revisit.' },
  { id: 'custom', label: 'Custom Prompt', desc: 'Full creative control over the AI generation.' },
];

export default function StudioPage() {
  const [url, setUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('static');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, prompt, mode }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data.imageUrl);
    } catch (err: any) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <QrCode className="w-6 h-6 text-yellow-400" />
          <span className="font-bold text-lg">QRON Studio</span>
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/gallery" className="text-white/60 hover:text-white">Gallery</Link>
          <Link href="/pricing" className="text-white/60 hover:text-white">Pricing</Link>
          <Link href="/dashboard" className="bg-yellow-400 text-black px-4 py-1.5 rounded-full font-semibold hover:bg-yellow-300">Dashboard</Link>
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-4 py-1.5 text-yellow-400 text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered QR Art</span>
          </div>
          <h1 className="text-5xl font-black mb-4">Create a QRON</h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Turn any URL into cryptographically signed AI art. Ed25519-sealed. Scannable everywhere. Ready in under 3 seconds.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Destination URL *</label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://yourproduct.com"
                  required
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">AI Style Prompt</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="golden luxury brand, deep black background, ornate filigree..."
                  rows={3}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-yellow-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">Visual Mode</label>
                <div className="grid grid-cols-1 gap-2">
                  {VISUAL_MODES.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`text-left px-4 py-3 rounded-xl border transition-all ${
                        mode === m.id
                          ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                          : 'border-white/10 text-white/60 hover:border-white/30'
                      }`}
                    >
                      <div className="font-medium text-sm">{m.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={generating || !url}
                className="w-full bg-yellow-400 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {generating ? (
                  <><div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="w-5 h-5" />Generate QRON &mdash; $5</>
                )}
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col">
            <h3 className="font-semibold text-white/80 mb-4">Preview</h3>

            {result ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <img src={result} alt="Generated QRON" className="max-w-full rounded-xl border border-white/20" />
                <a
                  href={result}
                  download="qron.png"
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl text-sm font-medium transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download High-Res PNG
                </a>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-red-400">
                  <div className="text-4xl mb-3">!</div>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-white/30">
                  <QrCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">Your QRON will appear here</p>
                  <p className="text-xs mt-1">Ed25519 signed &bull; Scan guaranteed</p>
                </div>
              </div>
            )}

            {/* Trust signals */}
            <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
              {[['<3s', 'Generation'], ['100%', 'Scan Rate'], ['Ed25519', 'Signed']].map(([val, label]) => (
                <div key={label}>
                  <div className="text-yellow-400 font-bold text-sm">{val}</div>
                  <div className="text-white/40 text-xs">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature strip */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Zap, title: 'Instant', desc: 'Under 3 seconds' },
            { icon: Shield, title: 'Authentic', desc: 'Ed25519 sealed' },
            { icon: CheckCircle, title: 'Guaranteed', desc: '100% scan rate' },
            { icon: Lock, title: 'Immutable', desc: 'Blockchain anchored' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Icon className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
              <div className="font-semibold text-sm">{title}</div>
              <div className="text-white/40 text-xs mt-1">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
