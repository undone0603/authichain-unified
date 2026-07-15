'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Code, 
  Zap, 
  Key, 
  Terminal, 
  ArrowLeft,
  ChevronRight,
  Database,
  Globe,
  Lock,
  Webhook
} from 'lucide-react';

export default function DeveloperDocs() {
  const [activeTab, setActiveTab] = useState('auth');

  const endpoints = [
    { id: 'auth', name: 'Authentication', icon: Key },
    { id: 'generate', name: 'Generation API', icon: Zap },
    { id: 'verify', name: 'Verification', icon: Shield },
    { id: 'webhooks', name: 'Webhooks', icon: Webhook },
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Documentation Header */}
      <div className="border-b border-zinc-900 bg-zinc-950/50 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gold/10 border border-gold/20 rounded-lg text-gold">
                <Code className="w-4 h-4" />
              </div>
              <h1 className="text-sm font-black uppercase tracking-widest">Protocol Hub <span className="text-zinc-600 ml-2">v1.4</span></h1>
            </div>
          </div>
          <div className="hidden md:flex gap-4">
             <Link href="/dashboard" className="btn-gold px-6 py-2 text-[10px] font-black uppercase tracking-widest">
                Get API Key
             </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-16">
        {/* Sidebar Nav */}
        <aside className="w-full lg:w-64 space-y-1">
          {endpoints.map((e) => (
            <button
              key={e.id}
              onClick={() => setActiveTab(e.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === e.id 
                ? 'bg-gold/10 text-gold border border-gold/20' 
                : 'text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <e.icon className="w-4 h-4" />
                {e.name}
              </div>
              <ChevronRight className={`w-3 h-3 transition-transform ${activeTab === e.id ? 'rotate-90' : ''}`} />
            </button>
          ))}
          
          <div className="pt-8 mt-8 border-t border-zinc-900">
            <h3 className="px-4 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4">Resources</h3>
            <ul className="space-y-4 px-4 text-[10px] font-black uppercase text-zinc-500">
                <li onClick={() => window.open('/api/test-routing')} className="hover:text-gold cursor-pointer flex items-center gap-2"><Globe className="w-3 h-3" /> API Health Status</li>
                <li className="text-zinc-700 flex items-center gap-2 cursor-not-allowed"><Terminal className="w-3 h-3" /> CLI (Coming Soon)</li>
                <li onClick={() => setActiveTab('auth')} className="hover:text-gold cursor-pointer flex items-center gap-2"><Lock className="w-3 h-3" /> Security Policy</li>
            </ul>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 max-w-3xl">
          {activeTab === 'auth' && (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight mb-4">Authentication</h2>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  AuthiChain uses industrial-grade **Ed25519** signature verification. 
                  Every API request must be signed with your private key or include your platform-issued API Key.
                </p>
              </div>

              <div className="protocol-card p-8 bg-zinc-950/50 border-zinc-900">
                <h3 className="text-xs font-black text-gold uppercase tracking-widest mb-6">Header Requirements</h3>
                <div className="bg-black rounded-lg p-6 font-mono text-[11px] leading-relaxed border border-zinc-900 text-zinc-300">
                  X-API-Key: YOUR_API_KEY
                  <br />
                  Content-Type: application/json
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-white">Rate Limits</h4>
                <p className="text-zinc-500 text-sm">
                  The protocol enforces a standard rate limit of **60 requests per minute** per user. 
                  Industrial-tier keys enjoy **5,000+ RPM** with high-throughput priority.
                </p>
              </div>
            </section>
          )}

          {activeTab === 'generate' && (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight mb-4 text-gold">Generation API</h2>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  The primary endpoint for creating cryptographically-signed QRON art and industrial identifiers.
                </p>
              </div>

              <div className="protocol-card overflow-hidden border-zinc-900 bg-zinc-950/50">
                <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="bg-green-500/20 text-green-500 px-2 py-1 rounded text-[10px] font-black uppercase">POST</span>
                        <code className="text-xs font-bold text-zinc-300">/api/v1/generate</code>
                    </div>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <h4 className="text-[10px] font-black text-zinc-600 uppercase mb-4 tracking-widest">Parameters</h4>
                        <table className="w-full text-xs">
                            <tbody>
                                <tr className="border-b border-zinc-900/50"><td className="py-3 font-bold text-zinc-300 w-1/3">url</td><td className="py-3 text-zinc-500">The destination URL for the QR.</td></tr>
                                <tr className="border-b border-zinc-900/50"><td className="py-3 font-bold text-zinc-300">prompt</td><td className="py-3 text-zinc-500">AI style guidance (e.g. &quot;Minimalist Tech&quot;).</td></tr>
                                <tr><td className="py-3 font-bold text-zinc-300">mode</td><td className="py-3 text-zinc-500">Protocol mode: &apos;standard&apos; or &apos;industrial&apos;.</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h4 className="text-[10px] font-black text-zinc-600 uppercase mb-4 tracking-widest">Example Request</h4>
                        <div className="bg-black rounded-lg p-6 font-mono text-[11px] border border-zinc-900 text-zinc-400">
                          <span className="text-zinc-600">curl</span> -X POST https://qron.space/api/v1/generate \
                          <br />&nbsp;&nbsp;-H <span className="text-gold">&quot;X-API-Key: ak_2j8k...&quot;</span> \
                          <br />&nbsp;&nbsp;-d &apos;&#123; 
                          <br />&nbsp;&nbsp;&nbsp;&nbsp;&quot;url&quot;: &quot;https://brand.com&quot;,
                          <br />&nbsp;&nbsp;&nbsp;&nbsp;&quot;prompt&quot;: &quot;Liquid metal texture&quot;,
                          <br />&nbsp;&nbsp;&nbsp;&nbsp;&quot;mode&quot;: &quot;industrial&quot;
                          <br />&nbsp;&nbsp;&#125;&apos;
                        </div>
                    </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'verify' && (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
               <div>
                <h2 className="text-3xl font-black uppercase tracking-tight mb-4">Verification</h2>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  Verify the authenticity and industrial provenance of any asset on the Polygon network.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="protocol-card p-6 bg-zinc-950">
                    <h4 className="text-xs font-black uppercase text-white mb-4">REST Lookup</h4>
                    <p className="text-zinc-600 text-[10px] mb-4 uppercase font-bold tracking-widest">GET /api/qron/scan-validate?serial=...</p>
                    <p className="text-xs text-zinc-500 leading-relaxed uppercase tracking-tighter">Returns full cryptographic metadata, owner details, and industrial certs.</p>
                </div>
                <div className="protocol-card p-6 bg-zinc-950">
                    <h4 className="text-xs font-black uppercase text-white mb-4">Public Resolver</h4>
                    <p className="text-zinc-600 text-[10px] mb-4 uppercase font-bold tracking-widest">URL: authichain.com/p/[serial]</p>
                    <p className="text-xs text-zinc-500 leading-relaxed uppercase tracking-tighter">The professional consumer-facing landing page for immediate proof-of-truth.</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'webhooks' && (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight mb-4 text-purple-400">Webhooks</h2>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  Real-time events pushed directly to your infrastructure. Never miss a scan or supply chain anomaly.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-zinc-900 rounded-xl text-zinc-500">
                        <Database className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm uppercase tracking-widest">Payload Structure</h4>
                        <p className="text-xs text-zinc-500 mt-2 uppercase tracking-tighter">Event payloads include geolocation, device signatures, and timestamped protocol anchors.</p>
                    </div>
                </div>

                <div className="protocol-card p-8 border-purple-500/10 bg-purple-500/[0.02]">
                    <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-4">Registering a Webhook</h4>
                    <p className="text-zinc-500 text-xs leading-relaxed uppercase tracking-tighter mb-6">
                        Webhooks can be registered via the API Key Manager in your dashboard. Support for 
                        &apos;qron_scanned&apos;, &apos;certification_approved&apos;, and &apos;security_anomaly&apos; events.
                    </p>
                    <Link href="/dashboard" className="text-[10px] font-black text-white hover:text-gold uppercase flex items-center gap-2">
                        Configure Webhooks <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Docs Footer */}
      <footer className="py-20 px-6 border-t border-zinc-900 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                AuthiChain Protocol &bull; Developer Ecosystem v1.4.2
            </p>
            <div className="flex gap-8 text-[10px] font-black uppercase text-zinc-500">
                <Link href="/terms" className="hover:text-gold">API Terms</Link>
                <Link href="/privacy" className="hover:text-gold">Security</Link>
                <span className="text-zinc-800">|</span>
                <span className="text-zinc-600">Built for the visual internet</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
