import { Button } from "@/components/ui/button";
import { EcosystemNav } from "@/components/EcosystemNav";
import type { Brand } from "@shared/brands";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Shared hero-style landing layout for the three non-AuthiChain brands
 * (QRON, StrainChain, GovChain). Keeps visual consistency across the
 * ecosystem while letting each brand supply its own copy, icon, features,
 * and primary CTA.
 *
 * AuthiChain has its own bespoke landing (AuthiChainHome.tsx) because it
 * carries additional sections (stats, pricing preview) that the other
 * brands don't need yet.
 */
export interface BrandLandingProps {
  brand:    Brand;
  Logo:     LucideIcon;
  features: Array<{ icon: LucideIcon; title: string; desc: string }>;
  /** Called when the primary CTA is clicked. Defaults to navigating to brand.ctaHref. */
  onCta?:   () => void;
}

export function BrandLanding({ brand, Logo, features, onCta }: BrandLandingProps) {
  const [, setLocation] = useLocation();
  const handleCta = onCta ?? (() => setLocation(brand.ctaHref));
  const accent = brand.accentHex;

  return (
    <div className="min-h-screen bg-background" data-brand={brand.id}>
      {/* Top nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="h-6 w-6" style={{ color: accent }} />
            <span className="text-lg font-bold" style={{ color: accent }}>{brand.displayName}</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="https://authichain.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Ecosystem</a>
          </div>
          <Button size="sm" onClick={handleCta} style={{ backgroundColor: accent, color: "#0A0F1E" }}>
            {brand.ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${accent}1f 0%, transparent 60%)` }}
        />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm mb-8"
              style={{ borderColor: `${accent}66`, color: accent, backgroundColor: `${accent}10` }}
            >
              <Logo className="h-3.5 w-3.5" />
              {brand.displayName}
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              {brand.tagline}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              {brand.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-base px-8"
                onClick={handleCta}
                style={{ backgroundColor: accent, color: "#0A0F1E" }}
              >
                {brand.ctaLabel} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 bg-transparent"
                onClick={() => { window.location.href = "https://authichain.com"; }}
              >
                Visit AuthiChain
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="container">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((f) => (
              <div key={f.title} className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${accent}1a` }}
                >
                  <f.icon className="h-5 w-5" style={{ color: accent }} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5" style={{ color: accent }} />
              <span className="font-bold" style={{ color: accent }}>{brand.displayName}</span>
            </div>
            <p className="text-sm text-muted-foreground text-center md:text-right max-w-md">
              {brand.description}
            </p>
          </div>
          <div className="pt-4 border-t border-border/40">
            <EcosystemNav />
          </div>
        </div>
      </footer>
    </div>
  );
}
