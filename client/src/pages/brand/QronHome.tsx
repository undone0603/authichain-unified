import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { EcosystemNav } from "@/components/EcosystemNav";
import {
  QrCode, Sparkles, Layers, Share2, Palette, Zap,
  ArrowRight, CheckCircle2, Eye, Wand2, Shield, Scan,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";

/* ─── Scroll-reveal hook ─── */
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
  { num: "04", title: "Deploy Anywhere", desc: "Download as high-res PNG. Print on packaging, share on social, embed in email \u2014 it works everywhere a camera does." },
];

const pricing = [
  { name: "Free", price: "$0", period: "", desc: "Get started with AI QR codes", features: ["10 generations / month", "Static + Stereographic modes", "Basic styles", "PNG download"] },
  { name: "Starter Pack", price: "$29", period: "one-time", desc: "100 AI QR generations, never expire", features: ["100 generations (one-time)", "All Free modes", "Holographic + Memory modes", "Ed25519-signed on AuthiChain"] },
  { name: "Creator Pack", price: "$99", period: "one-time", desc: "500 AI QR generations \u2014 best value", features: ["500 generations (one-time)", "All Pro modes", "Premium styles", "Priority generation queue", "Ed25519-signed on AuthiChain"], highlighted: true },
  { name: "Studio Pack", price: "$299", period: "one-time", desc: "2,000 generations for agencies", features: ["2,000 generations (one-time)", "All Pro modes", "White-label ready", "API access (1,000 calls/mo)", "Ed25519-signed on AuthiChain"] },
  { name: "Business", price: "$49", period: "/mo", desc: "Unlimited for growing teams", features: ["Unlimited generations", "All modes including Enterprise", "API access (1,000 calls/mo)", "Verification dashboard", "5 team seats", "Priority support"] },
];

/* ─── Component ─── */
export default function QronHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "QRON \u2014 AI QR Code Art Generator | Free Creative QR Codes";
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
        @keyframes orbDrift1{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,40px)}}
        @keyframes orbDrift2{0%,100%{transform:translate(0,0)}50%{transform:translate(60px,-30px)}}
        @keyframes orbDrift3{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-40px)}}
        .orb{position:fixed;border-radius:9999px;pointer-events:none;z-index:0;filter:blur(120px)}
        .orb-v1{width:550px;height:550px;top:-180px;right:-80px;background:radial-gradient(circle,hsl(271 81% 56%/.32),transparent 70%);animation:orbDrift1 20s ease-in-out infinite}
        .orb-v2{width:500px;height:500px;bottom:-200px;left:-100px;background:radial-gradient(circle,hsl(187 92% 41%/.28),transparent 70%);animation:orbDrift2 24s ease-in-out infinite}
        .orb-v3{width:300px;height:300px;top:50%;left:30%;background:radial-gradient(circle,hsl(330 80% 56%/.15),transparent 70%);animation:orbDrift3 28s ease-in-out infinite}
        .qron-gradient{background:linear-gradient(135deg,hsl(271 81% 56%),hsl(187 92% 41%));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
      `}</style>

      <div className="orb orb-v1" />
      <div className="orb orb-v2" />
      <div className="orb orb-v3" />

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="https://authichain.com" className="text-[10px] uppercase tracking-[.1em] text-muted-foreground/60 hover:text-primary transition-colors">&#9670; AuthiChain Protocol</a>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded border-2 border-purple-500 flex items-center justify-center">
                <span className="text-[9px] font-bold text-purple-400">QR</span>
              </div>
              <span className="text-lg font-bold tracking-tight">QRON</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#modes" className="hover:text-foreground transition-colors">Modes</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => go("/qr")}>
              Create Free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(271_81%_56%_/_0.06),transparent_60%)]" />
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/5 text-purple-400 text-xs font-medium tracking-wide uppercase mb-8">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" /></span>
              AuthiChain Protocol Verified
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
              Where Authentication Meets{" "}
              <span className="qron-gradient">Artistry</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              AI-powered QR code art, cryptographically signed by the AuthiChain Protocol. Every QRON is scannable, beautiful, and verifiable by anyone, anywhere.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 bg-purple-600 hover:bg-purple-700" onClick={() => go("/qr")}>
                Generate Free &mdash; No Signup <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" asChild>
                <a href="#pricing">View Plans &rarr;</a>
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
                <div className="text-3xl md:text-4xl font-bold qron-gradient">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modes ── */}
      <section id="modes" className="relative z-10 py-24">
        <div className="container">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-purple-400 font-semibold mb-3">Creative Modes</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Six Ways to Create</h2>
              <p className="text-muted-foreground max-w-lg text-lg">From static posters to holographic experiences &mdash; choose the QRON mode that fits your brand.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modes.map((m) => (
              <Reveal key={m.title}>
                <div className="glass-card rounded-xl p-6 hover:border-purple-500/30 transition-all group h-full">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                    <m.icon className="h-5 w-5 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 py-24 border-y border-border/40 bg-card/20">
        <div className="container">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs uppercase tracking-[.2em] text-purple-400 font-semibold mb-3">AuthiChain Protocol</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How It Works</h2>
              <p className="text-muted-foreground max-w-lg text-lg">Every QRON is an Ed25519-signed cryptographic payload &mdash; scannable by anyone, verifiable by the protocol.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((s) => (
              <Reveal key={s.num}>
                <div className="glass-card rounded-xl p-6 hover:border-purple-500/30 transition-all group h-full relative overflow-hidden">
                  <span className="absolute top-3 right-4 text-3xl font-bold text-purple-500/10 leading-none">{s.num}</span>
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
              <p className="text-xs uppercase tracking-[.2em] text-purple-400 font-semibold mb-3">Plans</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Choose Your Tier</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">All plans include AuthiChain Protocol verification. Pack credits never expire.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
            {pricing.map((p) => (
              <Reveal key={p.name}>
                <div className={`rounded-xl p-5 border h-full flex flex-col ${p.highlighted ? "border-purple-500/50 bg-purple-500/5 ring-1 ring-purple-500/20" : "border-border glass-card"}`}>
                  <h3 className="font-semibold text-base mb-0.5">{p.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-2xl font-bold">{p.price}</span>
                    {p.period && <span className="text-xs text-muted-foreground">{p.period}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">{p.desc}</p>
                  <ul className="space-y-2 mb-5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" className={`w-full ${p.highlighted ? "bg-purple-600 hover:bg-purple-700" : ""}`} variant={p.highlighted ? "default" : "outline"} onClick={() => go("/qr")}>
                    {p.name === "Free" ? "Current Plan" : `Buy ${p.name}`}
                  </Button>
                </div>
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
              Create Your <span className="qron-gradient">QRON</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">100% scannable. Cryptographically signed. Free to start.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 bg-purple-600 hover:bg-purple-700" onClick={() => go("/qr")}>
                Generate Free &mdash; No Signup <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-transparent" asChild>
                <a href="https://authichain.com">Enterprise Platform &rarr;</a>
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
              <div className="h-6 w-6 rounded border-2 border-purple-500 flex items-center justify-center">
                <span className="text-[8px] font-bold text-purple-400">QR</span>
              </div>
              <span className="font-bold">QRON</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Creative Layer of the AuthiChain Protocol. AI-powered QR art, cryptographically signed.
            </p>
          </div>
          <div className="pt-4 border-t border-border/40">
            <EcosystemNav />
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/50">
            <span>Powered by Fal.ai</span><span>&middot;</span>
            <span>Supabase</span><span>&middot;</span>
            <span>Stripe</span><span>&middot;</span>
            <span>AuthiChain Protocol</span>
          </div>
          <p className="text-center text-xs text-muted-foreground/60">&copy; 2026 AuthiChain, Inc. &mdash; QRON is the Creative Layer of the AuthiChain Protocol</p>
        </div>
      </footer>
    </div>
  );
}
