'use client';

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  ChevronLeft, 
  Play, 
  Video, 
  Download, 
  Share2,
  Loader2,
  Flame,
  Zap
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function MarketingFactoryPage() {
  const { data: products, isLoading } = trpc.products.list.useQuery();
  
  const generateStory = trpc.marketing.generateContent.useMutation({
    onSuccess: (data) => toast.success("Story narration generated! Ready for HeyGen."),
    onError: (e) => toast.error(e.message)
  });

  const highValueProducts = products?.filter(p => (p.authenticityScore ?? 0) >= 95) || [];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <header>
          <Link href="/admin" className="flex items-center gap-2 text-zinc-500 hover:text-gold transition-colors text-[10px] font-black uppercase tracking-widest mb-4">
            <ChevronLeft className="w-3 h-3" /> Dashboard
          </Link>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Marketing <span className="gold-text">Factory</span></h1>
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Autonomous Asset Generation & StoryMode Engine</p>
        </header>

        <section className="space-y-6">
           <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-gold" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">StoryMode Ready Artifacts</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {highValueProducts.map((product) => (
                <Card key={product.id} className="bg-zinc-950 border-zinc-900 group hover:border-gold/30 transition-all">
                   <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                         <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-gold/20">
                            <Video className="w-4 h-4 text-zinc-500 group-hover:text-gold" />
                         </div>
                         <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Score: {product.authenticityScore}%</span>
                         </div>
                      </div>
                      <CardTitle className="text-sm font-black uppercase text-white mt-4">{product.name}</CardTitle>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{product.brand}</p>
                   </CardHeader>
                   <CardContent className="space-y-6">
                      <div className="aspect-video rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                         <Play className="w-8 h-8 text-zinc-700 opacity-50 group-hover:text-gold group-hover:opacity-100 transition-all" />
                      </div>

                      <div className="flex gap-3">
                         <Button 
                           variant="outline" 
                           className="flex-1 text-[9px] font-black uppercase tracking-widest border-zinc-800 hover:text-gold"
                           onClick={() => generateStory.mutate({ type: 'blog', topic: `The story of ${product.name}` })}
                         >
                            Draft Story
                         </Button>
                         <Button className="flex-1 bg-gold hover:bg-yellow-500 text-black text-[9px] font-black uppercase tracking-widest">
                            HeyGen Render
                         </Button>
                      </div>
                   </CardContent>
                </Card>
              ))}

              {isLoading && (
                <div className="col-span-3 py-24 flex flex-col items-center justify-center">
                   <Loader2 className="w-8 h-8 animate-spin text-gold mb-4" />
                   <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Scanning Ledger for Assets...</p>
                </div>
              )}
           </div>
        </section>

        {/* Global Strategy */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12 border-t border-zinc-900">
           <div className="protocol-card p-8 bg-gold/[0.02] border-gold/10">
              <div className="flex items-center gap-3 mb-6">
                 <Flame className="w-5 h-5 text-orange-500" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-white">Viral Velocity</h3>
              </div>
              <p className="text-xs text-zinc-500 font-bold uppercase leading-relaxed tracking-tight mb-8">
                 High-fidelity products with 95+ trust scores are automatically prioritized for the Media Factory. AgentZ analyzes TikTok and X trends to inject relevant hooks into every generated script.
              </p>
              <div className="flex items-center gap-6">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-white">12.4K</p>
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Est. Reach</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-emerald-500">+18%</p>
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Engagement</p>
                 </div>
              </div>
           </div>

           <div className="protocol-card p-8 bg-blue-500/[0.02] border-blue-500/10">
              <div className="flex items-center gap-3 mb-6">
                 <Zap className="w-5 h-5 text-blue-400" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-white">Omnichannel Distribution</h3>
              </div>
              <p className="text-xs text-zinc-500 font-bold uppercase leading-relaxed tracking-tight mb-8">
                 Assets are rendered in 9:16 for mobile and 16:9 for desktop digital twins. Deployment is fully autonomous to Vercel Edge and Cloudflare R2 global nodes.
              </p>
              <div className="flex gap-3">
                 <Badge variant="outline" className="text-[7px] font-black border-zinc-800 text-zinc-600 uppercase">HEYGEN API</Badge>
                 <Badge variant="outline" className="text-[7px] font-black border-zinc-800 text-zinc-600 uppercase">ELEVENLABS</Badge>
                 <Badge variant="outline" className="text-[7px] font-black border-zinc-800 text-zinc-600 uppercase">R2 STORAGE</Badge>
              </div>
           </div>
        </section>
      </div>
    </div>
  );
}
