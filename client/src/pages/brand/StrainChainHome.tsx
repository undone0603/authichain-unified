import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { EcosystemNav } from "@/components/EcosystemNav";
import {
  Leaf, ArrowRight, CheckCircle2, FileCheck2, Boxes,
  Truck, Gem, Package, Scan, Shield, Zap, Globe,
  Lock, BarChart3, FlaskConical,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";

/* ─── Scroll-reveal ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("reveal-visible"); io.unobserve(el); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal();
  return <div ref={ref} className={`reveal-hidden ${className}`}>{children}</div>;
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
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Real-time scan analytics, geographic heatmaps, consumer engagement metrics, and compliance reporting for operators." },
];

const journey = [
  { num: "01", title: "Cultivator Registers", desc: "Grower registers strain genetics and facility details. METRC integration pulls harvest data automatically." },
  { num: "02", title: "Lab Certifies", desc: "Testing lab uploads COA with cannabinoid and terpene profiles. Results are Ed25519-signed and anchored on-chain." },
  { num: "03", title: "QRON Generated", desc: "AI creates a unique scannable QRON code fused with the product\u2019s cryptographic identity. Applied to packaging." },
  { num: "04", title: "Consumer Verifies", desc: "End consumer scans the QRON with any camera. Instantly sees full provenance, lab results, and earns $QRON rewards." },
];

const pricing = [
  { name: "Cultivator", price: "$29", period: "/mo", desc: "Single-license cultivators", features: ["50 product registrations/mo", "METRC integration", "Basic QRON codes", "Lab cert anchoring", "Email support"], highlighted: false },
  { name: "Processor", price: "$99", period: "/mo", desc: "Processors & manufacturers", features: ["500 product registrations/mo", "Strain NFT minting", "Bagiez art marketplace", "Royalty routing", "Dispensary SaaS", "Priority support"], highlighted: true },
  { name: "Enterprise", price: "$299", period: "/mo", desc: "Multi-state operators", features: ["Unlimited registrations", "White-label dashboard", "Custom API access", "Advanced analytics", "Compliance reporting", "Dedicated account manager", "SLA guarantee"], highlighted: false },
];

const ecosystem = [
  { name: "AuthiChain", href: "https://authichain.com", desc: "The core authentication protocol. StrainChain is a vertical of the AuthiChain truth substrate." },
  { name: "QRON Studio", href: "https://qron.space", desc: "Create custom AI QR art for your cannabis products. Free tier available." },
  { name: "GovChain", href: "https://govchain.us", desc: "Government-grade verification for sovereign document and manufacturer authentication." },
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
      {/* ── Cinematic styles ── */}
      <style>{`
        .reveal-hidden{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease}
        .reveal-visible{opacity:1;transform:translateY(0)}
        @keyframes orbDrift1{0%,100%{transform:translate(0,0)}50%{transform:translate(50px,35px)}}
        @keyframes orbDrift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-45px,-25px)}}
        @keyframes orbDrift3{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,45px)}}
        .orb{position:fixed;border-radius:9999px;pointer-events:none;z-index:0;filter:blur(130px)}
        .orb-g1{width:600px;height:600px;top:-200px;left:-150px;background:radial-gradient(circle,hsl(142 71% 45%/.28),transparent 70%);animation:orbDrift1 22s ease-in-out infinite}
        .orb-g2{width:450px;height:450px;bottom:-150px;right:-80px;background:radial-gradient(circle,hsl(40 60% 55%/.25),transparent 70%);animation:orbDrift2 26s ease-in-out infinite}
        .orb-g3{width:350px;height:350px;top:45%;left:55%;background:radial-gradient(circle,hsl(142 71% 45%/.12),transparent 70%);animation:orbDrift3 30s ease-in-out infinite}
        .strain-gradient{background:linear-gradient(135deg,hsl(142 71% 45%),hsl(40 60% 55%));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
      `}</style>

      <div className="orb orb-g1" />
      <div className="orb orb-g2" />
      <div className="orb orb-g3" />

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="https://authichain.com" className="text-[10px] uppercase tracking-[.1em] text-muted-foreground/60 hover:text-green-400 transition-colors">&#9670; AuthiChain Protocol</a>
            <div className="flex items-center gap-2">
              <Leaf className="h-6 w-6 text-green-400" />
              <span className="text-lg font-bold tracking-tight strain-gradient">StrainChain</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#journey" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => setLocation("/dashboard")} size="sm" className="bg-green-600 hover:bg-green-700">
                Dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => go("/dashboard")}>Sign in</Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => go("/dashboard")}>
                  Get Started <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(142_71%_45%_/_0.05),transparent_60%)]" />
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/5 text-green-400 text-xs font-medium tracking-wide uppercase mb-8">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" /></span>
              AuthiChain Protocol Vertical
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
              Cannabis Provenance on the{" "}
              <span className="strain-gradient">Blockchain</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              From seed to sale &mdash; scan once, know forever. Blockchain-verified authentication with NFT certificates, lab-result anchoring, and $QRON rewards for every verified scan.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 bg-green-600 hover:bg-green-700" onClick={() => go("/dashboard")}>
                Register Your Product <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" asChild>
                <a href="#journey">See the Journey &rarr;</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative z-10 border-y border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold strain-gradient">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-24">
        <div className="container">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-green-400 font-semibold mb-3">Platform</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">The Cannabis Truth Stack</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Everything cultivators, processors, and dispensaries need to prove authenticity &mdash; powered by the AuthiChain Protocol.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <Reveal key={f.title}>
                <div className="glass-card rounded-xl p-6 hover:border-green-500/30 transition-all group h-full">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                    <f.icon className="h-5 w-5 text-green-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Journey ── */}
      <section id="journey" className="relative z-10 py-24 border-y border-border/40 bg-card/20">
        <div className="container">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-green-400 font-semibold mb-3">Provenance Journey</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">From Seed to Scanner</h2>
              <p className="text-muted-foreground max-w-lg text-lg">Four steps of cryptographic truth &mdash; every touchpoint verified, every scan rewarded.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {journey.map((s) => (
              <Reveal key={s.num}>
                <div className="glass-card rounded-xl p-6 hover:border-green-500/30 transition-all group h-full relative overflow-hidden">
                  <span className="absolute top-3 right-4 text-3xl font-bold text-green-500/10 leading-none">{s.num}</span>
                  <h4 className="font-semibold text-base mb-2 mt-2">{s.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-24">
        <div className="container">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-green-400 font-semibold mb-3">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Plans for Every Operator</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">From single-license cultivators to multi-state enterprises. All plans include AuthiChain Protocol verification.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {pricing.map((plan) => (
              <Reveal key={plan.name}>
                <div className={`rounded-xl p-6 border h-full flex flex-col ${plan.highlighted ? "border-green-500/50 bg-green-500/5 ring-1 ring-green-500/20" : "border-border glass-card"}`}>
                  <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-5">{plan.desc}</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full ${plan.highlighted ? "bg-green-600 hover:bg-green-700" : ""}`} variant={plan.highlighted ? "default" : "outline"} onClick={() => go("/subscriptions")}>
                    {plan.highlighted ? "Get Started" : "Choose Plan"}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ecosystem ── */}
      <section className="relative z-10 py-24 border-t border-border/40">
        <div className="container">
          <Reveal>
            <div className="mb-12">
              <p className="text-xs uppercase tracking-[.2em] text-green-400 font-semibold mb-3">Ecosystem</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Part of the AuthiChain Protocol</h2>
              <p className="text-muted-foreground max-w-lg text-lg">StrainChain is a vertical of the AuthiChain truth substrate &mdash; interoperable with every ecosystem product.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4">
            {ecosystem.map((e) => (
              <Reveal key={e.name}>
                <a href={e.href} className="glass-card rounded-xl p-5 hover:border-green-500/30 transition-all group block h-full" target="_blank" rel="noopener noreferrer">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <span className="text-green-400">&#9670;</span> {e.name}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{e.desc}</p>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-28">
        <div className="container">
          <Reveal className="text-center">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Scan Once. <span className="strain-gradient">Know Forever.</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">Join the cannabis operators building trust from seed to consumer.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 bg-green-600 hover:bg-green-700" onClick={() => go("/dashboard")}>
                Start Verifying <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" asChild>
                <a href="mailto:authichain@gmail.com">Contact Sales &rarr;</a>
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
              <Leaf className="h-5 w-5 text-green-400" />
              <span className="font-bold strain-gradient">StrainChain</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Cannabis Provenance on the Blockchain. An AuthiChain Protocol vertical.
            </p>
          </div>
          <div className="pt-4 border-t border-border/40">
            <EcosystemNav />
          </div>
          <p className="text-center text-xs text-muted-foreground/60">&copy; 2026 AuthiChain, Inc. &mdash; StrainChain is a vertical of the AuthiChain Protocol</p>
        </div>
      </footer>
    </div>
  );
}
