'use client';

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  ChevronLeft, 
  Box, 
  Globe, 
  Zap, 
  ArrowRight, 
  CheckCircle2,
  Loader2,
  Award
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

export default function BrandOnboardingPage() {
  // We use the marketing router for lead management and activation
  const { data: leads, refetch } = trpc.marketing.leads.useQuery();
  
  const activateBrand = trpc.marketing.activateBrand.useMutation({
    onSuccess: (data: any) => {
       toast.success(`Brand Activated! ${data.productCount} certificates anchored.`);
       refetch();
    },
    onError: (e) => toast.error(e.message)
  });

  const [activatingId, setActivatingId] = useState<number | null>(null);

  const handleActivate = (id: number) => {
    setActivatingId(id);
    activateBrand.mutate({ id });
  };

  const pendingBrands = leads?.filter(l => l.status === 'closed_won') || [];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <header>
          <Link href="/admin" className="flex items-center gap-2 text-zinc-500 hover:text-gold transition-colors text-[10px] font-black uppercase tracking-widest mb-4">
            <ChevronLeft className="w-3 h-3" /> Back to Intelligence
          </Link>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Sovereign <span className="gold-text">Activator</span></h1>
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Final Pilot Initialization & L1 Anchoring</p>
        </header>

        <section className="space-y-6">
           <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-gold" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Pending Activation Queue</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingBrands.map((brand) => (
                <Card key={brand.id} className="bg-zinc-950 border-zinc-900 group hover:border-gold/30 transition-all overflow-hidden">
                   <div className="bg-gold/5 px-6 py-4 border-b border-zinc-900 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                         </div>
                         <h3 className="font-black text-white uppercase text-sm">{brand.company || brand.name}</h3>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase text-[8px] font-black">Contract Signed</Badge>
                   </div>
                   <CardContent className="p-8 space-y-8">
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Industry</p>
                            <p className="text-xs font-bold text-zinc-300 uppercase">Luxury Timepieces</p>
                         </div>
                         <div className="space-y-1 text-right">
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Region</p>
                            <p className="text-xs font-bold text-zinc-300 uppercase">Geneva, CH</p>
                         </div>
                      </div>

                      <div className="p-4 rounded-xl bg-black border border-zinc-900 space-y-4">
                         <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            <span>Ready for Anchoring</span>
                            <span className="text-white">12 SKU Variants</span>
                         </div>
                         <div className="flex gap-2">
                            <div className="flex-1 h-1 bg-emerald-500 rounded-full" />
                            <div className="flex-1 h-1 bg-emerald-500 rounded-full" />
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full" />
                         </div>
                      </div>

                      <Button 
                        onClick={() => handleActivate(brand.id)}
                        disabled={activateBrand.isPending && activatingId === brand.id}
                        className="w-full py-6 bg-gold hover:bg-yellow-500 text-black font-black uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-gold/10 group"
                      >
                         {activateBrand.isPending && activatingId === brand.id ? (
                           <>
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                             Anchoring to L1...
                           </>
                         ) : (
                           <>
                             Activate Sovereign Identity <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                           </>
                         )}
                      </Button>
                   </CardContent>
                </Card>
              ))}

              {pendingBrands.length === 0 && (
                <div className="md:col-span-2 py-24 border border-dashed border-zinc-900 rounded-3xl flex flex-col items-center justify-center text-center px-6">
                   <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                      <Box className="w-8 h-8 text-zinc-800" />
                   </div>
                   <h3 className="font-black uppercase tracking-widest text-zinc-600">Activation Queue Empty</h3>
                   <p className="text-[10px] text-zinc-700 font-bold uppercase mt-2 max-w-xs">New pilot partners will appear here after the Autonomous Closer Agent secures the contract.</p>
                </div>
              )}
           </div>
        </section>

        {/* Global Registry State */}
        <section className="pt-12 border-t border-zinc-900">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-4">
                 <Zap className="w-6 h-6 text-gold" />
                 <h4 className="text-sm font-black uppercase tracking-widest text-white">One-Click Onboarding</h4>
                 <p className="text-xs text-zinc-500 font-bold uppercase leading-relaxed tracking-tight">Activate brand identities, mint genesis certificates, and provision digital twin portals in a single transaction.</p>
              </div>
              <div className="space-y-4">
                 <Globe className="w-6 h-6 text-blue-500" />
                 <h4 className="text-sm font-black uppercase tracking-widest text-white">Global L1 Anchoring</h4>
                 <p className="text-xs text-zinc-500 font-bold uppercase leading-relaxed tracking-tight">Direct integration with Hiro Ordinals API for Bitcoin L1 proof-of-existence inscriptions.</p>
              </div>
              <div className="space-y-4">
                 <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                 <h4 className="text-sm font-black uppercase tracking-widest text-white">Trust Continuity</h4>
                 <p className="text-xs text-zinc-500 font-bold uppercase leading-relaxed tracking-tight">Every activation event is logged to the protocol ledger for auditability by the DHS SVIP council.</p>
              </div>
           </div>
        </section>
      </div>
    </div>
  );
}
