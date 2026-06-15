import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import {
  Shield, Smartphone, Leaf, Zap, Crown, Check,
  ArrowRight, Info, Layers, Boxes, Target, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tier {
  name: string;
  price: number;
  period: string;
  badge: string;
  features: string[];
  cta: string;
  color: string;
  planKey?: string;
}

interface Brand {
  name: string;
  domain: string;
  role: string;
  color: string;
  icon: React.ReactNode;
  desc: string;
  sells: string;
}

const B: Record<string, Brand> = {
  ac: { 
    name: "AuthiChain", 
    domain: "authichain.com", 
    role: "COMPLIANCE + BLOCKCHAIN", 
    color: "var(--primary)", 
    icon: <Shield className="h-5 w-5" />,
    desc: "Regulatory compliance engine, blockchain verification infrastructure, EU DPP passport generation, 5-agent AI consensus, and enterprise audit trails.",
    sells: "Trust infrastructure. The legal and cryptographic backbone." 
  },
  qr: { 
    name: "QRON", 
    domain: "qron.space", 
    role: "AI + CREATIVE", 
    color: "#00CCFF", // Keeping specific site colors
    icon: <Smartphone className="h-5 w-5" />,
    desc: "FLUX.1 AI-powered cryptographic QR art generation, consumer scanner PWA, $QRON Scan-to-Earn rewards, and creative tools for brands.",
    sells: "The art. The scan. The reward. The consumer experience." 
  },
  sc: { 
    name: "StrainChain", 
    domain: "strainchain.io", 
    role: "INDUSTRY SaaS EXAMPLE", 
    color: "#00C853", // Keeping specific site colors
    icon: <Leaf className="h-5 w-5" />,
    desc: "AuthiChain compliance + QRON creative applied to cannabis. Seed-to-sale tracking, lab result verification, and METRC compliance.",
    sells: "The proof that the two halves make a whole." 
  },
  gov: { 
    name: "GovChain", 
    domain: "govchain.us", 
    role: "SOVEREIGN COMPLIANCE", 
    color: "#3B82F6", 
    icon: <Globe className="h-5 w-5" />,
    desc: "Federal & State-level blockchain ledger for regulatory audits, document provenance, and anti-fraud identity verification.",
    sells: "The digital infrastructure for public trust." 
  },
};

const GOV_TIERS: Tier[] = [
  { name: "Public", price: 0, period: "free", badge: "TRANSPARENCY", color: "#888", cta: "View Ledger", features: ["Public document verification", "Open audit history", "Basic fraud reporting"] },
  { name: "Municipality", price: 499, period: "/mo", badge: "LOCAL", color: "#3B82F6", cta: "Onboard City", features: ["10,000 document stamps/month", "Identity verification API", "Local compliance dashboard", "Support for 5 agents"] },
  { name: "Agency", price: 1999, period: "/mo", badge: "STATE", color: "#3B82F6", cta: "Deploy Agency", features: ["Unlimited stamps", "Cross-agency data sharing", "Regulatory audit trails", "Private consensus nodes"] },
  { name: "Sovereign", price: 9999, period: "/mo", badge: "FEDERAL", color: "#1E40AF", cta: "Contact Gov Relations", features: ["Custom protocol deployment", "Nation-wide identity layer", "Full EU DPP integration", "Dedicated security clearance team"] },
];

const AC_TIERS: Tier[] = [
  { name: "Verify", price: 0, period: "free", badge: "FREE", color: "var(--muted-foreground)", cta: "Start Free", features: ["10 product verifications/month", "Public verification page", "Basic scan history"] },
  { name: "API Starter", price: 299, period: "/mo", badge: "NEW", color: "var(--primary)", cta: "Get API Key", features: ["1,000 API calls/month", "Standard support", "Base Mainnet integration", "Web widget access"] },
  { name: "Protect", price: 699, period: "/mo", badge: "GROWTH", color: "var(--primary)", cta: "Protect Your Brand", features: ["10,000 verifications/month", "Unlimited NFT certificates", "EU DPP passport generation", "5-agent AI consensus reports", "API access (REST + MCP)"] },
  { name: "Fortify", price: 3499, period: "/mo", badge: "ENTERPRISE", color: "var(--primary)", cta: "Contact Sales", features: ["Unlimited verifications", "Custom AI consensus models", "Full EU DPP compliance suite", "Dedicated account manager", "Audit trail exports"] },
];

const QR_TIERS: Tier[] = [
  { name: "Scan", price: 0, period: "free", badge: "FREE", color: "#888", cta: "Start Scanning", features: ["Unlimited QR scanning (consumer)", "Earn $QRON on every scan", "Basic verification results"] },
  { name: "Brand Pack", price: 199, period: "one-time", badge: "POPULAR", color: "#00CCFF", cta: "Buy 10 Art Codes", features: ["10 Custom FLUX.1 Art Codes", "Permanent hosting on Base", "High-res download", "Basic scan analytics"] },
  { name: "Studio", price: 449, period: "/mo", badge: "STUDIO", color: "#00CCFF", cta: "Open Studio", features: ["100 cryptographic QR arts/month", "Custom AI style training", "Batch generation (CSV upload)", "Embeddable scanner widget", "$QRON reward customization"] },
  { name: "Agency", price: 1499, period: "/mo", badge: "AGENCY", color: "#00FFE5", cta: "Contact Sales", features: ["Unlimited QR art generation", "White-label scanner", "Multi-client management", "API access (generation + scan)", "Custom ControlNet models"] },
];

const SC_TIERS: Tier[] = [
  { name: "Leaf", price: 0, period: "free", badge: "FREE", color: "#888", cta: "Verify Free", features: ["Verify any StrainChain product", "View lab results + provenance", "Earn $QRON on cannabis scans"] },
  { name: "Dispensary", price: 149, period: "/mo", badge: "DISPENSARY", color: "#00C853", cta: "Onboard Dispensary", features: ["100 product certifications/month", "QR label generation for products", "Consumer scan dashboard", "Lab result integration", "Basic compliance reports"] },
  { name: "Cultivator", price: 699, period: "/mo", badge: "CULTIVATOR", color: "#00C853", cta: "Scale Operations", features: ["1,000 certifications/month", "Seed-to-sale chain of custody", "METRC integration", "Custom strain QR art (FLUX.1)", "Multi-location support"] },
  { name: "Enterprise", price: 2999, period: "/mo", badge: "MSO", color: "#69F0AE", cta: "Contact Sales", features: ["Unlimited certifications", "Multi-state compliance engine", "Full METRC/BioTrack integration", "White-label consumer app", "NFT marketplace for strains"] },
];

const BUNDLES = [
  {
    name: "Verified Creator",
    sites: ["AuthiChain", "QRON"],
    icon: <Layers className="h-5 w-5" />,
    color: "#E8B500",
    price: 599,
    period: "/mo",
    savings: "$229/mo",
    desc: "Compliance backbone + creative AI. Generate cryptographic QR art with built-in blockchain verification.",
    includes: ["AuthiChain Protect tier", "QRON Studio tier", "Unified dashboard", "Cross-platform analytics"],
    best_for: "Brands launching product authentication with stunning visuals",
  },
  {
    name: "Chain Compliant",
    sites: ["AuthiChain", "StrainChain"],
    icon: <Boxes className="h-5 w-5" />,
    color: "#5CAD3C",
    price: 649,
    period: "/mo",
    savings: "$199/mo",
    desc: "Full compliance + cannabis vertical. Blockchain verification infrastructure with cannabis-specific SaaS.",
    includes: ["AuthiChain Protect tier", "StrainChain Cultivator tier", "Cannabis compliance automation", "Unified audit trail"],
    best_for: "Cannabis operators who need both compliance and industry tools",
  },
  {
    name: "Creative Cannabis",
    sites: ["QRON", "StrainChain"],
    icon: <Target className="h-5 w-5" />,
    color: "#00A86B",
    price: 499,
    period: "/mo",
    savings: "$149/mo",
    desc: "AI art + cannabis SaaS. Custom FLUX.1 strain art for every product, consumer scanner with $QRON rewards.",
    includes: ["QRON Studio tier", "StrainChain Cultivator tier", "Strain-specific QR art", "Consumer engagement + rewards"],
    best_for: "Cannabis brands investing in premium consumer experience",
  },
];

export default function MonetizationArchitecture() {
  const [tab, setTab] = useState("overview");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const host = window.location.hostname;
    if ((host === "qron.space" || host.endsWith(".qron.space"))) setTab("qron");
    else if ((host === "strainchain.io" || host.endsWith(".strainchain.io"))) setTab("strainchain");
    else if ((host === "govchain.us" || host.endsWith(".govchain.us"))) setTab("govchain");
    else if ((host === "authichain.com" || host.endsWith(".authichain.com"))) setTab("authichain");
  }, []);

  const handleCTA = (tierName: string) => {
    if (tierName.toLowerCase().includes("contact")) {
      window.location.href = "mailto:sales@authichain.com";
    } else if (!user) {
      window.location.href = getLoginUrl();
    } else {
      setLocation("/subscriptions");
    }
  };

  const renderTiers = (tiers: Tier[], brand: Brand) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {tiers.map((t, i) => (
        <Card key={i} className={cn(
          "relative overflow-hidden border-border/50 bg-card/30 backdrop-blur-sm transition-all hover:border-primary/30",
          i === tiers.length - 1 && "border-primary/40 shadow-lg shadow-primary/5"
        )}>
          {i === tiers.length - 1 && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
          )}
          <CardContent className="p-6 flex flex-col h-full">
            <div className="mb-4 flex justify-between items-center">
              <Badge variant="outline" style={{ borderColor: `${t.color}40`, color: t.color, backgroundColor: `${t.color}10` }}>
                {t.badge}
              </Badge>
              {i === tiers.length - 1 && <span className="text-[10px] text-primary animate-pulse font-bold">LIMITED SLOTS</span>}
            </div>
            <h3 className="text-lg font-bold mb-1">{t.name}</h3>
            <div className="mb-6">
              <span className="text-3xl font-bold" style={{ color: t.price === 0 ? "inherit" : brand.color }}>
                {t.price === 0 ? "Free" : `$${t.price}`}
              </span>
              {t.price > 0 && <span className="text-sm text-muted-foreground ml-1">{t.period}</span>}
            </div>
            <ul className="space-y-3 flex-1 mb-6">
              {t.features.map((f, j) => (
                <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: brand.color }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button 
              className="w-full" 
              variant={i === tiers.length - 1 ? "default" : "outline"}
              onClick={() => handleCTA(t.cta)}
              style={i === tiers.length - 1 ? { backgroundColor: brand.color, color: "#000" } : { borderColor: `${brand.color}40`, color: brand.color }}
            >
              {t.cta}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Priority Urgency Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in zoom-in duration-700">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-full">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary">Founding Member Priority Access</p>
            <p className="text-xs text-muted-foreground">Legacy pricing ends in 48 hours. Secure your industry vertical now.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => handleCTA("Priority")}>Claim Now</Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-muted/50 w-fit mx-auto">
        {[
          { id: "overview", label: "Architecture", icon: <Layers className="h-4 w-4" /> },
          { id: "authichain", label: "AuthiChain", icon: <Shield className="h-4 w-4" /> },
          { id: "qron", label: "QRON", icon: <Smartphone className="h-4 w-4" /> },
          { id: "strainchain", label: "StrainChain", icon: <Leaf className="h-4 w-4" /> },
          { id: "govchain", label: "GovChain", icon: <Globe className="h-4 w-4" /> },
          { id: "bundles", label: "Bundles", icon: <Zap className="h-4 w-4" /> },
          { id: "ultimate", label: "Ultimate", icon: <Crown className="h-4 w-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              {Object.entries(B).map(([key, b], i) => (
                <Card key={i} className="border-border/50 bg-card/30 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-primary/10" style={{ color: b.color }}>
                        {b.icon}
                      </div>
                      <div>
                        <h4 className="font-bold" style={{ color: b.color }}>{b.name}</h4>
                        <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-semibold">{b.role}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{b.desc}</p>
                    <p className="text-xs italic" style={{ color: b.color }}>{b.sells}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Info className="h-5 w-5 text-primary" />
                  <h4 className="text-lg font-bold">The Authentic Economy Stack</h4>
                </div>
                <div className="grid md:grid-cols-3 gap-8 text-sm text-muted-foreground leading-relaxed">
                  <p><strong className="text-foreground">AuthiChain</strong> is the legal & cryptographic backbone. Verification, compliance, and AI consensus.</p>
                  <p><strong className="text-foreground">QRON</strong> is the creative & consumer layer. AI QR art, scan-to-earn rewards, and cinematic storytelling.</p>
                  <p><strong className="text-foreground">StrainChain</strong> is the industry-specific application. A vertical blueprint for cannabis, luxury, or pharma.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AUTHICHAIN */}
        {tab === "authichain" && renderTiers(AC_TIERS, B.ac)}

        {/* QRON */}
        {tab === "qron" && renderTiers(QR_TIERS, B.qr)}

        {/* STRAINCHAIN */}
        {tab === "strainchain" && renderTiers(SC_TIERS, B.sc)}

        {/* GOVCHAIN */}
        {tab === "govchain" && renderTiers(GOV_TIERS, B.gov)}

        {/* BUNDLES */}
        {tab === "bundles" && (
          <div className="space-y-4">
            {BUNDLES.map((b, i) => (
              <Card key={i} className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-0 flex flex-col md:flex-row">
                  <div className="w-2 md:w-1 bg-primary" style={{ backgroundColor: b.color }} />
                  <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-muted" style={{ color: b.color }}>{b.icon}</div>
                        <h4 className="text-xl font-bold">{b.name}</h4>
                        <Badge variant="secondary" className="text-[10px]">{b.sites.join(" + ")}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground max-w-xl">{b.desc}</p>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {b.includes.map((inc, j) => (
                          <span key={j} className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground border border-border/50">{inc}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-bold" style={{ color: b.color }}>${b.price}</div>
                      <div className="text-xs text-muted-foreground mb-2">/month</div>
                      <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/5">Save {b.savings}</Badge>
                      <Button className="w-full mt-4" size="sm" onClick={() => handleCTA(b.name)}>Get Bundle</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ULTIMATE */}
        {tab === "ultimate" && (
          <div className="space-y-6">
            <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-background to-background text-center p-12">
              <CardContent>
                <Crown className="h-12 w-12 text-primary mx-auto mb-6 animate-pulse" />
                <h3 className="text-3xl font-black mb-2 tracking-tight">The Authentic Economy</h3>
                <p className="text-muted-foreground mb-8 text-lg">Every aspect. All three platforms. One subscription.</p>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-6xl font-black text-primary">$4,999</span>
                  <span className="text-xl text-muted-foreground">/mo</span>
                </div>
                <p className="text-green-500 font-bold mb-8">Save $2,497/mo vs separate enterprise tiers</p>
                <Button size="lg" className="px-12 py-6 text-lg font-bold" onClick={() => handleCTA("ultimate")}>Activate Ultimate Access</Button>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { label: "AuthiChain Enterprise", price: 2499, color: B.ac.color },
                { label: "QRON Agency", price: 999, color: B.qr.color },
                { label: "StrainChain MSO", price: 1999, color: B.sc.color },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/30">
                  <span className="font-semibold" style={{ color: item.color }}>{item.label}</span>
                  <span className="text-muted-foreground font-mono">${item.price}/mo</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-4 rounded-xl border border-primary/30 bg-primary/5">
                <span className="font-bold text-primary">Total Separately</span>
                <span className="text-primary font-black line-through opacity-50">$5,497/mo</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
