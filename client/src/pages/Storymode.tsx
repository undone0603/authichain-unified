import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, MapPin, History, ShieldCheck } from "lucide-react";

export default function Storymode() {
  const [, params] = useRoute("/story/:id");
  const truemarkId = params?.id;

  const storyQuery = trpc.authenticate.history.useQuery(undefined, {
    select: (data) => data.find(d => String(d.id) === truemarkId) || data[0]
  });

  if (storyQuery.isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  const story = storyQuery.data;

  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-yellow-500/30">
      {/* Cinematic Background */}
      <div className="fixed inset-0 bg-gradient-to-b from-yellow-500/10 via-transparent to-black pointer-events-none" />
      <div className="fixed inset-0 backdrop-blur-[100px] pointer-events-none" />

      <div className="container max-w-4xl py-12 relative z-10">
        <div className="flex justify-between items-start mb-12">
          <div>
            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 mb-4 px-3 py-1">
              AI STORYMODE ACTIVE
            </Badge>
            <h1 className="text-5xl font-bold tracking-tighter mb-2 italic">
              THE JOURNEY OF {story?.productId || "TRUTH"}
            </h1>
            <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">
              Provenance Ledger: {truemarkId || "SECURED"}
            </p>
          </div>
          <div className="w-16 h-16 rounded-full border border-yellow-500/30 flex items-center justify-center bg-yellow-500/5 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
             <Sparkles className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="space-y-32 mt-24">
          {/* Chapter 1 */}
          <div className="relative pl-12 border-l border-yellow-500/20">
            <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-yellow-500 shadow-[0_0_15px_rgba(212,175,55,0.5)]" />
            <div className="flex items-center gap-3 text-yellow-500 font-mono text-xs mb-4 tracking-[0.3em] uppercase">
               <MapPin className="w-4 h-4" /> 01 / Origin
            </div>
            <h2 className="text-3xl font-bold mb-6 italic">ROOTED IN AUTHENTICITY</h2>
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl font-light">
              This product was birthed from the volcanic soils and artisanal curation verified under the AuthiChain Truth Protocol. Every molecule of its existence was observed and logged.
            </p>
          </div>

          {/* Chapter 2 */}
          <div className="relative pl-12 border-l border-yellow-500/20">
            <div className="absolute -left-3 top-0 w-6 h-6 rounded-full border-2 border-yellow-500 bg-black" />
            <div className="flex items-center gap-3 text-yellow-500 font-mono text-xs mb-4 tracking-[0.3em] uppercase">
               <History className="w-4 h-4" /> 02 / Classification
            </div>
            <h2 className="text-3xl font-bold mb-6 italic">AI AUTOFLOW MAPPING</h2>
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl font-light">
              Upon reaching the truth threshold, our neural engines classified this asset as High-Fidelity. A unique workflow was generated to preserve its legacy on-chain.
            </p>
          </div>

          {/* Chapter 3 */}
          <div className="relative pl-12 border-l border-yellow-500/20">
            <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-yellow-500 animate-pulse" />
            <div className="flex items-center gap-3 text-yellow-500 font-mono text-xs mb-4 tracking-[0.3em] uppercase">
               <ShieldCheck className="w-4 h-4" /> 03 / Sealing
            </div>
            <h2 className="text-3xl font-bold mb-6 italic">TRUEMARK FINALITY</h2>
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl font-light">
              The cryptographic seal has been applied. This item is now an immutable node in the Authentic Economy. Anchored to Bitcoin. Verified by the network.
            </p>
          </div>
        </div>

        <div className="mt-48 text-center pb-24">
          <p className="text-gray-500 font-mono text-[10px] mb-8 uppercase tracking-widest">
            End of Provenance Narrative — AuthiChain LLC © 2026
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 h-12 px-8 font-bold italic">
               SHARE JOURNEY
            </Button>
            <Button className="bg-yellow-500 text-black hover:bg-yellow-600 h-12 px-8 font-bold italic">
               MINT STORY ARCHIVE
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
