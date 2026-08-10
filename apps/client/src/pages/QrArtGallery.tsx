import { useState, useEffect, useCallback } from "react";

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

export default function QrArtGallery() {
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
    document.body.style.overflow = lightbox !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  return (
    <div style={{ background: "#020204", minHeight: "100vh", color: "#ddddf0", fontFamily: "'Inter', sans-serif", overflowX: "hidden" }}>

      {/* Noise overlay */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")", pointerEvents: "none", zIndex: 999, opacity: 0.5 }} />

      {/* Header */}
      <header style={{ padding: "72px 40px 56px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)", width: 700, height: 500, background: "radial-gradient(ellipse,rgba(120,80,255,0.05) 0%,transparent 70%)", pointerEvents: "none" }} />
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.35em", color: "#55556a", textTransform: "uppercase", marginBottom: 18 }}>
          <span style={{ color: "#a78bfa" }}>▲</span> QRON × AUTHICHAIN &nbsp;·&nbsp; QR ART ENGINE &nbsp;·&nbsp; HF SD1.5 + QR CONTROLNET &nbsp;<span style={{ color: "#a78bfa" }}>▲</span>
        </p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(52px,8vw,110px)", letterSpacing: "0.04em", lineHeight: 0.9, background: "linear-gradient(135deg,#fff 0%,#9090b0 60%,#fff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 6 }}>
          QR ART
        </h1>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(14px,2.5vw,26px)", letterSpacing: "0.3em", color: "#55556a", marginBottom: 40 }}>
          MODEL A SERIES — 10 INDUSTRIES
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {["HF SD1.5 + ControlNet QR", "10/10 Successful", "H-ECC Scannable", "Polygon Mint-Ready"].map((label) => (
            <div key={label} style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.15em", padding: "5px 14px", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", borderRadius: 2 }}>
              {label}
            </div>
          ))}
        </div>
      </header>

      {/* Gallery grid */}
      <div style={{ padding: "48px 32px", maxWidth: 1400, margin: "0 auto" }}>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "#55556a", textTransform: "uppercase", marginBottom: 32, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          // 10 Industry QR Art Pieces — Click to expand
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
          {INDUSTRIES.map((item, i) => (
            <div
              key={item.num}
              onClick={() => setLightbox(i)}
              style={{ cursor: "pointer", animation: `fadeUp 0.5s ease ${i * 0.05}s both` }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#55556a" }}>{item.num}</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.06em", color: item.color }}>{item.name}</span>
                <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "#55556a", textTransform: "uppercase", marginLeft: "auto" }}>{item.sector}</span>
              </div>

              <div style={{ position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ position: "absolute", top: 10, left: 10, zIndex: 3, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: "0.15em", padding: "4px 10px", borderRadius: 1, color: "#a78bfa" }}>
                  MODEL A
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${item.color},transparent)` }} />
                <img
                  src={item.img}
                  alt={`${item.name} QR Art`}
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", transition: "transform 0.4s ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                />
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: "0.1em", padding: "3px 8px", border: "1px solid rgba(255,255,255,0.07)", color: "#a78bfa" }}>{item.params}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: "0.1em", padding: "3px 8px", border: "1px solid rgba(255,255,255,0.07)", color: "#55556a" }}>{item.style}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={closeLightbox}
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(2,2,4,0.96)", backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}
        >
          <button
            onClick={closeLightbox}
            style={{ position: "fixed", top: 20, right: 20, background: "none", border: "1px solid rgba(255,255,255,0.07)", color: "#55556a", fontFamily: "'Space Mono', monospace", fontSize: 10, padding: "8px 14px", cursor: "pointer", zIndex: 9001 }}
          >
            [ ESC ] CLOSE
          </button>

          {/* Prev / Next */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i! - 1 + INDUSTRIES.length) % INDUSTRIES.length); }}
            style={{ position: "fixed", left: 20, top: "50%", transform: "translateY(-50%)", background: "none", border: "1px solid rgba(255,255,255,0.07)", color: "#55556a", fontFamily: "'Space Mono', monospace", fontSize: 10, padding: "10px 14px", cursor: "pointer", zIndex: 9001 }}
          >
            ←
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i! + 1) % INDUSTRIES.length); }}
            style={{ position: "fixed", right: 20, top: "50%", transform: "translateY(-50%)", background: "none", border: "1px solid rgba(255,255,255,0.07)", color: "#55556a", fontFamily: "'Space Mono', monospace", fontSize: 10, padding: "10px 14px", cursor: "pointer", zIndex: 9001 }}
          >
            →
          </button>

          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, width: "100%" }}>
            <div style={{ position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 12, left: 12, fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.2em", padding: "5px 12px", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", color: "#a78bfa", zIndex: 1 }}>
                MODEL A — HF SD1.5 + QR CONTROLNET
              </div>
              <div style={{ position: "absolute", top: 12, right: 12, fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.2em", padding: "5px 12px", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", color: INDUSTRIES[lightbox].color, zIndex: 1 }}>
                {INDUSTRIES[lightbox].num} / {INDUSTRIES[lightbox].name.toUpperCase()}
              </div>
              <img
                src={INDUSTRIES[lightbox].img}
                alt={INDUSTRIES[lightbox].name}
                style={{ width: "100%", maxHeight: "80vh", objectFit: "contain", display: "block" }}
              />
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.06em", color: INDUSTRIES[lightbox].color }}>{INDUSTRIES[lightbox].name}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#55556a", marginLeft: 12 }}>{INDUSTRIES[lightbox].sector}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, padding: "3px 8px", border: "1px solid rgba(255,255,255,0.07)", color: "#a78bfa" }}>{INDUSTRIES[lightbox].params}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, padding: "3px 8px", border: "1px solid rgba(255,255,255,0.07)", color: "#55556a" }}>{INDUSTRIES[lightbox].style}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ padding: "48px 40px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.2em", color: "#55556a", marginBottom: 10 }}>QRON × AUTHICHAIN</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "#55556a", opacity: 0.5, lineHeight: 1.8 }}>
          10 QR ART PIECES · MODEL A · 10 INDUSTRIES · 2026-03-31<br />
          HF huggingface-projects/QR-code-AI-art-generator · SD1.5 + QR ControlNet · Gradio Space<br />
          H-ECC Scannable · Polygon Mint-Ready
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Inter:wght@300;400;500&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
