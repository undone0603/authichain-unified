import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  Shield, ArrowRight, CheckCircle2, Zap, Globe, Lock,
  BarChart3, Bot, Gem, QrCode, Truck, Mail,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

const features = [
  { icon: Shield, title: "AI Authentication", desc: "Blockchain-verified product authentication with AI-powered image analysis and confidence scoring" },
  { icon: QrCode, title: "QR Verification", desc: "Generate and scan QR codes for instant product verification certificates" },
  { icon: Gem, title: "NFT Marketplace", desc: "Auctions, collections, rarity scoring, and IPFS storage for digital authenticity tokens" },
  { icon: Bot, title: "AI Autopilot", desc: "Automated decision engine for email outreach, lead qualification, and social engagement" },
  { icon: Truck, title: "Supply Chain", desc: "End-to-end tracking with IoT monitoring and blockchain verification at every checkpoint" },
  { icon: Mail, title: "Email Campaigns", desc: "AI-generated content with SendGrid integration, approval workflows, and A/B testing" },
  { icon: Lock, title: "Crypto Payments", desc: "Stripe + NOWPayments integration with escrow system and automated billing" },
  { icon: BarChart3, title: "Admin Analytics", desc: "Revenue analytics, fraud detection, customer health scoring, and enterprise reporting" },
  { icon: Globe, title: "White Label", desc: "Custom branding, API access, and enterprise solutions for your clients" },
];

const stats = [
  { value: "99.7%", label: "Authentication Accuracy" },
  { value: "<500ms", label: "Verification Latency" },
  { value: "50M+", label: "Products Verified" },
  { value: "180+", label: "Countries Served" },
];

const plans = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    features: ["100 authentications/month", "Basic AI analysis", "QR code generation", "Certificate issuance", "Email support"],
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$199",
    period: "/mo",
    features: ["1,000 authentications/month", "Advanced AI + blockchain", "NFT marketplace access", "Supply chain tracking", "AI Autopilot", "Email campaigns"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$799",
    period: "/mo",
    features: ["Unlimited authentications", "White-label solutions", "Custom API access", "Advanced analytics", "Dedicated account manager", "SLA guarantee"],
    highlighted: false,
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "AuthiChain — Blockchain Authentication Protocol";
  }, []);

  return (
    <div className="min-h-screen protocol-bg">

      {/* ── Protocol top band ──────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #0a0a0a 0%, #1a1300 50%, #0a0a0a 100%)',
        borderBottom: '1px solid rgba(201,162,39,0.2)',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: '#9e9e9e',
      }}>
        <span style={{ color: '#c9a227', fontWeight: 700, letterSpacing: '0.08em' }}>
          ◆ AUTHICHAIN PROTOCOL
        </span>
        <span style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a
            href="https://qron.space"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#9e9e9e', textDecoration: 'none', letterSpacing: '0.05em' }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#c9a227')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#9e9e9e')}
          >
            qron.space — Creative Studio ↗
          </a>
          <span style={{ color: '#3a3a3a' }}>|</span>
          <span style={{ color: '#6b6b6b' }}>Enterprise Platform</span>
        </span>
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="fixed top-[33px] w-full z-50 border-b border-border/50 bg-background/90 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold gradient-text">AuthiChain</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#stats" className="hover:text-foreground transition-colors">Stats</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => setLocation("/dashboard")} size="sm">
                Dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => { window.location.href = getLoginUrl(); }}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => { window.location.href = getLoginUrl(); }}>
                  Get Started <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="pt-[calc(6rem+33px)] pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,162,39,0.07),transparent_60%)]" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center">

            {/* Protocol badge */}
            <div className="inline-flex items-center gap-2 protocol-badge mb-8">
              <Zap className="h-3.5 w-3.5" />
              AuthiChain Protocol — Enterprise Authentication
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              The Trust Engine Behind{" "}
              <span className="gradient-text">Every Authentic Product.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              AuthiChain combines Ed25519 cryptographic signing, blockchain anchoring on Polygon,
              and AI-powered image analysis to eliminate counterfeiting — at enterprise scale.
            </p>

            {/* Stat strip */}
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground mb-10">
              {[
                "Ed25519 Cryptographic Signing",
                "Polygon Blockchain Anchoring",
                "99.7% Authentication Accuracy",
                "W3C Verifiable Credentials",
              ].map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span style={{ color: '#c9a227' }}>◆</span> {s}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-base px-8"
                onClick={() => { user ? setLocation("/dashboard") : (window.location.href = getLoginUrl()); }}
              >
                Start Authenticating <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 bg-transparent"
                onClick={() => { user ? setLocation("/nft") : (window.location.href = getLoginUrl()); }}
              >
                Explore NFT Marketplace
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <section id="stats" className="py-16 gold-divider border-t">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold gradient-text">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <div className="protocol-badge mx-auto mb-4" style={{ width: 'fit-content' }}>
              Complete Authentication Ecosystem
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Enterprise Trust</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every tool you need to authenticate products, manage supply chains, and grow your business —
              all anchored by the AuthiChain Protocol.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="glass-card rounded-xl p-6 transition-all group">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center mb-4 transition-colors"
                  style={{ background: 'rgba(201,162,39,0.10)' }}>
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QRON Cross-link ────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="container">
          <div className="rounded-2xl p-8 md:p-12 text-center"
            style={{
              background: 'linear-gradient(135deg, #111111 0%, #1a1300 50%, #111111 100%)',
              border: '1px solid rgba(201,162,39,0.30)',
              boxShadow: '0 0 40px rgba(201,162,39,0.06)',
            }}>
            <div className="protocol-badge mx-auto mb-4" style={{ width: 'fit-content' }}>
              ◆ AuthiChain Protocol Network
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Meet <span className="gradient-text">QRON</span> — the Creative Layer
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              QRON is the consumer-facing creative studio built on the AuthiChain Protocol.
              Generate AI-powered QR art — every code cryptographically signed with Ed25519 and
              verifiable against the AuthiChain blockchain anchor.
            </p>
            <a
              href="https://qron.space"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #c9a227 0%, #e8c547 50%, #c9a227 100%)',
                color: '#0a0a0a',
                boxShadow: '0 0 24px rgba(201,162,39,0.35)',
              }}
            >
              Launch QRON Creative Studio <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 border-t border-border/50">
        <div className="container">
          <div className="text-center mb-16">
            <div className="protocol-badge mx-auto mb-4" style={{ width: 'fit-content' }}>
              Protocol Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start authenticating today. Every plan includes Ed25519 signing, blockchain anchoring, and AI analysis.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-6 border transition-all ${
                  plan.highlighted
                    ? "glow-gold"
                    : "glass-card"
                }`}
                style={plan.highlighted ? {
                  background: 'linear-gradient(135deg, #111111 0%, #1a1300 100%)',
                  border: '1px solid rgba(201,162,39,0.50)',
                } : {}}
              >
                {plan.highlighted && (
                  <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#c9a227' }}>
                    ◆ MOST POPULAR
                  </div>
                )}
                <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold gradient-text">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => { user ? setLocation("/subscriptions") : (window.location.href = getLoginUrl()); }}
                >
                  {plan.highlighted ? "Get Started" : "Choose Plan"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(201,162,39,0.15)',
        padding: '20px 24px',
        background: '#0d0d0d',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '12px',
        color: '#6b6b6b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#c9a227', fontWeight: 700, fontSize: '13px' }}>AUTHICHAIN</span>
          <span style={{ color: '#3a3a3a' }}>|</span>
          <span>Blockchain Authentication Protocol</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a href="https://qron.space" target="_blank" rel="noreferrer"
            style={{ color: '#9e9e9e', textDecoration: 'none' }}>QRON Creative Studio ↗</a>
          <a href="mailto:Z@authichain.com"
            style={{ color: '#6b6b6b', textDecoration: 'none' }}>Contact</a>
          <span>© {new Date().getFullYear()} AuthiChain, Inc.</span>
        </div>
      </footer>

    </div>
  );
}
