import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { EcosystemNav } from "@/components/EcosystemNav";
import { Reveal, GlowCard, ANIMATION_STYLES } from "@/lib/animations";
import {
  QrCode, Sparkles, Layers, Share2, Palette, Zap,
  ArrowRight, CheckCircle2, Eye, Wand2, Shield, Scan, ChevronDown,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Animated counter hook ─── */
function useAnimCounter(target: number, suffix = "", prefix = "") {
  const [display, setDisplay] = useState(prefix + "0" + suffix);
  const ref = useRef<HTMLDivElement>(null);
  const ran = useRef(false);
  const go = useCallback(() => {
    if (ran.current) return;
    ran.current = true;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / 2000, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(prefix + Math.round(e * target) + suffix);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, suffix, prefix]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { go(); io.unobserve(el); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [go]);
  return { display, ref };
}

/* ─── Data ─── */
const stats = [
  { value: "~25%", label: "Scan Lift vs Plain QR" },
  { value: "100%", label: "Scan Guarantee" },
  { value: "<3s", label: "Generation Time" },
  { value: "Ed25519", label: "Cryptographic Signing" },
];

const modes = [
  { icon: Palette, title: "Static Mode", desc: "Classic AI QR art. Perfect for print, packaging, and social media. High-res PNG output with maximum scan reliability." },
  { icon: Eye, title: "Stereographic Mode", desc: "Depth-layered QR art with parallax perception. Creates a dimensional illusion that draws the eye and demands a scan." },
  { icon: Sparkles, title: "Holographic Mode", desc: "Iridescent, light-reactive QR surfaces. Premium visual that shifts color based on angle \u2014 digital luxury for physical products." },
  { icon: Layers, title: "Memory Mode", desc: "Time-evolving QR art that changes on revisit. Creates curiosity loops that drive repeat engagement and loyalty." },
  { icon: Shield, title: "Enterprise Mode", desc: "Batch generation with brand templates. White-label QR art at scale with API access and AuthiChain verification dashboard." },
  { icon: Wand2, title: "Custom Prompt", desc: "Full creative control. Describe any visual concept and watch AI transform it into a scannable, signed QRON masterpiece." },
];

const steps = [
  { num: "01", title: "Enter URL + Prompt", desc: "Paste your destination URL and describe the visual you want. Choose a style preset or go fully custom." },
  { num: "02", title: "AI Generation", desc: "Fal.ai\u2019s illusion-diffusion model renders your QR art, optimizing for both visual impact and scan reliability." },
  { num: "03", title: "Cryptographic Signing", desc: "AuthiChain signs your QRON with an Ed25519 key pair. The signature is embedded in the QR payload itself." },
  { num: "04", title: "Deploy Anywhere", desc: "Download as high-res PNG. Print on packaging, share on social, embed in emails \u2014 your QRON works everywhere." },
];

const ecosystem = [
  { name: "AuthiChain", href: "https://authichain.com", desc: "The truth layer. Blockchain-verified product authentication with AI-powered image analysis.", live: true },
  { name: "StrainChain", href: "https://strainchain.io", desc: "Cannabis provenance. Seed-to-sale verification with NFT certificates and $QRON rewards.", live: true },
  { name: "GovChain", href: "https://govchain.us", desc: "Sovereign verification. Made in USA manufacturer authentication for government and defense.", live: true },
];

const pricing = [
  { name: "Single QRON", price: "$5", period: "/code", paymentLink: "https://buy.stripe.com/dRmcN5drH5xc5ia6ji1Nu3x", features: ["One AI-generated QR code", "Ed25519 cryptographic signing", "High-res PNG download", "Unlimited scans", "Basic style presets"] },
  { name: "Creator Pack", price: "$49", period: "/mo", paymentLink: "https://buy.stripe.com/8x2cN53R77Fk9yq0YY1Nu3u", features: ["25 QRONs per month", "All visual modes", "Custom prompt engine", "Brand color matching", "Priority generation queue", "Gallery listing"], highlighted: true },
  { name: "Enterprise", price: "$199", period: "/mo", paymentLink: "https://buy.stripe.com/28E4gzbjze3I7qi4ba1Nu3s", features: ["Unlimited QRONs", "Batch generation API", "White-label output", "Brand template system", "Analytics dashboard", "Dedicated support"] },
];

/* ─── Stat Item ─── */
function StatItem({ value, label }: { value: string; label: string }) {
  const scanLift = useAnimCounter(25, "%", "~");
  const scanGuarantee = useAnimCounter(100, "%");
  if (value === "~25%") return (
    <div className="text-center" ref={scanLift.ref}>
      <div className="text-3xl md:text-4xl font-bold qron-gradient stat-glow number-ticker">{scanLift.display}</div>
      <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest">{label}</div>
    </div>
  );
  if (value === "100%") return (
    <div className="text-center" ref={scanGuarantee.ref}>
      <div className="text-3xl md:text-4xl font-bold qron-gradient stat-glow number-ticker">{scanGuarantee.display}</div>
      <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest">{label}</div>
    </div>
  );
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold qron-gradient stat-glow">{value}</div>
      <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest">{label}</div>
    </div>
  );
}

/* ─── Component ─── */
export default function QronHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "QRON \u2014 AI-Powered QR Code Art Studio";
  }, []);

  const go = (path: string) => {
    user ? setLocation(path) : (window.location.href = getLoginUrl());
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <style>{ANIMATION_STYLES}{`
        .qron-gradient{background:linear-gradient(135deg,hsl(271 81% 56%),hsl(187 92% 41%));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .orb-1{width:600px;height:600px;top:-200px;left:-100px;background:radial-gradient(circle,hsl(271 81% 56%/.35),transparent 70%);animation:orbDrift1 18s ease-in-out infinite,orbPulse 8s ease-in-out infinite}
        .orb-2{width:500px;height:500px;bottom:-150px;right:-100px;background:radial-gradient(circle,hsl(187 92% 41%/.3),transparent 70%);animation:orbDrift2 22s ease-in-out infinite,orbPulse 10s ease-in-out infinite 2s}
        .orb-3{width:350px;height:350px;top:40%;left:60%;background:radial-gradient(circle,hsl(280 70% 45%/.2),transparent 70%);animation:orbDrift3 25s ease-in-out infinite,orbPulse 12s ease-in-out infinite 4s}
        .qron-glow{box-shadow:0 0 40px hsl(271 81% 56%/.15)}
        .qron-pulse{animation:pulseGlow 3s ease-in-out infinite}
        @keyframes qronPulseGlow{0%,100%{box-shadow:0 0 20px 0 hsl(271 81% 56%/.15)}50%{box-shadow:0 0 40px 8px hsl(271 81% 56%/.25)}}
        .qron-pulse{animation:qronPulseGlow 3s ease-in-out infinite}
      `}</style>

      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />

      {/* Particles */}
      <div className="particle" style={{ top: "18%", left: "10%", "--px": "15px", "--py": "-20px", "--dur": "3.8s", "--del": "0s", background: "hsl(271 81% 56%/.5)" } as React.CSSProperties} />
      <div className="particle" style={{ top: "30%", right: "15%", "--px": "-12px", "--py": "14px", "--dur": "4.5s", "--del": "1.2s", background: "hsl(187 92% 41%/.5)" } as React.CSSProperties} />
      <div className="particle" style={{ top: "55%", left: "20%", "--px": "10px", "--py": "-18px", "--dur": "5s", "--del": "0.8s", background: "hsl(271 81% 56%/.4)" } as React.CSSProperties} />
      <div className="particle" style={{ top: "70%", right: "25%", "--px": "-8px", "--py": "12px", "--dur": "4s", "--del": "2s", background: "hsl(187 92% 41%/.4)" } as React.CSSProperties} />

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode className="h-6 w-6 text-[hsl(271,81%,56%)]" />
            <span className="text-lg font-bold tracking-tight qron-gradient">QRON</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#modes" className="hover:text-foreground transition-colors">Modes</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => setLocation("/qr-codes")} size="sm" className="bg-[hsl(271,81%,56%)] hover:bg-[hsl(271,81%,46%)]">
                Studio <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => go("/qr-codes")}>Sign in</Button>
                <Button size="sm" className="bg-[hsl(271,81%,56%)] hover:bg-[hsl(271,81%,46%)]" onClick={() => go("/qr-codes")}>
                  Open Studio <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(271_81%_56%_/_0.06),transparent_60%)]" />
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="hero-enter inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[hsl(271,81%,56%)]/30 bg-[hsl(271,81%,56%)]/5 text-[hsl(271,81%,56%)] text-xs font-medium tracking-wide uppercase mb-8">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(271,81%,56%)] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(271,81%,56%)]" /></span>
              AI Art + Cryptographic Truth
            </div>
            <h1 className="hero-enter hero-enter-delay-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
              QR Codes That{" "}
              <span className="qron-gradient animated-gradient" style={{ backgroundImage: "linear-gradient(135deg, hsl(271 81% 56%), hsl(187 92% 41%), hsl(280 70% 45%), hsl(271 81% 56%))", backgroundSize: "200% 200%" }}>Demand Attention</span>
            </h1>
            <p className="hero-enter hero-enter-delay-2 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Transform boring QR codes into cryptographically signed AI art. Every QRON is a scannable masterpiece backed by Ed25519 cryptographic proof.
            </p>
            <div className="hero-enter hero-enter-delay-3 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 bg-[hsl(271,81%,56%)] hover:bg-[hsl(271,81%,46%)] qron-pulse" onClick={() => go("/qr-codes")}>
                Create a QRON <Sparkles className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" onClick={() => go("/gallery")}>
                View Gallery &rarr;
              </Button>
            </div>
            <div className="hero-enter hero-enter-delay-4 mt-12">
              <ChevronDown className="h-6 w-6 text-muted-foreground/50 mx-auto scroll-indicator" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <Reveal>
        <section className="relative z-10 border-y border-border/40 bg-card/30 backdrop-blur-sm">
          <div className="container py-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((s) => <StatItem key={s.label} {...s} />)}
            </div>
          </div>
        </section>
      </Reveal>

      <div className="section-divider shimmer-line h-px" style={{ background: "linear-gradient(90deg,transparent,hsl(271 81% 56%/.3),transparent)" }} />

      {/* ── Visual Modes ── */}
      <section id="modes" className="relative z-10 py-24">
        <div className="container">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-[hsl(271,81%,56%)] font-semibold mb-3">Visual Modes</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Six Ways to Create</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Choose your visual mode and let AI transform your QR code into something extraordinary.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modes.map((m, i) => (
              <Reveal key={m.title} delay={i * 80}>
                <GlowCard className="glass-card rounded-xl p-6 hover:border-[hsl(271,81%,56%)]/30 transition-all group h-full tilt-card border-glow-hover">
                  <div className="h-10 w-10 rounded-lg bg-[hsl(271,81%,56%)]/10 flex items-center justify-center mb-4 group-hover:bg-[hsl(271,81%,56%)]/20 transition-colors">
                    <m.icon className="h-5 w-5 text-[hsl(271,81%,56%)]" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider shimmer-line h-px" style={{ background: "linear-gradient(90deg,transparent,hsl(187 92% 41%/.3),transparent)" }} />

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 py-24 border-t border-border/40">
        <div className="container">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-[hsl(271,81%,56%)] font-semibold mb-3">Process</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">URL to Art in 4 Steps</h2>
              <p className="text-muted-foreground max-w-lg text-lg">From concept to cryptographically signed QR art in under 30 seconds.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5">
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 120}>
                <GlowCard className="glass-card rounded-xl p-6 hover:border-[hsl(271,81%,56%)]/30 transition-all group h-full tilt-card">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-lg bg-[hsl(271,81%,56%)]/10 flex items-center justify-center shrink-0 group-hover:bg-[hsl(271,81%,56%)]/20 transition-colors animate-float" style={{ animationDelay: `${i * 0.5}s` }}>
                      <span className="text-sm font-bold text-[hsl(271,81%,56%)]">{s.num}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1.5">{s.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ecosystem ── */}
      <section className="relative z-10 py-24 border-t border-border/40">
        <div className="container">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-[hsl(271,81%,56%)] font-semibold mb-3">Ecosystem</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Part of the AuthiChain Protocol</h2>
              <p className="text-muted-foreground max-w-lg text-lg">QRON powers the visual identity layer of the AuthiChain ecosystem.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4">
            {ecosystem.map((e, i) => (
              <Reveal key={e.name} delay={i * 100} direction={i % 2 === 0 ? "left" : "right"}>
                <a href={e.href} className="glass-card rounded-xl p-5 hover:border-[hsl(271,81%,56%)]/30 transition-all group block h-full tilt-card" target="_blank" rel="noopener noreferrer">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <span className="text-[hsl(271,81%,56%)]">&#9670;</span> {e.name}
                    {e.live && <span className="text-[10px] bg-[hsl(271,81%,56%)] text-white px-2 py-0.5 rounded font-bold tracking-wide animate-pulse">LIVE</span>}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{e.desc}</p>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider shimmer-line h-px" style={{ background: "linear-gradient(90deg,transparent,hsl(271 81% 56%/.3),transparent)" }} />

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-24 border-t border-border/40">
        <div className="container">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-[hsl(271,81%,56%)] font-semibold mb-3">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Create at Any Scale</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">From a single QRON to enterprise batch generation. Every code is cryptographically signed.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {pricing.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 120}>
                <GlowCard className={`rounded-xl p-6 border h-full flex flex-col tilt-card ${plan.highlighted ? "border-[hsl(271,81%,56%)]/50 bg-[hsl(271,81%,56%)]/5 qron-pulse" : "border-border glass-card"}`}>
                  <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-[hsl(271,81%,56%)] mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full ${plan.highlighted ? "bg-[hsl(271,81%,56%)] hover:bg-[hsl(271,81%,46%)]" : ""}`} variant={plan.highlighted ? "default" : "outline"} onClick={() => window.open(plan.paymentLink, "_blank")}>
                    {plan.highlighted ? "Buy Now" : "Get Started"}
                  </Button>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-28">
        <div className="container">
          <Reveal direction="scale" className="text-center">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Create Art That{" "}
              <span className="qron-gradient animated-gradient" style={{ backgroundImage: "linear-gradient(135deg, hsl(271 81% 56%), hsl(187 92% 41%), hsl(280 70% 45%), hsl(271 81% 56%))", backgroundSize: "200% 200%" }}>Scans.</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">Every QRON is a cryptographically signed masterpiece. Start creating in seconds.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 bg-[hsl(271,81%,56%)] hover:bg-[hsl(271,81%,46%)] qron-pulse" onClick={() => go("/qr-codes")}>
                Open QRON Studio <Sparkles className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" asChild>
                <a href="mailto:authichain@gmail.com">Enterprise Inquiry &rarr;</a>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-12 border-t border-border/40">
        <div className="container space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-[hsl(271,81%,56%)]" />
              <span className="font-bold qron-gradient">QRON</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">AI-Powered QR Code Art Studio. Part of the AuthiChain Protocol.</p>
          </div>
          <div className="pt-4 border-t border-border/40"><EcosystemNav /></div>
          <p className="text-center text-xs text-muted-foreground/60">&copy; 2026 QRON by AuthiChain, Inc.</p>
        </div>
      </footer>
    </div>
  );
}
