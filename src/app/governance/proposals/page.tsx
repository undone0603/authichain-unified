'use client';

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, 
  Gavel, 
  Vote, 
  ChevronLeft, 
  CheckCircle2, 
  XCircle,
  Clock,
  Activity,
  Box
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function GovernanceProposalsPage() {
  const { data: disputes, isLoading, refetch } = trpc.governance.listDisputes.useQuery();
  
  const castVote = trpc.governance.castVote.useMutation({
    onSuccess: (data) => {
      toast.success(`Vote cast with weight ${data.weight}!`);
      refetch();
    },
    onError: (e) => toast.error(e.message)
  });

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <Link href="/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-gold transition-colors text-[10px] font-black uppercase tracking-widest mb-4">
              <ChevronLeft className="w-3 h-3" /> Dashboard
            </Link>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Protocol <span className="gold-text">Governance</span></h1>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Hybrid Human-AI Truth Arbitration</p>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-6">
             <div className="text-right">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Voting Power</p>
                <p className="text-xl font-black text-white">1,240 <span className="text-[10px] text-zinc-500">QRON-W</span></p>
             </div>
             <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Gavel className="w-5 h-5 text-gold" />
             </div>
          </div>
        </header>

        <section className="space-y-8">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <ShieldAlert className="w-5 h-5 text-gold" />
                 <h2 className="text-sm font-black uppercase tracking-widest text-white">Open Truth Disputes</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                 <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Active Consensus Rounds</span>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {disputes?.map((dispute) => (
                <Card key={dispute.id} className="bg-zinc-950 border-zinc-900 group hover:border-gold/30 transition-all overflow-hidden flex flex-col">
                   <div className="bg-zinc-900/40 px-6 py-4 border-b border-zinc-900 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                         <Box className="w-4 h-4 text-zinc-500" />
                         <span className="text-[10px] font-black uppercase text-zinc-300">Artifact #{dispute.productId}</span>
                      </div>
                      <Badge className="bg-zinc-900 border-zinc-800 text-[8px] font-black uppercase">Low Confidence</Badge>
                   </div>
                   
                   <CardContent className="p-8 flex-1 flex flex-col space-y-8">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">{dispute.productName}</h3>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{dispute.brand}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-black border border-zinc-900 space-y-4">
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">AI Security Score</span>
                            <span className="text-sm font-black text-yellow-500">{dispute.aiScore}%</span>
                         </div>
                         <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500" style={{ width: `${dispute.aiScore}%` }} />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-center py-4 border-y border-zinc-900">
                         <div>
                            <p className="text-lg font-black text-emerald-500">{dispute.votesAuthentic}</p>
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Authentic</p>
                         </div>
                         <div>
                            <p className="text-lg font-black text-red-500">{dispute.votesCounterfeit}</p>
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Counterfeit</p>
                         </div>
                      </div>

                      <div className="flex gap-4 pt-4 mt-auto">
                         <Button 
                           onClick={() => castVote.mutate({ disputeId: dispute.id, vote: "authentic" })}
                           disabled={castVote.isPending}
                           className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest h-12"
                         >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Authentic
                         </Button>
                         <Button 
                           onClick={() => castVote.mutate({ disputeId: dispute.id, vote: "counterfeit" })}
                           disabled={castVote.isPending}
                           className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-[10px] tracking-widest h-12"
                         >
                            <XCircle className="w-3.5 h-3.5 mr-2" /> Counterfeit
                         </Button>
                      </div>
                      
                      <div className="flex items-center justify-center gap-2 text-[8px] font-black text-zinc-700 uppercase tracking-[0.2em] mt-4">
                         <Clock className="w-2.5 h-2.5" />
                         <span>Ends: {new Date(dispute.deadline).toLocaleDateString()}</span>
                      </div>
                   </CardContent>
                </Card>
              ))}

              {disputes?.length === 0 && (
                <div className="lg:col-span-3 py-32 border border-dashed border-zinc-900 rounded-[32px] flex flex-col items-center justify-center text-center px-6">
                   <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-8 h-8 text-zinc-800" />
                   </div>
                   <h3 className="font-black uppercase tracking-widest text-zinc-600">Protocol is Quiet</h3>
                   <p className="text-[10px] text-zinc-700 font-bold uppercase mt-2 max-w-xs">No active truth disputes. The Security Council AI is maintaining 100% consensus on the current block.</p>
                </div>
              )}
           </div>
        </section>
      </div>
    </div>
  );
}
