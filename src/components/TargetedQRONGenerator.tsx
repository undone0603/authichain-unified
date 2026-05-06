'use client';

import { useState } from 'react';
import { Loader2, Wand2, Target, Upload, X } from 'lucide-react';
import { QRDisplay } from '@/components/QRDisplay';
import type { GeneratedQRON } from '@/lib/types';
import { createClient } from '@/utils/supabase/client';

// â”€â”€ Style presets (must match API route keys) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STYLE_OPTIONS = [
  { key: 'portrait', label: 'Oil Portrait', emoji: 'ðŸŽ¨', tier: 'free' },
  { key: 'watercolor', label: 'Watercolor', emoji: 'ðŸ–Œï¸', tier: 'free' },
  { key: 'cyberpunk', label: 'Cyberpunk', emoji: 'ðŸ¤–', tier: 'free' },
  { key: 'miniature', label: 'Tiny World', emoji: 'ðŸ™ï¸', tier: 'pro' },
  { key: 'anime', label: 'Anime', emoji: 'â›©ï¸', tier: 'pro' },
  { key: 'luxury', label: 'Luxury Brand', emoji: 'ðŸ’Ž', tier: 'pro' },
  { key: 'graffiti', label: 'Street Art', emoji: 'ðŸŽ­', tier: 'pro' },
  { key: 'geometric', label: 'Geometric', emoji: 'ðŸ”·', tier: 'free' },
  { key: 'nature', label: 'Botanical', emoji: 'ðŸŒ¿', tier: 'free' },
] as const;

type StyleKey = (typeof STYLE_OPTIONS)[number]['key'];

export function TargetedQRONGenerator({
  userTier = 'free',
}: {
  userTier?: string;
}) {
  const [url, setUrl] = useState('');
  const [subject, setSubject] = useState('');
  const [style, setStyle] = useState<StyleKey>('watercolor');
  const [customStyle, setCustomStyle] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQRON, setGeneratedQRON] = useState<GeneratedQRON | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const isTierSufficient = (required: string) => {
    if (required === 'free') return true;
    if (
      required === 'pro' &&
      (userTier === 'pro' || userTier === 'enterprise')
    )
      return true;
    if (required === 'enterprise' && userTier === 'enterprise') return true;
    return false;
  };

  const handleGenerate = async () => {
    setError(null);

    if (!url) {
      setError('Please enter a URL');
      return;
    }
    if (!subject.trim()) {
      setError('Please describe your target subject (person, brand, animal...)');
      return;
    }

    // Validate URL
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    // Check selected style is available for user tier
    const selectedOption = STYLE_OPTIONS.find((s) => s.key === style);
    if (selectedOption && !isTierSufficient(selectedOption.tier)) {
      setError(`Upgrade to PRO to use the ${selectedOption.label} style`);
      return;
    }

    setIsGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to generate QRONs');
        setIsGenerating(false);
        return;
      }

      const body: Record<string, string> = {
        url: normalizedUrl,
        subject: subject.trim(),
        style: customStyle.trim() || style,
      };
      if (referenceImageUrl.trim()) {
        body.referenceImageUrl = referenceImageUrl.trim();
      }

      const response = await fetch('/api/qron/generate-targeted', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await response.json();

      // Map to GeneratedQRON shape used by QRDisplay
      setGeneratedQRON({
        id: crypto.randomUUID(),
        imageUrl: data.imageUrl,
        qrDataUrl: data.qrDataUrl,
        targetUrl: data.url,
        prompt: data.prompt,
        mode: 'static',
        createdAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* â”€â”€ Left: Input Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="protocol-card space-y-5">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-gold" />
          <h2 className="text-lg font-semibold">Targeted QRON</h2>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold">
            Beta
          </span>
        </div>

        <p className="text-sm text-slate-400">
          Generate AI artwork fused with a scannable QR code, themed around a
          specific person, brand, animal, or logo.
        </p>

        {/* URL Input */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Destination URL *
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-brand.com"
            className="protocol-input w-full px-4 py-2"
            disabled={isGenerating}
          />
        </div>

        {/* Subject Input */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Target Subject *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Nike swoosh, Elon Musk, golden retriever, leopard face..."
            className="protocol-input w-full px-4 py-2"
            disabled={isGenerating}
          />
          <p className="text-xs text-slate-600 mt-1">
            Be specific â€” include details like color, expression, setting if
            desired.
          </p>
        </div>

        {/* Style Picker */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Art Style</label>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((opt) => {
              const locked = !isTierSufficient(opt.tier);
              return (
                <button
                  key={opt.key}
                  onClick={() => !locked && setStyle(opt.key)}
                  disabled={isGenerating || locked}
                  title={locked ? `Upgrade to PRO for ${opt.label}` : opt.label}
                  className={`relative px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1.5 ${
                    style === opt.key && !locked
                      ? 'bg-gold text-black font-bold'
                      : locked
                        ? 'bg-zinc-800/50 text-slate-600 cursor-not-allowed'
                        : 'bg-zinc-800 text-slate-300 hover:bg-zinc-700'
                  }`}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                  {locked && (
                    <span className="absolute -top-1 -right-1 text-[9px] px-1 rounded-full bg-amber-500 text-black font-bold">
                      PRO
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Options */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm gold-text hover:opacity-80 transition-colors"
        >
          {showAdvanced ? 'âˆ’ Hide' : '+ Show'} Advanced Options
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-2 border-t border-zinc-700">
            {/* Custom style override */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Custom Style Prompt (overrides preset)
              </label>
              <textarea
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="e.g. tilt-shift, miniature architecture, vivid saturation, bokeh..."
                className="protocol-input w-full h-20 resize-none px-4 py-2"
                disabled={isGenerating}
              />
            </div>

            {/* Reference image URL */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5 flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" />
                Reference Image URL (optional)
              </label>
              <input
                type="text"
                value={referenceImageUrl}
                onChange={(e) => setReferenceImageUrl(e.target.value)}
                placeholder="https://... (logo PNG or person photo)"
                className="protocol-input w-full px-4 py-2"
                disabled={isGenerating}
              />
              <p className="text-xs text-slate-600 mt-1">
                Provide a logo or photo URL to guide the AI toward that visual
                identity.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-sm text-red-300">
            <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !url || !subject.trim()}
          className="btn-gold w-full flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating your QRON...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              Generate Targeted QRON
            </>
          )}
        </button>

        <p className="text-xs text-slate-500 text-center">
          Uses high error-correction QR + Hugging Face ControlNet Â· ~20â€“45
          seconds
        </p>
      </div>

      {/* â”€â”€ Right: Preview Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div>
        <QRDisplay
          qron={generatedQRON}
          isGenerating={isGenerating}
          mode="static"
        />

        {/* Style inspiration examples */}
        {!generatedQRON && !isGenerating && (
          <div className="mt-6 protocol-card">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Style Examples
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-400">
              <div className="space-y-1">
                <div className="text-2xl">ðŸ¤–</div>
                <div>Cyberpunk</div>
                <div className="text-slate-600">Neon Â· Glitch Â· Dark</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl">ðŸ–Œï¸</div>
                <div>Watercolor</div>
                <div className="text-slate-600">Soft Â· Vivid Â· Art</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl">ðŸ™ï¸</div>
                <div>Tiny World</div>
                <div className="text-slate-600">Isometric Â· Miniature</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
