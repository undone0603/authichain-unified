'use client';

import { useState, useRef } from 'react';
import QRCode from 'qrcode';
import { ChevronLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function StellarSealPage() {
  const [url, setUrl] = useState('https://qron.space');
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generatePreview = async () => {
    if (!url) return;
    setLoading(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      setLoading(false);
      return;
    }

    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 512,
        color: { dark: '#d4b45a', light: '#0c1018' },
      });

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 512;
      canvas.height = 512;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        // Star map overlay
        ctx.fillStyle = '#e8e4d8';
        for (let i = 0; i < 100; i++) {
          const x = Math.random() * 512;
          const y = Math.random() * 512;
          const r = Math.random() * 1.8 + 0.4;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Constellation lines (simple)
        ctx.strokeStyle = 'rgba(212, 180, 90, 0.35)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * 512, Math.random() * 512);
          ctx.lineTo(Math.random() * 512, Math.random() * 512);
          ctx.stroke();
        }
        // Watermark
        ctx.fillStyle = 'rgba(212, 180, 90, 0.85)';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText('PREVIEW • QRON STELLAR SEAL', 20, 490);
        setPreview(canvas.toDataURL('image/png'));
        console.log(JSON.stringify({
          event: 'stellar_preview_generated',
          url,
          timestamp: new Date().toISOString(),
        }));
        setLoading(false);
      };
      img.src = qrDataUrl;
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <header className="flex items-center justify-between mb-12 border-b border-zinc-900 pb-6">
          <Link href="/" className="group flex items-center gap-2">
            <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            Stellar Seal
          </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-[0.9]">
          Your sky.<br />
          <span className="gold-text">One scannable seal.</span>
        </h1>
        <p className="text-xl text-zinc-400 mb-10 max-w-2xl">
          Generate a Living QR that looks like a star map. It still scans on any phone. Redirects stay editable. Certificates live on AuthiChain.
        </p>

        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2 block">URL or product destination</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-product.com"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-colors mb-4"
            />
            <button
              onClick={generatePreview}
              disabled={loading}
              className="w-full bg-gold text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate free preview'}
            </button>
            <a
              href={`/generate?preset=stellar&url=${encodeURIComponent(url)}`}
              className="mt-3 block w-full text-center border border-gold text-gold font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:bg-gold/10 transition-colors"
            >
              Get the signed version ($29)
            </a>
            <p className="text-[10px] text-zinc-600 mt-3">
              Free preview is watermarked and client-side. Signed version consumes 1 generation credit from your existing Starter or Launch pack.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <canvas ref={canvasRef} className="hidden" />
            {preview ? (
              <img src={preview} alt="Stellar Seal Star Map preview" className="w-full max-w-md border border-zinc-800 rounded-2xl shadow-2xl" />
            ) : (
              <div className="w-full max-w-md aspect-square bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600 text-sm">
                Preview appears here
              </div>
            )}
            {preview && (
              <a
                href={preview}
                download="qron-stellar-seal-preview.png"
                className="mt-4 text-[10px] font-black uppercase tracking-widest text-gold hover:underline"
              >
                Download watermarked preview
              </a>
            )}
          </div>
        </div>

        <section className="mt-20 space-y-6 text-zinc-400">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">How it works</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Enter any URL or product ID.</li>
            <li>Instant watermarked star-map Living QR preview (client-side, $0 cost).</li>
            <li>Claim the signed version for editable redirect, high-res export, and AuthiChain certificate path.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-4">FAQ</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-bold text-white">Does the free preview scan?</p>
              <p className="text-zinc-500">Yes. It resolves to a holding page with the claim CTA.</p>
            </div>
            <div>
              <p className="font-bold text-white">Is this a new product?</p>
              <p className="text-zinc-500">No. Stellar Seal is a premium style unlocked on your existing Starter or Launch pack. It consumes 1 generation credit.</p>
            </div>
            <div>
              <p className="font-bold text-white">Can I use it on packaging?</p>
              <p className="text-zinc-500">Yes. Paid export is print-ready. Free version is watermarked for preview only.</p>
            </div>
          </div>
        </section>

        <p className="mt-12 text-[10px] text-zinc-600 uppercase tracking-widest">
          No public performance numbers yet. We publish resolve-time and scan-success distributions after the first 100 signed Stellar Seals.
        </p>
      </div>
    </div>
  );
}
