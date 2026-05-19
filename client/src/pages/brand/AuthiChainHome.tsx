import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { EcosystemNav } from "@/components/EcosystemNav";
import { Reveal, GlowCard, ANIMATION_STYLES } from "@/lib/animations";
import { Shield, ArrowRight, CheckCircle2, Zap, Globe, Lock,
  BarChart3, Bot, Gem, QrCode, Truck, Mail,
  Cpu, Scan, Fingerprint, Layers, Eye, ChevronDown } from "lucide-react";
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
  { value: "99.7%", label: "Verification Accuracy", counter: true, num: 99, suffix: ".7%" },
  { value: "<2s", label: "Scan-to-Truth", counter: false },
  { value: "Ed25519", label: "Cryptographic Signing", counter: false },
  { value: "\u221E", label: "Immutable Records", counter: false },
];

const stack = [
  { icon: Fingerprint, num: "01", title: "TrueMark Seal", desc: "Ed25519-signed digital seal anchored to the blockchain. Each product receives a unique TrueMark ID that cannot be forged or duplicated." },
  { icon: QrCode, num: "02", title: "QRON Identity", desc: "AI-generated QR art fused with cryptographic payload. Beautiful enough for packaging, powerful enough for forensic verification." },
  { icon: Cpu, num: "03", title: "AutoFlow Engine", desc: "Cloudflare-native workflow engine that processes authentication events at edge speed. Real-time verification with zero cold starts." },
  { icon: BarChart3, num: "04", title: "Operator Console", desc: "Enterprise dashboard for managing product registrations, monitoring scan activity, and generating compliance reports at scale." },
];

const features = [
  { icon: Shield, title: "AI Authentication", desc: "Blockchain-verified product authentication with AI-powered image analysis and confidence scoring." },
  { icon: QrCode, title: "QR Verification", desc: "Generate and scan QR codes for instant product verification certificates." },
  { icon: Gem, title: "NFT Marketplace", desc: "Auctions, collections, rarity scoring, and IPFS storage for digital authenticity tokens." },
  { icon: Bot, title: "AI Autopilot", desc: "Automated decision engine for email outreach, lead qualification, and social engagement." },
  { icon: Truck, title: "Supply Chain", desc: "End-to-end tracking with IoT monitoring and blockchain verification at every checkpoint." },
  { icon: Mail, title: "Email Campaigns", desc: "AI-generated content with SendGrid integration, approval workflows, and A/B testing." },
  { icon: Lock, title: "Crypto Payments", desc: "Stripe + NOWPayments integration with escrow system and automated billing." },
  { icon: BarChart3, title: "Admin Analytics", desc: "Revenue analytics, fraud detection, customer health scoring, and enterprise reporting." },
  { icon: Globe, title: "White Label", desc: "Custom branding, API access, and enterprise solutions for your clients." },
];

const ecosystem = [
  { name: "QRON Studio", href: "https://qron.space", desc: "AI-powered QR code art generator. Create cryptographically signed, brand-level scannable art in seconds.", live: true },
  { name: "StrainChain", href: "https://strainchain.io", desc: "Cannabis provenance on the blockchain. Seed-to-sale verification with NFT certificates and $QRON rewards.", live: true },
  { name: "GovChain", href: "https://govchain.us", desc: "Sovereign document verification for government and defense. Made in USA manufacturer tracking with military-grade QRON authentication.", live: true },
  { name: "Enterprise API", href: "#", desc: "White-label authentication infrastructure for any industry vertical. Full REST API with Ed25519 signing and compliance tooling.", live: false },
];

const pricing = [
  { name: "Starter", price: "$49", period: "/mo", features: ["100 authentications/month", "Basic AI analysis", "QR code generation", "Certificate issuance", "Email support"] },
  { name: "Professional", price: "$149", period: "/mo", features: ["1,000 authentications/month", "Advanced AI + blockchain", "NFT marketplace access", "Supply chain tracking", "AI Autopilot", "Email campaigns"], highlighted: true },
  { name: "Enterprise", price: "$499", period: "/mo", features: ["10,000 authentications/month", "White-label solutions", "Custom API access", "Advanced analytics", "Dedicated account manager", "SLA guarantee"] },
];

/* ─── Stat Item (with optional counter) ─── */
function StatItem({ value, label, counter, num, suffix }: { value: string; label: string; counter?: boolean; num?: number; suffix?: string }) {
  const anim = useAnimCounter(num ?? 0, suffix ?? "", "");
  if (counter && num !== undefined) {
    return (
      <div className="text-center" ref={anim.ref}>
        <div className="text-3xl md:text-4xl font-bold gradient-text stat-glow number-ticker">{anim.display}</div>
        <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest">{label}</div>
      </div>
    );
  }
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold gradient-text stat-glow">{value}</div>
      <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest">{label}</div>
    </div>
  );
}

/* ─── Component ─── */
export default function AuthiChainHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "AuthiChain \u2014 The Truth Layer for the Global Economy";
  }, []);

  const go = (path: string) => {
    user ? setLocation(path) : (window.location.href = getLoginUrl());
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <style>{ANIMATION_STYLES}{`
        .orb-1{width:600px;height:600px;top:-200px;left:-100px;background:radial-gradient(circle,hsl(217 91% 50%/.35),transparent 70%);animation:orbDrift1 18s ease-in-out infinite,orbPulse 8s ease-in-out infinite}
        .orb-2{width:500px;height:500px;bottom:-150px;right:-100px;background:radial-gradient(circle,hsl(40 60% 55%/.3),transparent 70%);animation:orbDrift2 22s ease-in-out infinite,orbPulse 10s ease-in-out infinite 2s}
        .orb-3{width:350px;height:350px;top:40%;left:60%;background:radial-gradient(circle,hsl(271 81% 56%/.2),transparent 70%);animation:orbDrift3 25s ease-in-out infinite,orbPulse 12s ease-in-out infinite 4s}
      `}</style>

      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight gradient-text">AUTHICHAIN</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#technology" className="hover:text-foreground transition-colors">Technology</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#ecosystem" className="hover:text-foreground transition-colors">Ecosystem</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => setLocation("/dashboard")} size="sm">Dashboard <ArrowRight className="ml-1 h-4 w-4" /></Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => go("/dashboard")}>Sign in</Button>
                <Button size="sm" onClick={() => go("/dashboard")}>Launch Console <ArrowRight className="ml-1 h-4 w-4" /></Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(217_91%_50%_/_0.06),transparent_60%)]" />
        {/* Particles */}
        <div className="particle" style={{ top: "20%", left: "15%", "--px": "12px", "--py": "-18px", "--dur": "3.5s", "--del": "0s" } as React.CSSProperties} />
        <div className="particle" style={{ top: "35%", right: "20%", "--px": "-15px", "--py": "10px", "--dur": "4.2s", "--del": "1s" } as React.CSSProperties} />
        <div className="particle" style={{ top: "60%", left: "25%", "--px": "8px", "--py": "-22px", "--dur": "5s", "--del": "0.5s" } as React.CSSProperties} />
        <div className="particle" style={{ top: "45%", right: "12%", "--px": "-10px", "--py": "-14px", "--dur": "3.8s", "--del": "2s" } as React.CSSProperties} />
        <div className="particle" style={{ top: "75%", left: "60%", "--px": "18px", "--py": "8px", "--dur": "4.5s", "--del": "1.5s" } as React.CSSProperties} />

        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="hero-enter inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium tracking-wide uppercase mb-8">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-primary" /></span>
              Live on Polygon Mainnet
            </div>
            <h1 className="hero-enter hero-enter-delay-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
              The Truth Layer for the{" "}
              <span className="gradient-text animated-gradient" style={{ backgroundImage: "linear-gradient(135deg, hsl(217 91% 50%), hsl(40 60% 55%), hsl(271 81% 56%), hsl(217 91% 50%))" }}>Global Economy</span>
            </h1>
            <p className="hero-enter hero-enter-delay-2 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              The decentralized authentication protocol that turns physical products into verifiable digital identities. From luxury goods to government assets &mdash; verify everything.
            </p>
            <div className="hero-enter hero-enter-delay-3 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 pulse-glow" onClick={() => go("/dashboard")}>
                Create a QRON <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" asChild>
                <a href="#technology">Explore the Protocol &rarr;</a>
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

      {/* shimmer divider */}
      <div className="section-divider shimmer-line h-px" />

      {/* ── Technology Stack ── */}
      <section id="technology" className="relative z-10 py-24">
        <div className="container">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-primary font-semibold mb-3">Core Technology</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The AuthiChain Stack</h2>
              <p className="text-muted-foreground max-w-lg text-lg">Four layers of cryptographic truth &mdash; from physical seal to immutable ledger.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5">
            {stack.map((s, i) => (
              <Reveal key={s.num} delay={i * 100}>
                <GlowCard className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all group h-full tilt-card border-glow-hover">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors animate-float" style={{ animationDelay: `${i * 0.5}s` }}>
                      <s.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[.15em] text-primary/60 font-semibold mb-1">{s.num}</p>
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

      {/* ── Vision Quote ── */}
      <section className="relative z-10 border-y border-border/40 bg-card/20">
        <div className="container py-20">
          <Reveal direction="scale" className="max-w-2xl mx-auto text-center">
            <blockquote className="text-xl md:text-2xl font-medium italic leading-relaxed text-foreground/90">
              &ldquo;We are building the authentication layer for the physical world. Our product, QRON, transforms physical items into scannable identities.&rdquo;
            </blockquote>
            <p className="mt-5 text-sm font-medium gradient-text">&mdash; Founder&apos;s Vision</p>
          </Reveal>
        </div>
      </section>

      <div className="section-divider shimmer-line h-px" />

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-24">
        <div className="container">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-primary font-semibold mb-3">Platform</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Complete Authentication Ecosystem</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Every tool you need to authenticate products, manage supply chains, and grow your business &mdash; all powered by blockchain and AI.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <GlowCard className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all group h-full tilt-card">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ecosystem ── */}
      <section id="ecosystem" className="relative z-10 py-24 border-t border-border/40">
        <div className="container">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-primary font-semibold mb-3">Ecosystem</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The Authentic Economy</h2>
              <p className="text-muted-foreground max-w-lg text-lg">AuthiChain powers an ecosystem of vertical-specific authentication platforms &mdash; each built on the same truth substrate.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ecosystem.map((e, i) => (
              <Reveal key={e.name} delay={i * 100} direction={i % 2 === 0 ? "left" : "right"}>
                <a href={e.href} className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all group block h-full tilt-card" target={e.href.startsWith("http") ? "_blank" : undefined} rel={e.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <span className="text-primary">&#9670;</span> {e.name}
                    {e.live && <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold tracking-wide animate-pulse">LIVE</span>}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{e.desc}</p>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider shimmer-line h-px" />

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-24 border-t border-border/40">
        <div className="container">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-primary font-semibold mb-3">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Start free, scale as you grow. Every plan includes blockchain verification and AI analysis.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {pricing.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 120}>
                <GlowCard className={`rounded-xl p-6 border h-full flex flex-col tilt-card ${plan.highlighted ? "border-primary/50 bg-primary/5 pulse-glow" : "border-border glass-card"}`}>
                  <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.highlighted ? "default" : "outline"} onClick={() => go("/subscriptions")}>
                    {plan.highlighted ? "Get Started" : "Choose Plan"}
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
              Verify <span className="gradient-text animated-gradient" style={{ backgroundImage: "linear-gradient(135deg, hsl(217 91% 50%), hsl(40 60% 55%), hsl(271 81% 56%), hsl(217 91% 50%))" }}>Everything.</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">Join the protocols building the authentication layer for the physical world.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 pulse-glow" onClick={() => go("/dashboard")}>
                Create Your First QRON <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" asChild>
                <a href="mailto:authichain@gmail.com">Contact Enterprise &rarr;</a>
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
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-bold gradient-text">AUTHICHAIN</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              The Truth Layer for the Global Economy. Authenticity infrastructure for the physical world.
            </p>
          </div>
          <div className="pt-4 border-t border-border/40"><EcosystemNav /></div>
          <p className="text-center text-xs text-muted-foreground/60">&copy; 2026 AuthiChain, Inc.</p>
        </div>
      </footer>
    </div>
  );
}
