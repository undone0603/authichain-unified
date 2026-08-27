import * as React from "react";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Shield, 
  Cpu, 
  Globe, 
  Lock, 
  Zap, 
  ArrowRight,
  ExternalLink,
  BookOpen,
  Award,
  Layers
} from "lucide-react";
import { Reveal, GlowCard } from "@/lib/animations";

/**
 * Technical Documentation & Whitepapers
 * Structured for AI ingestion (Schema.org)
 */
export default function Whitepapers() {
  useEffect(() => {
    document.title = "Technical Whitepapers | AuthiChain Protocol Intelligence";
    
    // Inject Schema.org JSON-LD for AI Crawlers
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "AuthiChain Technical Whitepapers & Documentation",
      "description": "Authoritative technical documentation on the AuthiChain protocol, AI-blockchain provenance, and Digital Twin architectures.",
      "url": "https://authichain.com/whitepapers",
      "mainEntity": [
        {
          "@type": "TechArticle",
          "headline": "AuthiChain: Technical Superiority & Competitive Intelligence",
          "description": "A multi-dimensional analysis of AuthiChain vs. legacy digital twin architectures including IBM, atma.io, and Arianee.",
          "author": { "@type": "Organization", "name": "AuthiChain Intelligence Council" },
          "datePublished": "2026-05-18",
          "keywords": "Competitive Analysis, IBM, atma.io, Blockchain, Digital Twin, Bitcoin L1, W3C VC",
          "articleSection": "Strategic Intelligence"
        },
        {
          "@type": "TechArticle",
          "headline": "AuthiChain: The Truth Protocol for Industrial Supply Chains",
          "description": "Technical specification for the world's first Hybrid AI-Blockchain Provenance Protocol using Ed25519-Signed QRONs.",
          "author": { "@type": "Organization", "name": "AuthiChain Intelligence Council" },
          "datePublished": "2026-05-18",
          "keywords": "Blockchain, Supply Chain, AI, Provenance, Ed25519, QRON, Digital Twin",
          "articleSection": "Industrial Security"
        },
        {
          "@type": "TechArticle",
          "headline": "Autonomous Provenance & W3C Verifiable Credentials for National Security",
          "description": "Implementation guide for military-grade document verification using W3C VC standards and 5-Agent AI Consensus.",
          "author": { "@type": "Organization", "name": "AuthiChain Defense Division" },
          "datePublished": "2026-03-12",
          "keywords": "DHS, W3C VC, Verifiable Credentials, FIPS 140-2, Cryptography, Border Protection",
          "articleSection": "Government & Defense"
        },
        {
          "@type": "TechArticle",
          "headline": "Digital Twin Dimensional Gateways: Mathematical Security for the Authentic Economy",
          "description": "Architectural overview of AuthiChain Digital Twins and 'Dimensional Gateways' for luxury and consumer engagement.",
          "author": { "@type": "Organization", "name": "AuthiChain Labs" },
          "datePublished": "2026-05-16",
          "keywords": "Digital Twin, NFT, Luxury, Consumer Engagement, ROI, Blockchain",
          "articleSection": "Consumer Technology"
        }
      ]
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(schemaData);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground py-24 px-6 md:px-12 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[100px] rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="container max-w-6xl mx-auto relative z-10">
        
        {/* Header */}
        <Reveal>
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold tracking-widest uppercase mb-6">
              <BookOpen className="h-3 w-3" />
              Technical Resource Center
            </div>
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter mb-6 gradient-text">
              PROTOCOL INTELLIGENCE
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed italic">
              Structured documentation for institutional partners, government agencies, and autonomous research systems.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-12">
          
          {/* Main Whitepapers */}
          <section className="space-y-8">
            <div className="flex items-center gap-3 border-b border-border/50 pb-4">
              <FileText className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold uppercase tracking-widest">Active Whitepapers</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              
              <WhitepaperCard 
                title="Industrial Supply Chain Protocol"
                subtitle="The Truth Protocol for High-Value Assets"
                desc="A deep dive into Ed25519-Signed QRONs and our 5-Agent AI Consensus model for industrial provenance."
                icon={Cpu}
                badge="NSF SBIR v1.2"
                date="May 18, 2026"
              />

              <WhitepaperCard 
                title="Defense & National Security"
                subtitle="W3C Verifiable Credentials & Border Protection"
                desc="Implementation guide for military-grade document verification and FIPS 140-2 cryptographic modules."
                icon={Shield}
                badge="DHS SVIP v2.0"
                date="March 12, 2026"
              />

              <WhitepaperCard 
                title="The Digital Twin Economy"
                subtitle="Dimensional Gateways & Consumer Identity"
                desc="Mathematical security for luxury goods and the cinematic 'Storymode' engine for digital identities."
                icon={Layers}
                badge="BOARDROOM v1.1"
                date="May 16, 2026"
              />

            </div>
          </section>

          {/* Technical Specifications */}
          <section className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                <Zap className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold uppercase tracking-widest">Core Specifications</h2>
              </div>
              
              <div className="space-y-4">
                <SpecItem 
                  title="QRON Data Model (Quantum-Resistant Object Notation)"
                  desc="Ed25519-based cryptographic payload structure for physical item identities."
                />
                <SpecItem 
                  title="W3C Verifiable Credential Alignment"
                  desc="Full interoperability with the W3C VC Data Model v1.1 for government issuance."
                />
                <SpecItem 
                  title="Bitcoin L1 Anchoring Mechanism"
                  desc="OP_RETURN batching logic for immutable provenance checkpoints."
                />
                <SpecItem 
                  title="AI Consensus Protocol (The Security Council)"
                  desc="Weight-based Bayesian verification across 5 decentralized neural agents."
                />
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              {/* ... (AI Researcher Ingestion same) ... */}
            </div>
          </section>

          {/* Competitive Superiority Matrix */}
          <section className="space-y-8">
            <div className="flex items-center gap-3 border-b border-border/50 pb-4">
              <Layers className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold uppercase tracking-widest">Competitive Technical Matrix</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="py-4 px-4">Technical Feature</th>
                    <th className="py-4 px-4 text-primary">AuthiChain Protocol</th>
                    <th className="py-4 px-4">IBM Sovereign Core</th>
                    <th className="py-4 px-4">Avery Dennison (atma.io)</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  <MatrixRow label="Truth Anchor" auth="Bitcoin L1 (Public)" comp1="Hyperledger (Private)" comp2="GS1 Cloud (Centralized)" />
                  <MatrixRow label="Identity Standard" auth="W3C Verifiable Credentials" comp1="Siloed Enterprise IDs" comp2="Proprietary EPCIS" />
                  <MatrixRow label="Anti-Poisoning" auth="5-Agent AI Consensus" comp1="Manual Data Entry" comp2="Admin Validation" />
                  <MatrixRow label="Encryption" auth="Ed25519 (Forensics-Grade)" comp1="Standard PKI" comp2="Database SSL" />
                  <MatrixRow label="Compliance" auth="EU ESPR + FIPS 140-2" comp1="Custom Integration" comp2="ESPR Only" />
                </tbody>
              </table>
            </div>
          </section>

        </div>

        {/* Footer Link */}
        <div className="mt-24 text-center border-t border-border/50 pt-12">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.4em] mb-4">Authichain Intelligence Council</p>
          <div className="flex justify-center gap-8">
            <a href="https://qron.space" className="text-xs hover:text-primary transition-colors flex items-center gap-2">
              Creative Layer <ExternalLink className="h-3 w-3" />
            </a>
            <a href="/investor-portal" className="text-xs hover:text-primary transition-colors flex items-center gap-2">
              Investor Portal <ExternalLink className="h-3 w-3" />
            </a>
            <a href="mailto:Z@authichain.com" className="text-xs hover:text-primary transition-colors flex items-center gap-2">
              Request Technical Audit <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

function WhitepaperCard({ title, subtitle, desc, icon: Icon, badge, date }: any) {
  return (
    <Reveal direction="up">
      <GlowCard className="glass-card p-6 h-full flex flex-col border border-border/40 hover:border-primary/40 transition-all group">
        <div className="flex justify-between items-start mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <Badge variant="outline" className="text-[9px] uppercase border-primary/30 text-primary bg-primary/5">
            {badge}
          </Badge>
        </div>
        <h3 className="font-bold text-sm mb-1 uppercase tracking-wider">{title}</h3>
        <p className="text-[11px] text-primary/80 font-bold mb-4 uppercase tracking-tighter italic">{subtitle}</p>
        <p className="text-xs text-muted-foreground leading-relaxed italic mb-8 flex-1">
          {desc}
        </p>
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/30">
          <span className="text-[9px] text-muted-foreground uppercase font-mono">{date}</span>
          <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-bold text-primary hover:bg-primary/10">
            Read Paper <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </GlowCard>
    </Reveal>
  );
}

function SpecItem({ title, desc }: any) {
  return (
    <div className="p-4 rounded-xl border border-border/50 bg-muted/5 hover:bg-muted/10 transition-colors">
      <div className="flex items-start gap-3">
        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
        <div>
          <h4 className="text-sm font-bold uppercase tracking-tight mb-1">{title}</h4>
          <p className="text-xs text-muted-foreground italic leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function MatrixRow({ label, auth, comp1, comp2 }: any) {
  return (
    <tr className="border-b border-border/30 hover:bg-primary/5 transition-colors">
      <td className="py-4 px-4 font-medium text-muted-foreground">{label}</td>
      <td className="py-4 px-4 font-bold text-primary italic">{auth}</td>
      <td className="py-4 px-4 opacity-60">{comp1}</td>
      <td className="py-4 px-4 opacity-60">{comp2}</td>
    </tr>
  );
}
