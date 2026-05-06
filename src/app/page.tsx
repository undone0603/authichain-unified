'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Download,
  CreditCard,
  CheckCircle,
  Shield,
  Zap,
  Lock,
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
        setDownloadName(`qron-${selectedMode.id}-${Date.now()}.png`);
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
        // silently fail â€” presets will be empty
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
        setDownloadName(`qron-${selectedMode.id}-${Date.now()}.png`);
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
      window.location.assign('mailto:Z@authichain.com');
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
        {/* Hero */}
        <div className="text-center mb-14">
          {/* Protocol badge */}
          <div className="flex justify-center mb-6">
            <span className="protocol-badge">
              <Shield className="w-3 h-3" />
              Creative Layer of the AuthiChain Protocol
            </span>
          </div>

          {/* Hero QR Art */}
          <div className="flex justify-center mb-6 animate-float">
            <Image
              src="/media/samples/01_flux_qron_space.png"
              alt="QRON Space Artistic AI"
              width={220}
              height={220}
              priority
              style={{ filter: 'drop-shadow(0 0 32px rgba(255,215,0,0.35))' }}
            />
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-4 leading-tight tracking-tight">
            <span className="gold-text">QRON</span>
          </h1>
          <p
            className="text-xl md:text-2xl font-light mb-3"
            style={{ color: '#c8c8c8' }}
          >
            Cryptographically verified QR art.
          </p>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: '#6b6b6b' }}
          >
            Where authentication meets artistry — every QRON is signed by the{' '}
            <a
              href="https://authichain.com"
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#c9a227',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              AuthiChain Protocol
            </a>{' '}
            and verifiable by anyone, anywhere.
          </p>

          {/* Stat strip */}
          <div className="flex flex-wrap justify-center gap-8 mt-10">
            {[
              {
                icon: <Zap className="w-4 h-4" />,
                stat: '~25%',
                label: 'scan lift vs plain QR',
              },
              {
                icon: <Lock className="w-4 h-4" />,
                stat: 'Ed25519',
                label: 'cryptographic signature',
              },
              {
                icon: <Shield className="w-4 h-4" />,
                stat: '99.7%',
                label: 'verification accuracy',
              },
            ].map(({ icon, stat, label }) => (
              <div
                key={label}
                className="flex items-center gap-2"
                style={{ color: '#9e9e9e', fontSize: '13px' }}
              >
                <span style={{ color: '#c9a227' }}>{icon}</span>
                <span style={{ color: '#e8c547', fontWeight: 700 }}>
                  {stat}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="gold-divider mb-12" />

        {/* Generator */}
        <div className="protocol-card p-8 mb-12">
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
              <a
                href={result}
                download={downloadName}
                className="btn-outline-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl"
              >
                <Download className="w-4 h-4" />
                Download QRON
              </a>

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
            <Image
              src="/media/docs-scannability-1080.svg"
              alt="Plain QR vs AuthiChain QRON — scan rate comparison"
              width={1080}
              height={1080}
              className="rounded-xl shadow-2xl max-w-full h-auto"
              style={{ border: '1px solid rgba(201,162,39,0.15)' }}
            />
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

        {/* Trust Strip */}
        <div className="text-center space-y-2 py-6">
          <p className="text-xs" style={{ color: '#6b6b6b' }}>
            ◆ 100% scannable guarantee &nbsp;·&nbsp; Ed25519 cryptographic
            signing &nbsp;·&nbsp; AuthiChain blockchain anchoring
          </p>
          <p className="text-xs" style={{ color: '#3a3a3a' }}>
            Powered by Hugging Face · Supabase · Stripe · AuthiChain Protocol
          </p>
        </div>

        <LeadCapturePopup />
      </div>
    </div>
  );
}
