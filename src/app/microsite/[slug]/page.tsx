import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Shield, 
  Cpu, 
  Globe, 
  Lock, 
  Zap, 
  ChevronRight, 
  Activity, 
  Box,
  Fingerprint,
  Database,
  Code2,
  Terminal,
  ShieldCheck
} from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MicrositePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  
  const { data: leads, error } = await supabase
    .from('lead_captures')
    .select('id, name, company, industry, metadata');

  if (error || !leads) {
    notFound();
  }

  const lead = leads.find(l => {
     let meta: any = {};
     try {
       meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : (l.metadata || {});
     } catch (e) {
       console.error("Failed to parse metadata", e);
     }
     return meta?.slug?.toLowerCase() === slug.toLowerCase();
  });

  if (!lead) {
    notFound();
  }

  const metadata = (lead.metadata as any) || {};
  const industry = lead.industry || 'Global Trade';
  const company = lead.company || lead.name || 'Your Brand';

  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-emerald-500 selection:text-black font-sans overflow-x-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('/media/grid.svg')] bg-center opacity-[0.03]" />
      </div>

      {/* Nav */}
      <nav className="relative z-50 px-8 py-8 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.4em] text-white/80">AuthiChain Protocol</span>
        </div>
        <div className="flex items-center gap-8">
           <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/80">Identity Channel Active</span>
           </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-24">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          {/* Left Content */}
          <div className="space-y-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                <Activity className="w-3 h-3" />
                Autonomous Partnership Provisioning
              </div>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] uppercase">
                The Future of <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  {company}
                </span>
              </h1>
              <p className="text-xl text-zinc-400 font-medium leading-relaxed max-w-xl">
                AgentZ has autonomously identified <span className="text-white font-bold">{company}</span> as a high-fidelity candidate for the 2026 AuthiChain Pilot Program. Your digital twin architecture is now ready for initialization.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center">
                     <Fingerprint className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-white/60 mb-1">Identity Vertical</h3>
                    <p className="font-bold text-lg text-white uppercase">{industry}</p>
                  </div>
               </div>
               <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center">
                     <Database className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-white/60 mb-1">Protocol Tier</h3>
                    <p className="font-bold text-lg text-white uppercase">Sovereign Edge</p>
                  </div>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6">
               <Link href={`https://authichain.com/pilot?lead=${lead.id}`} className="w-full sm:w-auto px-10 py-5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                  Initialize Twin <ChevronRight className="w-5 h-5" />
               </Link>
               <Link href="/about" className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:text-white transition-colors">
                  Review Protocol Docs
               </Link>
            </div>
          </div>

          {/* Right Visual (The Digital Twin Preview) */}
          <div className="relative group">
             <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
             <div className="relative p-1 rounded-[32px] bg-gradient-to-br from-white/20 to-transparent shadow-2xl">
                <div className="bg-[#0a0a0a] rounded-[31px] overflow-hidden border border-white/5">
                   <div className="h-12 bg-white/5 border-b border-white/5 flex items-center px-6 justify-between">
                      <div className="flex gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                         <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                         <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600 italic">
                         Protocol Sandbox v2.4
                      </div>
                   </div>
                   
                   <div className="p-12 space-y-12">
                      <div className="flex items-center gap-6">
                         <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center relative overflow-hidden">
                            <Box className="w-10 h-10 text-zinc-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent" />
                         </div>
                         <div>
                            <h4 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">{company} Artifact</h4>
                            <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                               <span className="text-[10px] font-black uppercase text-emerald-500/80">Awaiting Physical Anchor</span>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-6">
                         <div className="h-px bg-gradient-to-r from-white/10 to-transparent" />
                         <div className="space-y-4">
                            {[
                               { label: "Cryptographic Hash", val: "ED25519_PENDING_INIT", icon: Lock },
                               { label: "Supply Chain Node", val: "US_CENTRAL_01", icon: Globe },
                               { label: "Trust Score", val: "CALCULATING...", icon: Activity }
                            ].map((item, i) => (
                               <div key={i} className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <item.icon className="w-4 h-4 text-zinc-700" />
                                     <span className="text-[10px] font-black uppercase text-zinc-500">{item.label}</span>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-zinc-400">{item.val}</span>
                               </div>
                            ))}
                         </div>
                         <div className="h-px bg-gradient-to-r from-white/10 to-transparent" />
                      </div>

                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl space-y-4">
                         <div className="flex items-center gap-3">
                            <Cpu className="w-5 h-5 text-emerald-500" />
                            <h5 className="text-xs font-black uppercase text-white">AgentZ Insight</h5>
                         </div>
                         <p className="text-[11px] font-medium text-zinc-400 leading-relaxed italic">
                            "Initial analysis indicates a 98% reduction in counterfeit risk for {company}'s primary SKUs. Recommended first step: Secure the Sovereign Document status via Ed25519 anchoring."
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-40 grid md:grid-cols-3 gap-12 pt-20 border-t border-white/5">
           <div className="space-y-4">
              <Zap className="w-6 h-6 text-emerald-500" />
              <h4 className="text-sm font-black uppercase tracking-widest text-white">Instant Scalability</h4>
              <p className="text-xs text-zinc-500 leading-relaxed uppercase font-bold tracking-tight">Provision up to 10,000 digital twins per second on our Layer 2 anchoring protocol.</p>
           </div>
           <div className="space-y-4">
              <Shield className="w-6 h-6 text-cyan-500" />
              <h4 className="text-sm font-black uppercase tracking-widest text-white">Military Grade Trust</h4>
              <p className="text-xs text-zinc-500 leading-relaxed uppercase font-bold tracking-tight">Quantum-resistant cryptographic identifiers that cannot be cloned or spoofed.</p>
           </div>
           <div className="space-y-4">
              <Globe className="w-6 h-6 text-blue-500" />
              <h4 className="text-sm font-black uppercase tracking-widest text-white">Global Interop</h4>
              <p className="text-xs text-zinc-500 leading-relaxed uppercase font-bold tracking-tight">Fully compliant with EU DPP and FDA DSCSA standards for international trade.</p>
           </div>
        </div>

        {/* SDK Embed Section */}
        <section className="mt-40 p-12 rounded-[32px] bg-white/[0.02] border border-white/5 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5">
              <Code2 className="w-40 h-40 text-white" />
           </div>
           
           <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest mb-6">
                    <Terminal className="w-3 h-3" />
                    Truth SDK v1.0
                 </div>
                 <h2 className="text-4xl font-black uppercase tracking-tighter mb-6">Propagate the <span className="text-gold">Truth</span></h2>
                 <p className="text-zinc-400 font-medium leading-relaxed mb-8">
                    Place the AuthiChain live verification seal directly on your product pages, checkout flows, or partner portals with a single line of code.
                 </p>
                 
                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                       <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">Real-time Trust Score Sync</p>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                       <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">Signed W3C Credential Bridge</p>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="p-6 rounded-2xl bg-black border border-white/10 font-mono text-[11px] text-zinc-500 space-y-4">
                    <p className="text-zinc-700">// Add to your HTML header</p>
                    <code className="block text-emerald-500/80 break-all">
                       &lt;script src="https://authichain.com/sdk/truth-seal.js"&gt;&lt;/script&gt;
                    </code>
                    <p className="text-zinc-700">// Place where you want the seal</p>
                    <code className="block text-blue-400">
                       &lt;div data-authichain-product-id="{lead.id}"&gt;&lt;/div&gt;
                    </code>
                 </div>
                 
                 <div className="flex items-center justify-between px-4">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Preview:</span>
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-white/10 bg-black text-white">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                            <span className="text-gold mr-1">{company}</span>Verified
                          </span>
                       </div>
                       <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 ml-1" />
                    </div>
                 </div>
              </div>
           </div>
        </section>
      </main>

      <footer className="px-8 py-12 border-t border-white/5 text-center">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-800">
            Powered by AuthiChain Protocol &bull; Secure Digital Provenance
         </p>
      </footer>
    </div>
  );
}
