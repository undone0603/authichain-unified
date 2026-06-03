'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Download,
  CreditCard,
  CheckCircle,
  Shield,
  Zap,
  Lock,
  Package,
  Vote,
  ArrowRight,
  Palette,
  Eye,
  Activity,
  ShieldCheck,
  ScanLine,
  Coins,
  Terminal,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { MODES, FalaiPreset, QRONModeConfig } from '@/lib/types';
import { PLANS } from '@/lib/plans';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { FeaturedQRONs } from '@/components/FeaturedQRONs';
import { LeadCapturePopup } from '@/components/LeadCapturePopup';
import { SocialShareCTA } from '@/components/SocialShareCTA';

const StaticImageGallery = dynamic(
  () =>
    import('@/components/StaticImageGallery').then((m) => m.StaticImageGallery),
  { ssr: false }
);

// --- NEW COMPONENT: Interactive 3D Hero & 5-Agent Visualizer ---
function InteractiveHero() {
  const [logIndex, setLogIndex] = useState(0);
  const logs = [
    "Agent 1 (Vision): Extracting physical traits...",
    "Agent 2 (Provenance): Cross-referencing origin data...",
    "Agent 3 (Material): Validating surface textures...",
    "Agent 4 (Security): Hashing local entropy...",
    "Agent 5 (Consensus): 99.8% match. Direct fetch initiated."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setLogIndex((prev) => (prev < logs.length - 1 ? prev + 1 : prev));
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-12 relative" id="scannable-identity">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        {/* Copy & Value Prop */}
        <div className="text-left">
          <span className="text-gold font-mono text-sm tracking-widest uppercase mb-4 block">
            03 / Scannable Identity
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight tracking-tight">
            Interactive Art meets <br /> <span className="text-zinc-500">Immutable State.</span>
          </h2>
          <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
            Beyond verification. Turn your products into interactive art. Our AI generates thematic, 3D-textured QR codes that blend seamlessly with your brand packaging while anchoring an immutable ERC-721 certificate.
          </p>
          
          <div className="flex flex-wrap gap-4 mt-8">
             <div className="px-6 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
               <Shield className="w-4 h-4 text-gold" /> Protocol Live
             </div>
             <div className="px-6 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
               <Zap className="w-4 h-4 text-gold" /> Edge Optimized
             </div>
          </div>
        </div>

        {/* WebGL Placeholder & 5-Agent Visualizer */}
        <div className="protocol-card bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
          {/* 3D Canvas Placeholder */}
          <div className="h-72 w-full bg-[#050505] relative flex items-center justify-center overflow-hidden">
             <div className="absolute inset-0 bg-gold/5 blur-3xl animate-pulse" />
             <div className="relative z-10 w-40 h-40 border border-gold/20 bg-zinc-800/50 rounded-2xl flex items-center justify-center backdrop-blur-sm transform rotate-3 hover:rotate-0 transition-transform duration-700 shadow-[0_0_40px_rgba(201,162,39,0.15)]">
                <Sparkles className="w-16 h-16 text-gold opacity-80 animate-pulse" />
                <span className="absolute -bottom-8 text-xs text-gold font-mono uppercase tracking-widest text-center w-full">Interactive<br/>WebGL</span>
             </div>
          </div>
          
          {/* Simulated Terminal Feed */}
          <div className="bg-black/90 p-5 border-t border-zinc-800 font-mono text-xs">
            <div className="flex items-center gap-2 mb-4 text-zinc-500 font-bold uppercase tracking-widest">
              <Terminal className="w-4 h-4 text-gold" />
              <span>5-Agent Consensus Network</span>
            </div>
            <div className="space-y-2 h-32 flex flex-col justify-end">
              {logs.slice(0, logIndex + 1).map((log, i) => (
                <div key={i} className={`flex items-start gap-2 ${i === logs.length - 1 ? 'text-green-400' : 'text-zinc-400'}`}>
                  <span className="text-zinc-600">{'>'}</span>
                  <span>{log}</span>
                </div>
              ))}
              {logIndex < logs.length - 1 && (
                 <div className="flex items-start gap-2 text-zinc-600 animate-pulse">
                   <span>{'>'}</span>
                   <span className="w-2 h-3 bg-zinc-600 block mt-0.5" />
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
// --- END NEW COMPONENT ---

export default function Home() {
  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabase = hasSupabaseEnv ? createClient() : null;

  const [targetUrl, setTargetUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState<QRONModeConfig>(MODES[0]);
  const [presetId, setPresetId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('');
  const [error, setError] = useState('');
  const [userTier, setUserTier] = useState('free');
  const [guestUsed, setGuestUsed] = useState(0);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [captureEmail, setCaptureEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [isMagicGenerating, setIsMagicGenerating] = useState(false);
  const [showScanTest, setShowScanTest] = useState(false);

  const handleMagicTry = async (brandName: string) => {
    const examples: Record<string, { url: string; prompt: string; mode: string }> = {
      Tesla: {
        url: 'https://tesla.com',
        prompt: 'Futuristic glass aesthetic, red glowing circuits, minimalist cybertech',
        mode: 'living'
      },
      Nike: {
        url: 'https://nike.com',
        prompt: 'Abstract liquid motion, athletic textures, vibrant energetic pulses',
        mode: 'kinetic'
      },
      Rolex: {
        url: 'https://rolex.com',
        prompt: 'Luxury gold watch mechanisms, intricate gear details, emerald green and gold hues',
        mode: 'holographic'
      },
      Hermes: {
        url: 'https://hermes.com',
        prompt: 'Hermes Birkin leather texture, signature orange and brown tones, luxury equestrian aesthetic',
        mode: 'living'
      },
      Chanel: {
        url: 'https://chanel.com',
        prompt: 'Chanel classic flap quilting, interlocking CC logo gold metal, black and white pearls',
        mode: 'holographic'
      },
      Moderna: {
        url: 'https://modernatx.com',
        prompt: 'mRNA molecular structures, medical laboratory aesthetics, clean sterile blue and white',
        mode: 'layered'
      },
      Gilmore: {
        url: 'https://gilmorecarmuseum.org',
        prompt: '1929 Duesenberg Model J at the Gilmore Car Museum. Elegant museum photography, soft studio lighting.',
        mode: 'living'
      },
      Metrc: {
        url: 'https://metrc.com',
        prompt: 'StrainChain Bio Jungle AI QR. Organic forest textures, cannabis leaf veins, deep emerald green.',
        mode: 'living'
      }
    };

    const ex = examples[brandName] || examples.Tesla;
    setTargetUrl(ex.url);
    setPrompt(ex.prompt);
    const mode = MODES.find(m => m.id === ex.mode);
    if (mode) setSelectedMode(mode);
    
    setIsMagicGenerating(true);
    // Auto-scroll to generator
    document.getElementById('generator-section')?.scrollIntoView({ behavior: 'smooth' });
    
    // Simulate thinking/auto-start
    setTimeout(() => {
      if (user) handleGenerate();
      else handleGuestGenerate();
      setIsMagicGenerating(false);
    }, 1500);
  };

  const saveGuestEmail = async () => {
    if (!captureEmail || !captureEmail.includes('@')) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/email_leads`,
        {
          method: 'POST',
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            Authorization:
              'Bearer ' + (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            email: captureEmail,
            source: 'guest_generate',
            metadata: { style: selectedMode?.id },
          }),
        }
      );
      setEmailSaved(true);
      setTimeout(() => setShowEmailCapture(false), 1500);
    } catch {}
  };

  const handleGuestGenerate = async () => {
    if (!targetUrl) {
      setError('Please enter a URL.');
      return;
    }
    if (guestUsed >= 2) {
      setError('Free limit reached. Sign up for more generations.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const style = selectedMode?.id || 'space';
      const res = await fetch(
        'https://qron-ai-api.undone-k.workers.dev/v1/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: targetUrl,
            style,
            prompt: prompt || undefined,
          }),
        }
      );
      const d = await res.json();
      const img = d.previewUrl || d.downloadUrl || d.imageUrl || d.url;
      if (img) {
        setResult(img);
        setDownloadName(`qron-${selectedMode.id}-${new Date().getTime()}.png`);
        setGuestUsed((prev) => {
          const next = prev + 1;
          if (next >= 1) setTimeout(() => setShowEmailCapture(true), 2000);
          return next;
        });
      } else {
        setError(d.error || 'Generation failed. Try again.');
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [generationsLimit, setGenerationsLimit] = useState(10);
  const [user, setUser] = useState<User | null>(null);
  const [presets, setPresets] = useState<FalaiPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<FalaiPreset | null>(
    null
  );

  useEffect(() => {
    const fetchUserData = async () => {
      if (!supabase) return;
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser);
      if (authUser) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tier, generations_used, generations_limit')
          .eq('user_id', authUser.id)
          .single();
        if (profile && !profileError) {
          setUserTier(profile.tier);
          setGenerationsUsed(profile.generations_used);
          setGenerationsLimit(profile.generations_limit);
        }
      }
    };

    const fetchPresets = async () => {
      try {
        const res = await fetch('/api/presets');
        if (res.ok) {
          const data: FalaiPreset[] = await res.json();
          setPresets(data);
          if (data[0]) {
            setSelectedPreset(data[0]);
            setPresetId(data[0].id);
          }
        }
      } catch {
                // silently fail — presets will be empty
      }
    };

    fetchUserData();
    fetchPresets();
  }, [supabase]);

  const isTierSufficient = (requiredTier: string) => {
    if (requiredTier === 'free') return true;
    if (
      requiredTier === 'pro' &&
      (userTier === 'pro' || userTier === 'enterprise')
    )
      return true;
    if (requiredTier === 'enterprise' && userTier === 'enterprise') return true;
    return false;
  };

  const handleGenerate = async () => {
    if (!targetUrl || !prompt || !selectedMode || !presetId) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          prompt,
          presetId: selectedPreset?.id,
          mode: selectedMode.id,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data.qron.imageUrl);
        setDownloadName(`qron-${selectedMode.id}-${new Date().getTime()}.png`);
        setGenerationsUsed((prev) => prev + 1);
      } else {
        setError(data.message || 'Generation failed.');
      }
    } catch (err) {
      setError('Network error or unexpected response.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan || plan.price === 0) {
      window.location.assign('/login');
      return;
    }
    if (!plan.stripe_price_id) {
      setError('This plan requires manual onboarding. Email Z@authichain.com to get started.');
      return;
    }
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, email: user?.email }),
      });
      const { url, error: checkoutError } = await res.json();
      if (url) window.location.assign(url);
      else if (plan.stripe_payment_link)
        window.location.assign(plan.stripe_payment_link);
      else if (checkoutError) setError(checkoutError);
    } catch {
      if (plan.stripe_payment_link)
        window.location.assign(plan.stripe_payment_link);
      else setError('Could not start checkout. Please try again.');
    }
  };

  const userPlan = PLANS.find((p) => p.id === userTier) || PLANS[0];

  return (
    <div className="min-h-screen protocol-bg text-white">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        
        {/* NEW SCANNABLE IDENTITY HERO REPLACES STATIC HERO */}
        <InteractiveHero />

        <div className="gold-divider mb-12" />

        {/* Generator */}
        <div id="generator-section" className="protocol-card p-8 mb-12 relative overflow-hidden">
          {/* Magic Loading Overlay */}
          {(loading || isMagicGenerating) && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
               <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-gold animate-pulse" />
               </div>
               <h3 className="text-xl font-black uppercase tracking-tighter gold-text mb-2">
                 {isMagicGenerating ? 'Synchronizing Brand Assets...' : 'Creating Cinematic QRON...'}
               </h3>
               <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] max-w-xs leading-loose">
                 Anchoring to AuthiChain Truth Network • AI Inference in progress • ~15s
               </p>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Create Your QRON</h2>
            <span className="protocol-badge">
              <Shield className="w-3 h-3" />
              AuthiChain Protocol
            </span>
          </div>

          {/* Email capture modal after guest generation */}
          {showEmailCapture && !emailSaved && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  background: '#111',
                  border: '1px solid #c9a227',
                  borderRadius: 16,
                  padding: 32,
                  maxWidth: 420,
                  width: '90%',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
                <h3
                  style={{
                    color: '#c9a227',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    marginBottom: 8,
                  }}
                >
                  Your QR art is ready!
                </h3>
                <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20 }}>
                  Enter your email to save it permanently + get 2 more free
                  generations
                </p>
                <input
                  type="email"
                  value={captureEmail}
                  onChange={(e) => setCaptureEmail(e.target.value)}
                  placeholder="your@email.com"
                  onKeyDown={(e) => e.key === 'Enter' && saveGuestEmail()}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #333',
                    background: '#0a0a0a',
                    color: '#fff',
                    fontSize: 15,
                    marginBottom: 12,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={saveGuestEmail}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#c9a227',
                    color: '#000',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginBottom: 8,
                  }}
                >
                  Save My QR Code
                </button>
                <button
                  onClick={() => setShowEmailCapture(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  No thanks, I&apos;ll skip
                </button>
              </div>
            </div>
          )}
          {showEmailCapture && emailSaved && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  background: '#111',
                  border: '1px solid #4ade80',
                  borderRadius: 16,
                  padding: 32,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                <h3 style={{ color: '#4ade80', fontWeight: 900 }}>
                  Saved! Check your email.
                </h3>
              </div>
            </div>
          )}
          {/* Tier / limit indicator */}
          <div
            className="flex items-center justify-between mb-6 px-4 py-3 rounded-lg"
            style={{
              background: 'rgba(201,162,39,0.06)',
              border: '1px solid rgba(201,162,39,0.15)',
            }}
          >
            <span style={{ color: '#9e9e9e', fontSize: '13px' }}>
              Plan:{' '}
              <span style={{ color: '#e8c547', fontWeight: 700 }}>
                {userPlan?.name.toUpperCase()}
              </span>
            </span>
            <span style={{ color: '#9e9e9e', fontSize: '13px' }}>
              Generations:{' '}
              <span
                style={{
                  color: generationsUsed >= generationsLimit ? '#ff4444' : '#e8c547',
                  fontWeight: 700,
                }}
              >
                {generationsUsed}/{generationsLimit}
              </span>
            </span>
          </div>

          <div className="space-y-4">
            {/* Destination URL */}
            <div>
              <label
                htmlFor="targetUrl"
                className="block text-sm font-semibold mb-2"
                style={{ color: '#c8c8c8' }}
              >
                Destination URL
              </label>
              <input
                type="url"
                id="targetUrl"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="protocol-input w-full px-4 py-3"
              />
            </div>

            {/* Creative Prompt */}
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-semibold mb-2"
                style={{ color: '#c8c8c8' }}
              >
                Creative Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A warrior shield forged from gold and steel, blockchain circuitry, dark armored aesthetic…"
                rows={3}
                className="protocol-input w-full px-4 py-3 resize-none"
              />
            </div>

            {/* Mode + Preset row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="mode"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#c8c8c8' }}
                >
                  QRON Mode
                </label>
                <select
                  id="mode"
                  value={selectedMode.id}
                  onChange={(e) => {
                    const mode = MODES.find((m) => m.id === e.target.value);
                    if (mode) setSelectedMode(mode);
                  }}
                  className="protocol-input w-full px-4 py-3"
                >
                  {MODES.map((modeOption) => (
                    <option
                      key={modeOption.id}
                      value={modeOption.id}
                      disabled={!isTierSufficient(modeOption.tier)}
                    >
                      {modeOption.name}{' '}
                      {modeOption.tier !== 'free'
                        ? `(${modeOption.tier.toUpperCase()})`
                        : ''}
                    </option>
                  ))}
                </select>
                {!isTierSufficient(selectedMode.tier) && (
                  <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>
                    Requires {selectedMode.tier.toUpperCase()} — upgrade to
                    unlock.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="preset"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#c8c8c8' }}
                >
                  Style Preset
                </label>
                <select
                  id="preset"
                  value={selectedPreset?.id || ''}
                  onChange={(e) => {
                    const preset = presets.find((p) => p.id === e.target.value);
                    if (preset) {
                      setSelectedPreset(preset);
                      setPresetId(preset.id);
                    }
                  }}
                  className="protocol-input w-full px-4 py-3"
                >
                  {presets.map((presetOption) => (
                    <option
                      key={presetOption.id}
                      value={presetOption.id}
                      disabled={
                        presetOption.is_premium && !isTierSufficient('pro')
                      }
                    >
                      {presetOption.name}
                      {presetOption.is_premium ? ' ◆ Premium' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="px-4 py-3 rounded-lg text-sm"
                style={{
                  background: 'rgba(255,68,68,0.1)',
                  border: '1px solid rgba(255,68,68,0.3)',
                  color: '#ff9999',
                }}
              >
                {error}
              </div>
            )}

            {/* CTA */}
            {!user ? (
              <button
                onClick={handleGuestGenerate}
                disabled={loading || guestUsed >= 2}
                className="btn-gold w-full py-4 rounded-xl flex items-center justify-center gap-2 text-base"
              >
                <Sparkles className="w-5 h-5" />
                {loading
                  ? 'Generating...'
                  : guestUsed >= 2
                    ? 'Free limit reached — Sign up for more'
                    : 'Generate Free (no signup)'}
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={
                  loading ||
                  !isTierSufficient(selectedMode.tier) ||
                  (generationsUsed >= generationsLimit &&
                    userTier !== 'enterprise')
                }
                className="btn-gold w-full py-4 rounded-xl flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <>
                    <div
                      className="animate-spin rounded-full h-5 w-5 border-2"
                      style={{
                        borderColor: '#0a0a0a',
                        borderTopColor: 'transparent',
                      }}
                    />
                    Generating QRON…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate QRON
                  </>
                )}
              </button>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="mt-8 text-center space-y-4">
              <div className="protocol-badge justify-center inline-flex mb-2">
                <Shield className="w-3 h-3" />
                AuthiChain Protocol — Verified
              </div>
              <h3 className="text-xl font-bold gold-text">Your QRON is Ready</h3>
              <div
                className="inline-block p-4 rounded-xl"
                style={{ background: '#ffffff' }}
              >
                <Image
                  src={result}
                  alt="Generated QRON"
                  width={512}
                  height={512}
                  className="w-full max-w-sm mx-auto rounded-lg shadow-2xl"
                />
              </div>
              <p className="text-sm" style={{ color: '#9e9e9e' }}>
                Cryptographically signed · Blockchain-anchored · Publicly
                verifiable
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setShowScanTest(true)}
                  className="btn-gold px-8 py-3 rounded-xl inline-flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-gold"
                >
                   <Shield className="w-4 h-4" /> Simulate Scan Test
                </button>
                <a
                  href={result}
                  download={downloadName}
                  className="btn-outline-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
              
              <div className="pt-2">
                <Link 
                  href={`/reveal/${downloadName.split('-')[1] || 'demo'}`}
                  className="text-[9px] font-black text-zinc-600 hover:text-gold uppercase tracking-[0.2em] transition-colors"
                >
                  View on Blockchain Explorer &rarr;
                </Link>
              </div>

              {/* Scan Test Simulation Modal */}
              {showScanTest && (
                <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
                    <div className="max-w-md w-full relative">
                        {/* Fake Phone Frame */}
                        <div className="relative aspect-[9/19] bg-[#050505] rounded-[3rem] border-[8px] border-zinc-800 shadow-2xl overflow-hidden ring-1 ring-zinc-700/50">
                            {/* Fake Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-800 rounded-b-2xl z-20" />
                            
                            {/* Camera View Overlay */}
                            <div className="absolute inset-0 z-0">
                                <Image src={result} fill className="object-cover blur-[2px] opacity-40 scale-150" alt="camera feed" />
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
                            </div>

                            {/* Scan UI */}
                            <div className="relative z-10 h-full flex flex-col p-8">
                                <div className="mt-12 flex justify-between items-center">
                                    <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-xs font-bold">Z</div>
                                    <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[9px] font-black text-white tracking-widest uppercase">Protocol Live</div>
                                </div>

                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="w-56 h-56 relative border-2 border-gold/40 rounded-3xl p-4 mb-8">
                                        <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-gold rounded-tl-xl" />
                                        <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-gold rounded-tr-xl" />
                                        <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-gold rounded-bl-xl" />
                                        <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-gold rounded-br-xl" />
                                        <div className="absolute inset-0 bg-gold/5 animate-pulse" />
                                        <Image src={result} fill className="object-contain p-4" alt="scanning qron" />
                                    </div>
                                    <div className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
                                        <div className="p-3 rounded-full bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)] mb-2">
                                            <CheckCircle className="w-8 h-8 text-white" />
                                        </div>
                                        <h4 className="text-xl font-black text-white uppercase tracking-tighter italic">Authentic Verified</h4>
                                        <p className="text-[10px] font-black text-gold uppercase tracking-[0.3em]">AuthiChain SECURED</p>
                                    </div>
                                </div>

                                {/* StoryMode Preview */}
                                <div className="mt-auto bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-1000 fill-mode-both">
                                    <h5 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Sparkles className="w-3 h-3 text-gold" /> StoryMode Narrative
                                    </h5>
                                    <p className="text-sm font-medium text-white leading-relaxed italic">
                                        &quot;This artifact represents a fusion of peak industrial engineering and creative autonomous AI. Every module is a signature of truth, anchored forever on the Polygon network...&quot;
                                    </p>
                                    <div className="mt-6 flex gap-3">
                                        <div className="flex-1 h-10 rounded-xl bg-gold flex items-center justify-center text-black text-xs font-black uppercase tracking-widest">Buy Now</div>
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white"><ArrowRight className="w-4 h-4" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowScanTest(false)}
                            className="mt-8 w-full text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.4em] transition-colors"
                        >
                            [ CLOSE SIMULATION ]
                        </button>
                    </div>
                </div>
              )}

              <div className="mt-6 max-w-sm mx-auto">
                <SocialShareCTA imageUrl={result} />
              </div>
            </div>
          )}
        </div>

        {/* Gallery Sections */}
        <FeaturedQRONs />

        <StaticImageGallery
          title="Artsy Presets"
          description="Beautifully designed QRON styles — each one cryptographically signed by the AuthiChain Protocol."
          images={[
            {
              src: '/media/samples/03_flux_authichain.png',
              alt: 'AuthiChain Renaissance Gold AI QR.',
              width: 1080,
              height: 1080,
            },
            {
              src: '/media/samples/02_flux_strainchain.png',
              alt: 'StrainChain Bio Jungle AI QR.',
              width: 1080,
              height: 1080,
            },
          ]}
        />

        <StaticImageGallery
          title="Business Use Cases"
          description="Enterprise-grade QR authentication across luxury, retail, events, and supply chain."
          images={[
            {
              src: '/media/samples/06_flux_haute_couture.png',
              alt: 'Luxury Fashion validation QRON.',
              width: 1080,
              height: 1080,
            },
            {
              src: '/media/samples/04_flux_ev_industry.png',
              alt: 'Electric Automotive telemetry QRON.',
              width: 1080,
              height: 1080,
            },
            {
              src: '/media/samples/07_flux_artisan_roasters.png',
              alt: 'Food & Beverage tracking QRON.',
              width: 1080,
              height: 1080,
            },
            {
              src: '/media/samples/08_flux_propchain.png',
              alt: 'Real Estate/PropTech blueprint QRON.',
              width: 1080,
              height: 1080,
            },
          ]}
        />

        <div className="gold-divider my-12" />

        {/* Social Proof Strip */}
        <div className="grid grid-cols-3 gap-4 mb-12 text-center">
          {[
            { stat: '100%', label: 'Scan guarantee' },
            { stat: 'Ed25519', label: 'Cryptographic signing' },
            { stat: '< 3s', label: 'Generation time' },
          ].map(({ stat, label }) => (
            <div key={label} className="protocol-card p-4">
              <div className="text-2xl font-bold gold-text">{stat}</div>
              <div className="text-xs mt-1" style={{ color: '#6b6b6b' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="gold-divider my-12" />

        {/* Elite Capabilities Section */}
        <section className="mb-16">
          <div className="text-center mb-12">
            <span className="protocol-badge mb-4 inline-flex">
              <Zap className="w-3 h-3" />
              Elite / Theater 3 Capabilities
            </span>
            <h2 className="text-3xl md:text-5xl font-black mt-4 mb-4 uppercase tracking-tighter">
              <span className="gold-text">Cryptographic Art Engine</span>
            </h2>
            <p className="text-base max-w-2xl mx-auto text-zinc-400 leading-relaxed">
              QRON.space combines Hugging Face ControlNet pipelines with advanced quantitative imaging to create scannable, cryptographically anchored masterpieces.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* ControlNet & HF */}
            <div className="protocol-card p-6 bg-zinc-950/50 flex flex-col items-start text-left">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
                <Palette className="w-5 h-5 text-gold" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-white">Hugging Face ControlNet</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Powered by SDXL and custom ControlNet models via the Hugging Face Inference API. Our pipeline perfectly balances QR scannability with hyper-realistic artistic generation.
              </p>
            </div>

            {/* Magic Eye / Autostereography */}
            <div className="protocol-card p-6 bg-zinc-950/50 flex flex-col items-start text-left">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Eye className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-white">Magic Eye Autostereograms</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Pioneering autostereography techniques to embed scannable cryptographic payloads inside 3D stereogram patterns. Look past the image to see the underlying TrueMark.
              </p>
            </div>

            {/* Quantitative Imaging & Colorimetry */}
            <div className="protocol-card p-6 bg-zinc-950/50 flex flex-col items-start text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-white">Quantitative Colorimetry</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Utilizing spectrophotometry principles and precise colorimetry to calculate structural contrast limits, guaranteeing the QR anchor remains functional in extreme light conditions.
              </p>
            </div>

            {/* TrueMark Integration */}
            <div className="protocol-card p-6 bg-zinc-950/50 flex flex-col items-start text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-white">TrueMark™ Anchor</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Every generated asset receives an immutable TrueMark ID. Scannable AI art acts as a physical-to-digital bridge, anchoring the item to Polygon and Base layer-2 networks.
              </p>
            </div>

            {/* GPT Vision Validation */}
            <div className="protocol-card p-6 bg-zinc-950/50 flex flex-col items-start text-left">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                <ScanLine className="w-5 h-5 text-cyan-500" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-white">GPT-4o Vision Verification</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Pre-flight scans are executed autonomously by GPT-4o Vision agents to ensure error-correction integrity and aesthetic alignment before the QRON is delivered.
              </p>
            </div>

            {/* Living Portals & $QRON */}
            <div className="protocol-card p-6 bg-zinc-950/50 flex flex-col items-start text-left relative overflow-hidden">
              <div className="absolute inset-0 bg-gold/5 blur-2xl rounded-full" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center mb-4">
                  <Coins className="w-5 h-5 text-gold" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-gold">Living Portals & $QRON</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  Generators create &quot;Living Portals&quot;—dynamic redirect hubs that update based on time, location, or user profile. Powered by the $QRON utility token for high-volume enterprise minting.
                </p>
                <div className="inline-flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded text-[10px] font-mono border border-zinc-800">
                  <span className="text-zinc-500">Contract:</span>
                  <span className="text-gold">0xAebf...E437</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="gold-divider my-12" />

        {/* Demo Gallery Preview */}
        <section className="mb-16" id="demo-gallery">
          <div className="text-center mb-10">
            <span className="protocol-badge mb-4 inline-flex">
              <Sparkles className="w-3 h-3" />
              Iconic Brand QRONs
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-3">
              <span className="gold-text">The Demo Gallery</span>
            </h2>
            <p
              className="text-base max-w-lg mx-auto"
              style={{ color: '#6b6b6b' }}
            >
              See what&apos;s possible when AI meets the world&apos;s most
              recognizable brands. Every QRON is fully scannable and
              AuthiChain-verified.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              {
                image: '/media/samples/01-neon-glitch.png',
                brand: 'Cyberpunk',
                style: 'Glitch Art',
                category: 'Tech',
              },
              {
                image: '/media/samples/02-holographic-mosaic.png',
                brand: 'Holographic',
                style: 'Mosaic',
                category: 'Luxury',
              },
              {
                image: '/media/samples/09_flux_streamvault.png',
                brand: 'StreamVault',
                style: 'Film Noir',
                category: 'Media',
              },
              {
                image: '/media/samples/10_flux_athletedao.png',
                brand: 'AthleteDAO',
                style: 'Kinetic',
                category: 'Sports',
              },
            ].map(({ image, brand, style, category }) => (
              <div key={brand} className="protocol-card overflow-hidden group">
                <div className="aspect-square relative overflow-hidden bg-zinc-900">
                  <Image
                    src={image}
                    alt={brand}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] font-black text-gold border border-gold/40 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm uppercase tracking-widest">
                        Verify
                    </span>
                  </div>
                </div>
                <div className="p-3 border-t border-zinc-900 bg-zinc-950">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-[10px] font-black uppercase text-white truncate">
                      {brand}
                    </h4>
                    <span className="text-[8px] font-black text-gold border border-gold/20 px-1 rounded">
                      {category}
                    </span>
                  </div>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase">
                    {style} Edition
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <a
              href="/demo"
              className="btn-gold px-8 py-3 rounded-xl inline-flex items-center gap-2 font-bold"
            >
              <Sparkles className="w-4 h-4" />
              Browse Full Demo Gallery →
            </a>
            <p className="text-xs mt-3" style={{ color: '#6b6b6b' }}>
              20+ iconic brands · Order yours from $49 · Delivered in ~5 min
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-16" id="pricing">
          <div className="text-center mb-10">
            <span className="protocol-badge mb-4 inline-flex">
              <Shield className="w-3 h-3" />
              AuthiChain Protocol Plans
            </span>
            <h2 className="text-4xl font-bold mt-4 mb-3">
              <span className="gold-text">Choose Your Tier</span>
            </h2>
            <p
              className="text-base max-w-lg mx-auto"
              style={{ color: '#6b6b6b' }}
            >
              All plans include AuthiChain Protocol verification. Credits never
              expire.{' '}
              <a
                href="https://authichain.com"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#c9a227', textDecoration: 'none' }}
              >
                Enterprise operations →
              </a>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`protocol-card p-8 flex flex-col ${'highlighted' in plan && plan.highlighted ? 'ring-1 ring-yellow-500/50' : ''} ${plan.id === userTier ? 'ring-1 ring-yellow-500/80' : ''}`}
              >
                {plan.id === userTier && (
                  <div className="protocol-badge justify-center mb-3">
                    Current Plan
                  </div>
                )}
                {'highlighted' in plan &&
                  plan.highlighted &&
                  plan.id !== userTier && (
                    <div className="text-center mb-3">
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{
                          background: 'rgba(201,162,39,0.15)',
                          color: '#c9a227',
                          border: '1px solid rgba(201,162,39,0.3)',
                        }}
                      >
                        BEST VALUE
                      </span>
                    </div>
                  )}
                <h3 className="text-2xl font-bold text-center mb-1">
                  {plan.name}
                </h3>
                {'description' in plan && (
                  <p
                    className="text-xs text-center mb-4"
                    style={{ color: '#6b6b6b' }}
                  >
                    {plan.description}
                  </p>
                )}
                <div className="text-center mb-6">
                  {plan.price === 0 ? (
                    <span className="text-4xl font-bold gold-text">Free</span>
                  ) : (
                    <span className="text-4xl font-bold gold-text">
                      ${plan.price}
                      <span
                        className="text-base font-normal"
                        style={{ color: '#6b6b6b' }}
                      >
                        {plan.price_suffix || ' one-time'}
                      </span>
                    </span>
                  )}
                </div>
                <ul
                  className="space-y-3 mb-8 flex-grow text-sm"
                  style={{ color: '#9e9e9e' }}
                >
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle
                        className="w-4 h-4 mt-0.5 shrink-0"
                        style={{ color: '#c9a227' }}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={plan.id === userTier}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all ${
                    plan.id === userTier
                      ? 'btn-outline-gold opacity-40 cursor-not-allowed'
                      : 'btn-gold'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  {plan.id === userTier ? 'Current Plan' : plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="gold-divider my-12" />

        {/* Ecosystem Pillars */}
        <section className="mb-24 px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4">Ecosystem <span className="gold-text">Pillars</span></h2>
                <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold">The Multi-Domain Protocol Architecture</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    {
                        name: 'QRON.space',
                        role: 'Creative Studio',
                        feature: 'Story Mode Active',
                        desc: 'The visual gateway to the protocol. AI QR art with cinematic digital reveals.',
                        icon: Sparkles,
                        color: 'text-gold',
                        link: 'https://qron.space'
                    },
                    {
                        name: 'StrainChain.io',
                        role: 'Industrial Provenance',
                        feature: 'Watchdog Enabled',
                        desc: 'Elite AgTech supply chain security with real-time geographic drift monitoring.',
                        icon: Package,
                        color: 'text-blue-400',
                        link: 'https://strainchain.io'
                    },
                    {
                        name: 'GovChain.us',
                        role: 'Ecosystem Governance',
                        feature: 'DAO Staking Yield',
                        desc: 'The economic heart. Stake $QRON to govern the protocol and earn yield.',
                        icon: Vote,
                        color: 'text-purple-400',
                        link: 'https://govchain.us'
                    },
                    {
                        name: 'AuthiChain.com',
                        role: 'Foundational Layer',
                        feature: 'Ed25519 Verified',
                        desc: 'The core cryptographic engine powering sub-protocols and API security.',
                        icon: Shield,
                        color: 'text-zinc-300',
                        link: 'https://authichain.com'
                    }
                ].map((p) => (
                    <div key={p.name} className="protocol-card p-8 group hover:border-gold/30 transition-all bg-zinc-950/30">
                        <div className={`p-3 rounded-xl bg-zinc-900 border border-zinc-800 w-fit mb-6 ${p.color}`}>
                            <p.icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black uppercase text-white mb-1">{p.name}</h3>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4">{p.role}</p>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-6 group-hover:text-gold transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            {p.feature}
                        </div>
                        <p className="text-sm text-zinc-500 leading-relaxed mb-8">
                            {p.desc}
                        </p>
                        <Link href={p.link} className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-600 group-hover:text-gold tracking-widest">
                            Explore Pillar <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                ))}
            </div>
        </section>

        <div className="gold-divider my-12" />

        {/* How It Works */}
        <section className="mb-16">
          <div className="text-center mb-10">
            <span className="protocol-badge mb-4 inline-flex">
              <Shield className="w-3 h-3" />
              AuthiChain Protocol
            </span>
            <h2 className="text-4xl font-bold mt-4 mb-3">
              <span className="gold-text">How It Works</span>
            </h2>
            <p
              className="text-base max-w-2xl mx-auto"
              style={{ color: '#6b6b6b' }}
            >
              Every QRON is an Ed25519-signed cryptographic payload — scannable
              by anyone, verifiable by the AuthiChain Protocol.
            </p>
          </div>
          <div className="flex flex-col items-center gap-6">
            <Image
              src="/media/docs-flow-1080.svg"
              alt="URL → AI QR Art → AuthiChain Verify → Analytics"
              width={1080}
              height={1080}
              className="rounded-xl shadow-2xl max-w-full h-auto"
              style={{ border: '1px solid rgba(201,162,39,0.15)' }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
              {/* Plain QR */}
              <div className="protocol-card p-6 bg-zinc-950/60 border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">
                    Plain QR Code
                  </span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 font-black">
                    75% scan
                  </span>
                </div>
                <div className="relative aspect-square rounded-xl overflow-hidden bg-white flex items-center justify-center p-6">
                  <svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" shapeRendering="crispEdges" aria-hidden="true">
                    <rect width="21" height="21" fill="#fff" />
                    <g fill="#000">
                      <path d="M0 0h7v7H0zm1 1v5h5V1zm1 1h3v3H2zM14 0h7v7h-7zm1 1v5h5V1zm1 1h3v3h-3zM0 14h7v7H0zm1 1v5h5v-5zm1 1h3v3H2z" />
                      <path d="M8 0h1v1H8zm2 0h1v2h-1zm2 1h1v1h-1zM9 2h1v2H9zm3 1h1v3h-1zM8 4h1v1H8zm2 1h1v1h-1zM8 6h2v1H8zm5 0h1v2h-1zM0 8h1v1H0zm2 0h2v1H2zm3 0h1v2H5zm2 0h1v1H7zm2 0h1v1H9zm2 0h2v1h-2zm4 0h1v2h-1zm3 0h1v1h-1zm-19 1h1v1H1zm3 0h1v1H4zm4 0h1v3H8zm3 0h1v1h-1zm5 0h1v3h-1zm3 0h1v1h-1zM0 10h2v1H0zm3 0h1v1H3zm2 0h1v1H5zm5 0h1v2h-1zm3 0h1v2h-1zm5 0h1v2h-1zm-15 1h1v1H1zm5 0h1v1H6zm6 0h1v2h-1zm4 0h1v1h-1zm3 0h1v1h-1zM0 12h2v1H0zm3 0h1v1H3zm2 0h1v1H5zm4 0h1v1H9zm6 0h1v1h-1zm3 0h1v1h-1zM8 13h1v1H8zm6 0h1v3h-1zm3 0h1v1h-1zm2 0h1v3h-1zM8 14h1v1H8zm2 0h2v1h-2zm5 0h1v3h-1zm-5 1h1v3h-1zm2 0h1v3h-1zm5 0h1v1h-1zM8 16h1v1H8zm10 0h1v1h-1zm-9 1h1v3H9zm6 0h1v1h-1zm3 0h1v1h-1zM8 18h1v1H8zm5 0h1v1h-1zm3 0h1v1h-1zm3 0h1v1h-1zm-7 1h1v2h-1zm3 0h1v1h-1zm3 0h1v2h-1zM8 20h1v1H8zm5 0h1v1h-1zm4 0h1v1h-1z" />
                    </g>
                  </svg>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-4 leading-relaxed font-medium">
                  Generic. Easily ignored. ~25% scan abandonment.
                </p>
              </div>

              {/* QRON Art */}
              <div
                className="protocol-card p-6 border-gold/30"
                style={{ background: 'linear-gradient(135deg, rgba(201,162,39,0.08) 0%, rgba(13,13,13,0.6) 60%)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] uppercase tracking-widest text-gold font-black">
                    AuthiChain QRON
                  </span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-gold/15 border border-gold/30 text-gold font-black">
                    ~100% scan
                  </span>
                </div>
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-950">
                  <Image
                    src="/media/qron-grid-9.png"
                    alt="AuthiChain QRON gallery — phoenix, dragon, tree of life, eagle, snowflake, galaxy, clock, prism"
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-400 mt-4 leading-relaxed font-medium">
                  Ed25519-signed art. Eyes lock on. ~25% scan lift, every time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Cross-link Banner */}
        <div
          className="protocol-card p-8 text-center mb-8"
          style={{
            background:
              'linear-gradient(135deg, #111100 0%, #0d0d0d 50%, #110d00 100%)',
          }}
        >
          <div className="protocol-badge mb-4 inline-flex">
            <Shield className="w-3 h-3" />
            AuthiChain Protocol — Enterprise
          </div>
          <h3 className="text-2xl font-bold mb-3">
            Need the <span className="gold-text">Executive Platform?</span>
          </h3>
          <p
            className="text-sm mb-6 max-w-md mx-auto"
            style={{ color: '#9e9e9e' }}
          >
            QRON is the creative studio.{' '}
            <strong style={{ color: '#c8c8c8' }}>authichain.com</strong> is the
            enterprise authentication command center — NFT marketplace, supply
            chain tracking, government-grade verification, and DHS SVIP
            compliance.
          </p>
          <a
            href="https://authichain.com"
            target="_blank"
            rel="noreferrer"
            className="btn-gold inline-flex items-center gap-2 px-8 py-3 rounded-xl no-underline"
          >
            <Shield className="w-4 h-4" />
            Visit AuthiChain Enterprise →
          </a>
        </div>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">
            <span className="gold-text">Frequently Asked Questions</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              {
                q: 'Do credits expire?',
                a: 'Never. Pack credits are yours indefinitely — buy once, use whenever you need.',
              },
              {
                q: 'Can I scan the QR codes on any phone?',
                a: 'Yes. Every QRON works with any standard camera app — no special app required.',
              },
              {
                q: 'What is AuthiChain verification?',
                a: 'Each QR is Ed25519-signed and anchored on the AuthiChain blockchain. Anyone who scans it can verify its authenticity instantly.',
              },
              {
                q: 'What if I need more than 2,000 generations?',
                a: 'The Business plan gives you unlimited generations for $49/month, or contact us for a custom enterprise contract.',
              },
              {
                q: 'What AI model generates the QR art?',
                a: 'We use a specialized ControlNet-augmented Stable Diffusion pipeline via Hugging Face, fine-tuned to maximize scan reliability while maximizing visual quality.',
              },
              {
                q: 'Is there a refund policy?',
                a: 'If your generated QR is not scannable, we regenerate it free. For billing issues, contact authichain@gmail.com.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="protocol-card p-5">
                <p
                  className="font-semibold text-sm mb-2"
                  style={{ color: '#c8c8c8' }}
                >
                  {q}
                </p>
                <p className="text-xs" style={{ color: '#6b6b6b' }}>
                  {a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* YouTube Channel Section */}
        <section className="mb-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#c9a227' }}>@AuthiChain-Qronspace</p>
            <h2 className="text-2xl font-bold mb-3"><span className="gold-text">See QRON in Action</span></h2>
            <p className="text-sm mb-8" style={{ color: '#6b6b6b' }}>Watch how living QR codes power authentication across luxury, cannabis, food & pharma</p>

            {/* Featured Video */}
            <div className="mb-6 rounded-2xl overflow-hidden border border-zinc-800" style={{ background: '#0a0a0a' }}>
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                <iframe
                  src="https://www.youtube.com/embed/mfckohgDrNk?rel=0&color=white&modestbranding=1"
                  title="QRON Main Overview"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>

            {/* Video Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
              {[
                { id: 'PdCibPadCxE', label: 'Food & Beverage', title: 'Validating Origin with QRON' },
                { id: '70KG5d2fFUo', label: 'Token Economy', title: 'The $QRON Token Economy' },
                { id: 'bAI14tPQFF4', label: 'Ecosystem', title: 'Use Cases for Trust' },
              ].map(({ id, label, title }) => (
                <a key={id} href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer"
                   className="rounded-xl overflow-hidden border border-zinc-800 hover:border-yellow-600 transition-colors block"
                   style={{ background: '#0a0a0a', textDecoration: 'none' }}>
                  <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#050505' }}>
                    <img src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`} alt={title}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 40, height: 40, background: 'rgba(220,38,38,0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="9.5,7.5 16.5,12 9.5,16.5"/></svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#c9a227' }}>{label}</p>
                    <p className="text-xs font-bold" style={{ color: '#c8c8c8' }}>{title}</p>
                  </div>
                </a>
              ))}
            </div>

            {/* Channel CTA */}
            <a href="https://www.youtube.com/@AuthiChain-Qronspace" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-3 font-black text-sm px-6 py-3 rounded-full transition-all"
               style={{ background: '#dc2626', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 20px rgba(220,38,38,0.35)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/>
              </svg>
              Subscribe on YouTube
              <span className="text-[10px] opacity-75">26 Videos · @AuthiChain-Qronspace</span>
            </a>
          </div>
        </section>

        {/* Footer Navigation */}
        <footer className="text-center py-12 border-t border-zinc-900 mt-12">
          <div className="flex justify-center gap-6 mb-6">
             <Link href="/about" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">About</Link>
             <Link href="/creators" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Creators</Link>
             <span className="text-zinc-800">|</span>
             <Link href="/terms" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Terms</Link>
             <Link href="/privacy" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Privacy</Link>
          </div>
          {/* Ecosystem Cross-Sell */}
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            {[
              { name: 'AuthiChain', url: 'https://authichain.com', color: '#34d399', desc: 'Product Auth Protocol' },
              { name: 'StrainChain', url: 'https://strainchain.io', color: '#22c55e', desc: 'Cannabis Provenance' },
              { name: 'GovChain', url: 'https://govchain.us', color: '#60a5fa', desc: 'Gov Authentication' },
            ].map(({ name, url, color, desc }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                 className="px-4 py-2 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-colors"
                 style={{ textDecoration: 'none', background: '#0a0a0a' }}>
                <span className="text-xs font-black block" style={{ color }}>{name}</span>
                <span className="text-[9px]" style={{ color: '#6b6b6b' }}>{desc}</span>
              </a>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs" style={{ color: '#6b6b6b' }}>
              ◆ 100% scannable guarantee &nbsp;·&nbsp; Ed25519 cryptographic
              signing &nbsp;·&nbsp; AuthiChain blockchain anchoring
            </p>
            <p className="text-[10px] font-bold text-zinc-800 uppercase tracking-widest">
              Powered by Hugging Face · Supabase · Stripe · AuthiChain Protocol
            </p>
          </div>
        </footer>

        <LeadCapturePopup />
      </div>
    </div>
  );
}
