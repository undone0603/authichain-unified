import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { 
  Shield, 
  Sparkles, 
  Leaf, 
  Landmark, 
  ArrowRight, 
  CheckCircle2, 
  Globe, 
  Fingerprint,
  Zap,
  BarChart3
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#050507] text-slate-50 selection:bg-yellow-500/30 font-sans antialiased">
      {/* Cinematic Background */}
      <div className="fixed inset-0 bg-gradient-to-tr from-yellow-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="container max-w-7xl h-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Shield className="w-6 h-6 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-display text-2xl tracking-tighter font-bold uppercase">
              Authi<span className="text-yellow-500">Chain</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#ecosystem" className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-yellow-500 transition-colors">Protocol</a>
            <a href="#how" className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-yellow-500 transition-colors">Utility</a>
            <Link href="/pricing" className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-yellow-500 transition-colors">Pricing</Link>
          </div>

          <div>
            {user ? (
              <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-10 px-6 rounded-lg transition-all active:scale-95 shadow-lg shadow-yellow-500/20">
                <Link href="/dashboard">Open Dashboard</Link>
              </Button>
            ) : (
              <Button asChild className="bg-white/10 hover:bg-white/20 text-white font-bold h-10 px-6 rounded-lg transition-all active:scale-95 backdrop-blur-md border border-white/10">
                <a href={getLoginUrl()}>Sign In</a>
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32">
        {/* Hero Section */}
        <section className="container max-w-7xl px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-mono tracking-[0.2em] uppercase mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <Sparkles className="w-3 h-3" />
            The Authentication Layer for the Physical World
          </div>
          
          <h1 className="font-display text-6xl md:text-9xl font-bold tracking-tight mb-8 leading-[0.85] uppercase animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            Verify<br />
            <span className="bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-600 bg-clip-text text-transparent">Everything.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
            AuthiChain is the global truth layer. We bridge the gap between physical items and digital proof through AI classification, forensic QR art, and immutable ledgers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
             <Button asChild size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-16 px-10 text-lg rounded-xl shadow-2xl shadow-yellow-500/30 w-full sm:w-auto">
               <a href={getLoginUrl()}>Get Started Free</a>
             </Button>
             <Button asChild variant="ghost" size="lg" className="h-16 px-10 text-lg rounded-xl border border-white/5 bg-white/5 backdrop-blur-xl hover:bg-white/10 w-full sm:w-auto">
               <a href="#vision">Founder's Vision</a>
             </Button>
          </div>
        </section>

        {/* Vision Section / Video */}
        <section id="vision" className="container max-w-5xl px-6 py-24">
           <div className="glass bg-white/5 border-white/10 rounded-[40px] overflow-hidden p-12 text-center relative">
              <div className="absolute top-0 right-0 p-12 opacity-5">
                 <Shield className="w-64 h-64 text-yellow-500" />
              </div>
              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 mb-8 font-mono tracking-widest uppercase">The Protocol Vision</Badge>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase italic mb-8">Building the <span className="text-yellow-500">Authentication Layer</span> for the Physical World</h2>
              
              <div className="aspect-video bg-black rounded-2xl border border-white/10 mb-12 flex items-center justify-center group cursor-pointer relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60" />
                 <div className="w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center text-black shadow-2xl shadow-yellow-500/40 group-hover:scale-110 transition-transform relative z-10">
                    <Zap className="w-8 h-8 fill-current" />
                 </div>
                 <div className="absolute bottom-8 left-8 text-left z-10">
                    <p className="text-xs font-mono text-yellow-500 uppercase tracking-widest mb-1">Founder Spotlight</p>
                    <p className="text-xl font-bold italic uppercase tracking-tight">Zach — Architect of the Truth Protocol</p>
                 </div>
                 {/* Video Placeholder — User to upload Founder_Video.mp4 to storage */}
              </div>

              <p className="text-xl text-slate-400 font-light leading-relaxed max-w-2xl mx-auto italic">
                "Authenticity is essential infrastructure. Our product, QRON, transforms physical items into scannable identities. One scan unlocks the ground truth."
              </p>
           </div>
        </section>

        {/* The Truth Network */}
        <section id="ecosystem" className="container max-w-7xl px-6 py-32 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <div className="max-w-xl">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 mb-4 px-3 py-1 font-mono tracking-widest text-[10px]">THE AUTHENTIC ECONOMY</Badge>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase italic italic-font">One Protocol.<br /><span className="text-blue-500">Four Verticals.</span></h2>
            </div>
            <p className="text-slate-500 max-w-xs text-sm font-mono uppercase tracking-widest">Cross-industry verification powered by $QRON rewards.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* QRON Studio */}
            <div className="group relative p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-yellow-500/50 transition-all duration-500 overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
                  <Sparkles className="w-32 h-32 text-yellow-500" />
               </div>
               <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mb-6 border border-yellow-500/30">
                 <Sparkles className="w-6 h-6 text-yellow-500" />
               </div>
               <h3 className="text-2xl font-bold mb-3 tracking-tight italic">QRON STUDIO</h3>
               <p className="text-slate-400 text-sm leading-relaxed mb-8">AI-powered artistic QR codes (QronCode). Forensic Magic Eye utility with BTC Ordinals anchoring.</p>
               <a href="https://qron-space.undone-k.workers.dev" className="text-yellow-500 text-xs font-mono font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform">
                 EXPLORE STUDIO <ArrowRight className="w-3 h-3" />
               </a>
            </div>

            {/* StrainChain */}
            <div className="group relative p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-green-500/50 transition-all duration-500 overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
                  <Leaf className="w-32 h-32 text-green-500" />
               </div>
               <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-6 border border-green-500/30">
                 <Leaf className="w-6 h-6 text-green-500" />
               </div>
               <h3 className="text-2xl font-bold mb-3 tracking-tight italic">STRAINCHAIN</h3>
               <p className="text-slate-400 text-sm leading-relaxed mb-8">Cannabis provenance vertical. Seed-to-sale storymode with NFT marketplace and real-time lab verification.</p>
               <a href="https://strainchain-io.undone-k.workers.dev" className="text-green-500 text-xs font-mono font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform">
                 VIEW MARKETPLACE <ArrowRight className="w-3 h-3" />
               </a>
            </div>

            {/* GovChain */}
            <div className="group relative p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-blue-500/50 transition-all duration-500 overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
                  <Landmark className="w-32 h-32 text-blue-500" />
               </div>
               <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 border border-blue-500/30">
                 <Landmark className="w-6 h-6 text-blue-500" />
               </div>
               <h3 className="text-2xl font-bold mb-3 tracking-tight italic">GOVCHAIN</h3>
               <p className="text-slate-400 text-sm leading-relaxed mb-8">Sovereign document verification. "Made in USA" manufacturer deals and federal procurement audit trails.</p>
               <a href="https://govchain-us.undone-k.workers.dev" className="text-blue-500 text-xs font-mono font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform">
                 Sovereign Intake <ArrowRight className="w-3 h-3" />
               </a>
            </div>

            {/* AuthiChain API */}
            <div className="group relative p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-purple-500/50 transition-all duration-500 overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
                  <Zap className="w-32 h-32 text-purple-500" />
               </div>
               <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 border border-purple-500/30">
                 <Zap className="w-6 h-6 text-purple-500" />
               </div>
               <h3 className="text-2xl font-bold mb-3 tracking-tight italic">API GATEWAY</h3>
               <p className="text-slate-400 text-sm leading-relaxed mb-8">B2B infrastructure for the physical economy. Agent-first endpoints for classification and verification.</p>
               <a href="https://authichain-api-gateway.undone-k.workers.dev/docs" className="text-purple-500 text-xs font-mono font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform">
                 EXPLORE DOCS <ArrowRight className="w-3 h-3" />
               </a>
            </div>
          </div>
        </section>

        {/* Growth Band */}
        <div className="bg-yellow-500 py-4 text-center overflow-hidden whitespace-nowrap">
           <div className="flex gap-12 animate-marquee inline-block font-mono text-[10px] font-bold text-black uppercase tracking-[0.3em]">
              <span>Join the Authentic Economy</span>
              <span>Earn $QRON Rewards</span>
              <span>Made in USA Protocol</span>
              <span>Forensic QR Art</span>
              <span>Seed-to-Sale Storymode</span>
              <span>Decentralized Truth Layer</span>
           </div>
        </div>

        {/* How it Works / Protocol Loop */}
        <section id="how" className="container max-w-7xl px-6 py-32">
          <div className="text-center mb-24">
             <h2 className="text-5xl font-bold tracking-tighter uppercase italic mb-4">The Truth <span className="text-yellow-500">Substrate</span></h2>
             <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Observe. Classify. Act. Log.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 text-center relative">
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-yellow-500 font-mono font-bold text-xl">01</div>
              <h4 className="font-bold text-xl italic uppercase">Observe</h4>
              <p className="text-slate-500 text-sm px-4">Verify physical state via Vision/QR scanners.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-yellow-500 font-mono font-bold text-xl">02</div>
              <h4 className="font-bold text-xl italic uppercase">Classify</h4>
              <p className="text-slate-500 text-sm px-4">Map to one of 10 verticals via AI AutoFlow.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-yellow-500 font-mono font-bold text-xl">03</div>
              <h4 className="font-bold text-xl italic uppercase">Act</h4>
              <p className="text-slate-500 text-sm px-4">Generate assets, mint NFTs, or trigger outreach.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-yellow-500 font-mono font-bold text-xl">04</div>
              <h4 className="font-bold text-xl italic uppercase">Log</h4>
              <p className="text-slate-500 text-sm px-4">Record every action to the immutable ledger.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="container max-w-7xl px-6 py-20 border-t border-white/5 mt-32">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <span className="font-display text-xl tracking-tighter font-bold uppercase">
              AuthiChain
            </span>
          </div>
          <div className="flex gap-8 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            <a href="#" className="hover:text-yellow-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-yellow-500 transition-colors">Terms</a>
            <a href="#" className="hover:text-yellow-500 transition-colors">SLA</a>
          </div>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">© 2026 AuthiChain LLC. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
