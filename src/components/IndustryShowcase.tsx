'use client';

import { useState, useEffect, useCallback } from "react";
import Image from 'next/image';

const INDUSTRIES = [
  {
    num: "01",
    name: "QRON Space",
    sector: "Tech / Web3",
    url: "qron.space",
    color: "#00D4FF",
    img: "/gallery/01_flux_qron_space.png",
    params: "cfg8 · cond1.3 · str0.85",
    style: "Cyberpunk Circuit · Neon Blue",
  },
  {
    num: "02",
    name: "StrainChain",
    sector: "Cannabis / AgTech",
    url: "strainchain.io",
    color: "#00C853",
    img: "/gallery/02_flux_strainchain.png",
    params: "cfg8.5 · cond1.1 · str0.88",
    style: "Bioluminescent Jungle · Sacred Geometry",
  },
  {
    num: "03",
    name: "AuthiChain",
    sector: "Blockchain / Auth",
    url: "authichain.com",
    color: "#C9A227",
    img: "/gallery/03_flux_authichain.png",
    params: "cfg7.5 · cond1.2 · str0.87",
    style: "Renaissance Marble · Baroque Gold",
  },
  {
    num: "04",
    name: "EV Industry",
    sector: "Electric Automotive",
    url: "ev-industry.ai",
    color: "#3D5AFE",
    img: "/gallery/04_flux_ev_industry.png",
    params: "cfg9 · cond1.3 · str0.90",
    style: "Plasma Lightning · Chrome Supercar",
  },
  {
    num: "05",
    name: "MedChain",
    sector: "Healthcare / BioTech",
    url: "medchain.health",
    color: "#00BCD4",
    img: "/gallery/05_flux_medchain.png",
    params: "cfg7 · cond1.1 · str0.85",
    style: "DNA Helix · Electron Microscope",
  },
  {
    num: "06",
    name: "Haute Couture",
    sector: "Luxury Fashion",
    url: "luxury.fashion",
    color: "#FFD700",
    img: "/gallery/06_flux_haute_couture.png",
    params: "cfg7.5 · cond1.2 · str0.87",
    style: "Art Deco Gold · Black Obsidian Velvet",
  },
  {
    num: "07",
    name: "Artisan Roasters",
    sector: "Food & Beverage",
    url: "artisan.coffee",
    color: "#D4720A",
    img: "/gallery/07_flux_artisan_roasters.png",
    params: "cfg8 · cond1.0 · str0.83",
    style: "Espresso Macro · Impressionist Warmth",
  },
  {
    num: "08",
    name: "PropChain",
    sector: "Real Estate / PropTech",
    url: "propchain.io",
    color: "#5C7CFF",
    img: "/gallery/08_flux_propchain.png",
    params: "cfg7.5 · cond1.2 · str0.87",
    style: "Blueprint Lines · Skyline Gold",
  },
  {
    num: "09",
    name: "StreamVault",
    sector: "Entertainment / Media",
    url: "streamvault.tv",
    color: "#E53935",
    img: "/gallery/09_flux_streamvault.png",
    params: "cfg8.5 · cond1.1 · str0.88",
    style: "Film Noir · Crimson Velvet Cinema",
  },
  {
    num: "10",
    name: "AthleteDAO",
    sector: "Sports / Performance",
    url: "athletedao.io",
    color: "#FF6F00",
    img: "/gallery/10_flux_athletedao.png",
    params: "cfg9 · cond1.3 · str0.90",
    style: "Kinetic Motion · Stadium Floodlights",
  },
];

export default function IndustryShowcase() {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight" && lightbox !== null)
        setLightbox((i) => (i! + 1) % INDUSTRIES.length);
      if (e.key === "ArrowLeft" && lightbox !== null)
        setLightbox((i) => (i! - 1 + INDUSTRIES.length) % INDUSTRIES.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, closeLightbox]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = lightbox !== null ? "hidden" : "";
    }
    return () => { 
      if (typeof document !== 'undefined') {
        document.body.style.overflow = ""; 
      }
    };
  }, [lightbox]);

  return (
    <div className="min-h-screen bg-[#020204] text-[#ddddf0] font-sans overflow-x-hidden selection:bg-purple-500/30">
      {/* Noise overlay */}
      <div className="fixed inset-0 pointer-events-none z-[999] opacity-50 bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.035\'/%3E%3C/svg%3E')]" />

      {/* Header */}
      <header className="px-10 pt-[72px] pb-[56px] text-center border-b border-white/10 relative overflow-hidden">
        <div className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse,rgba(120,80,255,0.05)_0%,transparent_70%)] pointer-events-none" />
        <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#55556a] mb-[18px]">
          <span className="text-[#a78bfa]">▲</span> QRON × AUTHICHAIN &nbsp;·&nbsp; QR ART ENGINE &nbsp;·&nbsp; HF SD1.5 + QR CONTROLNET &nbsp;<span className="text-[#a78bfa]">▲</span>
        </p>
        <h1 className="font-bebas text-[clamp(52px,8vw,110px)] tracking-[0.04em] leading-[0.9] bg-[linear-gradient(135deg,#fff_0%,#9090b0_60%,#fff_100%)] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [background-clip:text] mb-[6px] uppercase font-black">
          QR ART
        </h1>
        <p className="font-bebas text-[clamp(14px,2.5vw,26px)] tracking-[0.3em] text-[#55556a] mb-10 uppercase">
          MODEL A SERIES — 10 INDUSTRIES
        </p>
        <div className="flex justify-center gap-[10px] flex-wrap">
          {["HF SD1.5 + ControlNet QR", "10/10 Successful", "H-ECC Scannable", "Polygon Mint-Ready"].map((label) => (
            <div key={label} className="font-mono text-[9px] tracking-[0.15em] px-[14px] py-[5px] border border-[#a78bfa]/30 text-[#a78bfa] rounded-[2px]">
              {label}
            </div>
          ))}
        </div>
      </header>

      {/* Gallery grid */}
      <div className="px-8 py-[48px] max-w-[1400px] mx-auto">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#55556a] mb-8 pb-[10px] border-b border-white/10">
          // 10 Industry QR Art Pieces — Click to expand
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {INDUSTRIES.map((item, i) => (
            <div
              key={item.num}
              onClick={() => setLightbox(i)}
              className="cursor-pointer group animate-fade-up"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
            >
              <div className="flex items-baseline gap-[10px] mb-[10px]">
                <span className="font-mono text-[10px] text-[#55556a]">{item.num}</span>
                <span className="font-bebas text-[22px] tracking-[0.06em] uppercase font-black" style={{ color: item.color }}>{item.name}</span>
                <span className="text-[9px] tracking-[0.15em] text-[#55556a] uppercase ml-auto">{item.sector}</span>
              </div>

              <div className="relative overflow-hidden border border-white/10 aspect-square">
                <div className="absolute top-[10px] left-[10px] z-[3] bg-black/75 backdrop-blur-[6px] font-mono text-[8px] tracking-[0.15em] px-[10px] py-[4px] rounded-[1px] text-[#a78bfa]">
                  MODEL A
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg,${item.color},transparent)` }} />
                <Image
                  src={item.img}
                  alt={`${item.name} QR Art`}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover block transition-transform duration-[0.4s] group-hover:scale-[1.03]"
                />
              </div>

              <div className="flex gap-[6px] mt-2 flex-wrap">
                <div className="font-mono text-[8px] tracking-[0.1em] px-[8px] py-[3px] border border-white/10 text-[#a78bfa]">{item.params}</div>
                <div className="font-mono text-[8px] tracking-[0.1em] px-[8px] py-[3px] border border-white/10 text-[#55556a]">{item.style}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={closeLightbox}
          className="fixed inset-0 z-[9000] bg-[#020204]/95 backdrop-blur-[24px] flex items-center justify-center p-8"
        >
          <button
            onClick={closeLightbox}
            className="fixed top-5 right-5 bg-none border border-white/10 text-[#55556a] font-mono text-[10px] px-[14px] py-2 cursor-pointer z-[9001] hover:text-white transition-colors"
          >
            [ ESC ] CLOSE
          </button>

          {/* Prev / Next */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i! - 1 + INDUSTRIES.length) % INDUSTRIES.length); }}
            className="fixed left-5 top-1/2 -translate-y-1/2 bg-none border border-white/10 text-[#55556a] font-mono text-[10px] px-[14px] py-[10px] cursor-pointer z-[9001] hover:text-white transition-colors"
          >
            ←
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i! + 1) % INDUSTRIES.length); }}
            className="fixed right-5 top-1/2 -translate-y-1/2 bg-none border border-white/10 text-[#55556a] font-mono text-[10px] px-[14px] py-[10px] cursor-pointer z-[9001] hover:text-white transition-colors"
          >
            →
          </button>

          <div onClick={(e) => e.stopPropagation()} className="max-w-[700px] w-full">
            <div className="relative overflow-hidden aspect-square border border-white/10">
              <div className="absolute top-3 left-3 font-mono text-[9px] tracking-[0.2em] px-3 py-[5px] bg-black/80 backdrop-blur-[8px] text-[#a78bfa] z-[1]">
                MODEL A — HF SD1.5 + QR CONTROLNET
              </div>
              <div 
                className="absolute top-3 right-3 font-mono text-[9px] tracking-[0.2em] px-3 py-[5px] bg-black/80 backdrop-blur-[8px] z-[1]"
                style={{ color: INDUSTRIES[lightbox].color }}
              >
                {INDUSTRIES[lightbox].num} / {INDUSTRIES[lightbox].name.toUpperCase()}
              </div>
              <Image
                src={INDUSTRIES[lightbox].img}
                alt={INDUSTRIES[lightbox].name}
                width={700}
                height={700}
                className="w-full h-auto max-h-[80vh] object-contain block"
              />
            </div>
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-bebas text-2xl tracking-[0.06em] uppercase font-black" style={{ color: INDUSTRIES[lightbox].color }}>{INDUSTRIES[lightbox].name}</span>
                <span className="font-mono text-[9px] text-[#55556a] ml-3 uppercase">{INDUSTRIES[lightbox].sector}</span>
              </div>
              <div className="flex gap-[6px] flex-wrap">
                <div className="font-mono text-[8px] px-2 py-[3px] border border-white/10 text-[#a78bfa]">{INDUSTRIES[lightbox].params}</div>
                <div className="font-mono text-[8px] px-2 py-[3px] border border-white/10 text-[#55556a]">{INDUSTRIES[lightbox].style}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-10 py-12 text-center border-t border-white/10">
        <div className="font-bebas text-[22px] tracking-[0.2em] text-[#55556a] mb-[10px] uppercase font-black">QRON × AUTHICHAIN</div>
        <div className="font-mono text-[9px] tracking-[0.12em] text-[#55556a] opacity-50 leading-[1.8]">
          10 QR ART PIECES · MODEL A · 10 INDUSTRIES · 2026-03-31<br />
          HF huggingface-projects/QR-code-AI-art-generator · SD1.5 + QR ControlNet · Gradio Space<br />
          H-ECC Scannable · Polygon Mint-Ready
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Inter:wght@300;400;500&display=swap');
        
        .font-bebas {
          font-family: 'Bebas Neue', sans-serif;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-up {
          animation: fade-up 0.5s ease;
        }
      `}</style>
    </div>
  );
}
