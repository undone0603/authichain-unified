import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  Shield, ArrowRight, CheckCircle2, Zap, Globe, Lock,
  BarChart3, Bot, Gem, QrCode, Truck, Mail,
} from "lucide-react";
import { useLocation } from "wouter";

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
  { value: "<2s", label: "Verification Speed" },
  { value: "50M+", label: "Products Verified" },
  { value: "180+", label: "Countries Served" },
];

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold gradient-text">AuthiChain</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#stats" className="hover:text-foreground transition-colors">Stats</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
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

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.65_0.2_160_/_0.08),transparent_60%)]" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm mb-8">
              <Zap className="h-3.5 w-3.5" />
              Blockchain-Powered Authentication
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Protect Every Product.{" "}
              <span className="gradient-text">Verify Every Transaction.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              AuthiChain combines AI-powered image analysis, blockchain verification, and enterprise automation
              to eliminate counterfeiting and build unbreakable trust in your supply chain.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8" onClick={() => { user ? setLocation("/dashboard") : (window.location.href = getLoginUrl()); }}>
                Start Authenticating <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 bg-transparent" onClick={() => { user ? setLocation("/nft") : (window.location.href = getLoginUrl()); }}>
                Explore NFT Marketplace
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-16 border-y border-border/50">
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

      {/* Features */}
      <section id="features" className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Complete Authentication Ecosystem</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every tool you need to authenticate products, manage supply chains, and grow your business — all powered by blockchain and AI.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all group">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section id="pricing" className="py-24 border-t border-border/50">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start free, scale as you grow. Every plan includes blockchain verification and AI analysis.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name: "Starter", price: "$49", period: "/mo", features: ["100 authentications/month", "Basic AI analysis", "QR code generation", "Certificate issuance", "Email support"] },
              { name: "Professional", price: "$149", period: "/mo", features: ["1,000 authentications/month", "Advanced AI + blockchain", "NFT marketplace access", "Supply chain tracking", "AI Autopilot", "Email campaigns"], highlighted: true },
              { name: "Enterprise", price: "$499", period: "/mo", features: ["10,000 authentications/month", "White-label solutions", "Custom API access", "Advanced analytics", "Dedicated account manager", "SLA guarantee"] },
            ].map((plan) => (
              <div key={plan.name} className={`rounded-xl p-6 border ${plan.highlighted ? "border-primary/50 bg-primary/5 glow-green" : "border-border glass-card"}`}>
                <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold">{plan.price}</span>
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

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-bold gradient-text">AuthiChain</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Blockchain-powered product authentication. Protecting authenticity worldwide.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
