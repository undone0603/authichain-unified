import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { EcosystemNav } from "@/components/EcosystemNav";
import { Reveal, GlowCard, ANIMATION_STYLES } from "@/lib/animations";
import {
  Leaf, ArrowRight, CheckCircle2, FileCheck2, Boxes,
  Truck, Gem, Package, Scan, Shield, Zap, Globe,
  Lock, BarChart3, FlaskConical, ChevronDown,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Animated counter ─── */
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
  { value: "Seed\u2192Sale", label: "Full Provenance" },
  { value: "METRC", label: "Compliance Ready" },
  { value: "Ed25519", label: "Cryptographic Signing" },
  { value: "$QRON", label: "Scan-to-Earn Rewards" },
];

const features = [
  { icon: FileCheck2, title: "Seed-to-Sale Compliance", desc: "METRC and BioTrack integration for cultivators, processors, and dispensaries. Every gram hashed on-chain with tamper-proof provenance." },
  { icon: Leaf, title: "Strain NFTs", desc: "ERC-721 strain identities with THC/CBD basis points, terpene profiles, and lab-cert hashes. Own the genetics, not just the jar." },
  { icon: Package, title: "Bagiez Package Art", desc: "Vintage packaging art NFTs with territory licensing \u2014 70% artist / 20% platform / 10% community treasury on primary sale." },
  { icon: Truck, title: "Dispensary SaaS", desc: "POS-grade inventory management, lab-result QR codes at every SKU, and tamper-evident chain-of-custody for buyers." },
  { icon: Gem, title: "Royalties That Route", desc: "Secondary-sale royalties split automatically between artist, platform, and community treasury via Solidity splitter contracts." },
  { icon: FlaskConical, title: "Lab Verification", desc: "Cryptographically signed lab results anchored to the blockchain. Consumers scan once and see the full COA instantly." },
  { icon: Scan, title: "QRON Authentication", desc: "Every product gets a unique AI-generated QRON code \u2014 beautiful enough for shelf display, powerful enough for forensic verification." },
  { icon: Shield, title: "Anti-Counterfeit", desc: "Blockchain-anchored provenance eliminates gray-market diversion. Each scan event is logged immutably for compliance auditing." },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Real-time scan analytics, geographic heatmaps, consumer engagement metrics, and compliance reporting in one pane." },
];

const stack = [
  { num: "01", title: "METRC Integration", desc: "Direct API integration with state-mandated track-and-trace systems. Automatic manifest sync, transfer reconciliation, and compliance reporting." },
  { num: "02", title: "Strain Identity Protocol", desc: "ERC-721 standard with custom metadata schema for cannabinoid profiles, terpene arrays, and cultivation provenance hashing." },
  { num: "03", title: "QRON Smart Labels", desc: "AuthiChain-verified QR codes generated per-batch with embedded lab results, chain-of-custody data, and consumer verification portal." },
  { num: "04", title: "Royalty Splitter", desc: "Solidity smart contract that automatically routes secondary-sale royalties between artists, platform, and community treasury." },
];

const ecosystem = [
  { name: "AuthiChain", href: "https://authichain.com", desc: "The truth layer. Blockchain-verified product authentication with AI-powered analysis.", live: true },
  { name: "QRON", href: "https://qron.space", desc: "AI-generated QR art studio. Create scannable, cryptographically signed visual codes.", live: true },
  { name: "GovChain", href: "https://govchain.us", desc: "Sovereign verification for government procurement and Made in USA authentication.", live: true },
];

const pricing = [
  { name: "Cultivator", price: "$199", period: "/mo", paymentLink: "https://buy.stripe.com/28E4gzbjze3I7qi4ba1Nu3s", features: ["Up to 500 plants tracked", "METRC sync", "Lab result hashing", "Basic analytics", "QR verification labels"] },
  { name: "Dispensary", price: "$299", period: "/mo", paymentLink: "https://buy.stripe.com/3cIfZhafvbVA3a2ePO1Nu3v", features: ["Unlimited SKU tracking", "POS integration", "Consumer verification portal", "QRON smart labels", "Compliance reporting", "Priority support"], highlighted: true },
  { name: "Enterprise", price: "$799", period: "/mo", paymentLink: "https://buy.stripe.com/6oU5kDfzP7Fk6medLK1Nu3t", features: ["Multi-location management", "White-label portal", "API access", "Strain NFT minting", "Bagiez marketplace", "Dedicated CSM"] },
];

/* ─── Component ─── */
export default function StrainChainHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "StrainChain \u2014 Cannabis Provenance on the Blockchain";
  }, []);

  const go = (path: string) => {
    user ? setLocation(path) : (window.location.href = getLoginUrl());
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <style>{ANIMATION_STYLES}{`
        .strain-gradient{background:linear-gradient(135deg,hsl(142 71% 45%),hsl(40 60% 55%));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .orb-1{width:600px;height:600px;top:-200px;left:-100px;background:radial-gradient(circle,hsl(142 71% 45%/.35),transparent 70%);animation:orbDrift1 18s ease-in-out infinite,orbPulse 8s ease-in-out infinite}
        .orb-2{width:500px;height:500px;bottom:-150px;right:-100px;background:radial-gradient(circle,hsl(40 60% 55%/.3),transparent 70%);animation:orbDrift2 22s ease-in-out infinite,orbPulse 10s ease-in-out infinite 2s}
        .orb-3{width:350px;height:350px;top:40%;left:60%;background:radial-gradient(circle,hsl(160 60% 40%/.2),transparent 70%);animation:orbDrift3 25s ease-in-out infinite,orbPulse 12s ease-in-out infinite 4s}
        .strain-glow{box-shadow:0 0 40px hsl(142 71% 45%/.15)}
        @keyframes strainPulseGlow{0%,100%{box-shadow:0 0 20px 0 hsl(142 71% 45%/.15)}50%{box-shadow:0 0 40px 8px hsl(142 71% 45%/.25)}}
        .strain-pulse{animation:strainPulseGlow 3s ease-in-out infinite}
      `}</style>

      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />

      {/* Particles */}
      <div className="particle" style={{ top: "15%", left: "8%", "--px": "12px", "--py": "-18px", "--dur": "4s", "--del": "0s", background: "hsl(142 71% 45%/.5)" } as React.CSSProperties} />
      <div className="particle" style={{ top: "28%", right: "12%", "--px": "-14px", "--py": "16px", "--dur": "4.8s", "--del": "1s", background: "hsl(40 60% 55%/.5)" } as React.CSSProperties} />
      <div className="particle" style={{ top: "50%", left: "22%", "--px": "10px", "--py": "-14px", "--dur": "5.2s", "--del": "0.6s", background: "hsl(142 71% 45%/.4)" } as React.CSSProperties} />
      <div className="particle" style={{ top: "65%", right: "18%", "--px": "-8px", "--py": "10px", "--dur": "3.6s", "--del": "1.8s", background: "hsl(40 60% 55%/.4)" } as React.CSSProperties} />
      <div className="particle" style={{ top: "80%", left: "40%", "--px": "6px", "--py": "-12px", "--dur": "4.4s", "--del": "2.5s", background: "hsl(160 60% 40%/.35)" } as React.CSSProperties} />

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Leaf className="h-6 w-6 text-[hsl(142,71%,45%)]" />
            <span className="text-lg font-bold tracking-tight strain-gradient">StrainChain</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#protocol" className="hover:text-foreground transition-colors">Protocol</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => setLocation("/dashboard")} size="sm" className="bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,35%)] text-black">
                Dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => go("/dashboard")}>Sign in</Button>
                <Button size="sm" className="bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,35%)] text-black" onClick={() => go("/dashboard")}>
                  Get Started <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(142_71%_45%_/_0.06),transparent_60%)]" />
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="hero-enter inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[hsl(142,71%,45%)]/30 bg-[hsl(142,71%,45%)]/5 text-[hsl(142,71%,45%)] text-xs font-medium tracking-wide uppercase mb-8">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(142,71%,45%)] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(142,71%,45%)]" /></span>
              Blockchain-Verified Cannabis
            </div>
            <h1 className="hero-enter hero-enter-delay-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
              From Seed to Sale,{" "}
              <span className="strain-gradient animated-gradient" style={{ backgroundImage: "linear-gradient(135deg, hsl(142 71% 45%), hsl(40 60% 55%), hsl(160 60% 40%), hsl(142 71% 45%))", backgroundSize: "200% 200%" }}>On-Chain</span>
            </h1>
            <p className="hero-enter hero-enter-delay-2 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Blockchain-anchored provenance for every gram. METRC-compliant tracking, strain NFTs, and cryptographic lab verification \u2014 built for the legal cannabis industry.
            </p>
            <div className="hero-enter hero-enter-delay-3 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,35%)] text-black strain-pulse" onClick={() => go("/supply-chain")}>
                Start Tracking <Leaf className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" onClick={() => go("/nft")}>
                Explore NFTs &rarr;
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
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold strain-gradient stat-glow">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <div className="section-divider shimmer-line h-px" style={{ background: "linear-gradient(90deg,transparent,hsl(142 71% 45%/.3),transparent)" }} />

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-24">
        <div className="container">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-[hsl(142,71%,45%)] font-semibold mb-3">Platform</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Full-Stack Cannabis Infrastructure</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Everything from METRC compliance to NFT marketplaces \u2014 built on blockchain-verified truth.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <GlowCard className="glass-card rounded-xl p-6 hover:border-[hsl(142,71%,45%)]/30 transition-all group h-full tilt-card border-glow-hover">
                  <div className="h-10 w-10 rounded-lg bg-[hsl(142,71%,45%)]/10 flex items-center justify-center mb-4 group-hover:bg-[hsl(142,71%,45%)]/20 transition-colors">
                    <f.icon className="h-5 w-5 text-[hsl(142,71%,45%)] animate-float" style={{ animationDelay: `${i * 0.3}s` }} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider shimmer-line h-px" style={{ background: "linear-gradient(90deg,transparent,hsl(40 60% 55%/.3),transparent)" }} />

      {/* ── Protocol Stack ── */}
      <section id="protocol" className="relative z-10 py-24 border-t border-border/40">
        <div className="container">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-[hsl(142,71%,45%)] font-semibold mb-3">Protocol Stack</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How StrainChain Works</h2>
              <p className="text-muted-foreground max-w-lg text-lg">Four interlocking systems that make cannabis provenance trustworthy.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5">
            {stack.map((s, i) => (
              <Reveal key={s.num} delay={i * 120}>
                <GlowCard className="glass-card rounded-xl p-6 hover:border-[hsl(142,71%,45%)]/30 transition-all group h-full tilt-card">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-lg bg-[hsl(142,71%,45%)]/10 flex items-center justify-center shrink-0 group-hover:bg-[hsl(142,71%,45%)]/20 transition-colors animate-float" style={{ animationDelay: `${i * 0.5}s` }}>
                      <span className="text-sm font-bold text-[hsl(142,71%,45%)]">{s.num}</span>
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
              <p className="text-xs uppercase tracking-[.2em] text-[hsl(142,71%,45%)] font-semibold mb-3">Ecosystem</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Powered by AuthiChain</h2>
              <p className="text-muted-foreground max-w-lg text-lg">StrainChain is the cannabis vertical of the AuthiChain Protocol.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4">
            {ecosystem.map((e, i) => (
              <Reveal key={e.name} delay={i * 100} direction={i % 2 === 0 ? "left" : "right"}>
                <a href={e.href} className="glass-card rounded-xl p-5 hover:border-[hsl(142,71%,45%)]/30 transition-all group block h-full tilt-card" target="_blank" rel="noopener noreferrer">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <span className="text-[hsl(142,71%,45%)]">&#9670;</span> {e.name}
                    {e.live && <span className="text-[10px] bg-[hsl(142,71%,45%)] text-black px-2 py-0.5 rounded font-bold tracking-wide animate-pulse">LIVE</span>}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{e.desc}</p>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider shimmer-line h-px" style={{ background: "linear-gradient(90deg,transparent,hsl(142 71% 45%/.3),transparent)" }} />

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-24 border-t border-border/40">
        <div className="container">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-[hsl(142,71%,45%)] font-semibold mb-3">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Every License Type</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">From single cultivators to multi-state operators. Every plan includes blockchain verification.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {pricing.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 120}>
                <GlowCard className={`rounded-xl p-6 border h-full flex flex-col tilt-card ${plan.highlighted ? "border-[hsl(142,71%,45%)]/50 bg-[hsl(142,71%,45%)]/5 strain-pulse" : "border-border glass-card"}`}>
                  <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-[hsl(142,71%,45%)] mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full ${plan.highlighted ? "bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,35%)] text-black" : ""}`} variant={plan.highlighted ? "default" : "outline"} onClick={() => window.open(plan.paymentLink, "_blank")}>
                    {plan.highlighted ? "Start Now" : "Buy Now"}
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
              Every Gram,{" "}
              <span className="strain-gradient animated-gradient" style={{ backgroundImage: "linear-gradient(135deg, hsl(142 71% 45%), hsl(40 60% 55%), hsl(160 60% 40%), hsl(142 71% 45%))", backgroundSize: "200% 200%" }}>Verified.</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">Blockchain-anchored provenance for the legal cannabis industry. Start verifying today.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,35%)] text-black strain-pulse" onClick={() => go("/supply-chain")}>
                Launch StrainChain <Leaf className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" asChild>
                <a href="mailto:authichain@gmail.com">Partner Inquiry &rarr;</a>
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
              <Leaf className="h-5 w-5 text-[hsl(142,71%,45%)]" />
              <span className="font-bold strain-gradient">StrainChain</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">Cannabis Provenance on the Blockchain. Powered by AuthiChain.</p>
          </div>
          <div className="pt-4 border-t border-border/40"><EcosystemNav /></div>
          <p className="text-center text-xs text-muted-foreground/60">&copy; 2026 StrainChain by AuthiChain, Inc.</p>
        </div>
      </footer>
    </div>
  );
}
