import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  UserPlus, 
  Zap, 
  Star, 
  History, 
  TrendingUp, 
  Activity, 
  ArrowUpRight,
  Loader2,
  Award
} from "lucide-react";
import { Link, useLocation } from "wouter";

export default function CharacterDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const myAgent = trpc.character.myAgent.useQuery();
  const rewards = trpc.character.agentRewards.useQuery(
    { agentId: myAgent.data?.id || 0 },
    { enabled: !!myAgent.data }
  );

  if (myAgent.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  // If no agent, show onboarding
  if (!myAgent.data) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="text-center mb-12">
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 mb-4 px-3 py-1 font-mono tracking-widest uppercase text-[10px]">
            Workforce Inactive
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase italic mb-6">Deploy Your <span className="text-yellow-500">Agent.</span></h1>
          <p className="text-slate-400 text-lg font-light mb-8 max-w-xl mx-auto">
            You don't have an active protocol agent yet. Deploy a specialized AI character to automate your authentications and earn $QRON rewards.
          </p>
          <Button asChild size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-16 px-10 rounded-xl shadow-2xl shadow-yellow-500/20">
            <Link href="/character/create">Start Generation Protocol</Link>
          </Button>
        </div>
      </div>
    );
  }

  const agent = myAgent.data;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Agent Identity Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-full group-hover:bg-yellow-500/40 transition-all duration-500" />
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-3xl overflow-hidden border-2 border-yellow-500/50 shadow-2xl">
               <img src={""} alt={agent.name} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase italic">{agent.name}</h1>
              <Badge className="bg-yellow-500 text-black font-bold border-none text-[10px] px-2 py-0">LEVEL {Math.floor((agent.xp || 0) / 1000) + 1}</Badge>
            </div>
            <p className="text-slate-500 font-mono text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <Shield className="w-3 h-3" /> {agent.agentType} Protocol Specialist
            </p>
          </div>
        </div>

        <div className="flex gap-3">
           <Card className="bg-white/5 border-white/5 px-6 py-3 rounded-2xl flex flex-col items-center justify-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">REPUTATION</span>
              <span className="text-xl font-bold text-blue-400">{agent.reputationScore ?? 0}</span>
           </Card>
           <Card className="bg-yellow-500/10 border-yellow-500/20 px-6 py-3 rounded-2xl flex flex-col items-center justify-center">
              <span className="text-[10px] font-mono text-yellow-500 uppercase tracking-widest mb-1">$QRON EARNED</span>
              <span className="text-xl font-bold text-yellow-500">12.45</span>
           </Card>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/5 p-6 hover:border-yellow-500/30 transition-all duration-500 group">
          <div className="flex justify-between items-start mb-4">
             <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
               <Zap className="w-5 h-5 text-yellow-500" />
             </div>
             <TrendingUp className="w-4 h-4 text-slate-600 group-hover:text-yellow-500 transition-colors" />
          </div>
          <div className="text-2xl font-bold mb-1">{agent.xp} XP</div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Protocol Experience Points</div>
          <div className="mt-4 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
             <div className="bg-yellow-500 h-full" style={{ width: `${((agent.xp ?? 0) % 1000) / 10}%` }} />
          </div>
        </Card>

        <Card className="bg-white/5 border-white/5 p-6 hover:border-blue-500/30 transition-all duration-500 group">
          <div className="flex justify-between items-start mb-4">
             <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
               <Shield className="w-5 h-5 text-blue-500" />
             </div>
             <Activity className="w-4 h-4 text-slate-600 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="text-2xl font-bold mb-1">94%</div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Consensus Accuracy</div>
        </Card>

        <Card className="bg-white/5 border-white/5 p-6 hover:border-purple-500/30 transition-all duration-500 group">
          <div className="flex justify-between items-start mb-4">
             <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/30">
               <Award className="w-5 h-5 text-purple-500" />
             </div>
             <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-purple-500 transition-colors" />
          </div>
          <div className="text-2xl font-bold mb-1">112</div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Verified Provenance Chains</div>
        </Card>
      </div>

      {/* Activity & Rewards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-white/5 border-white/5 overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/[0.02]">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-bold italic uppercase tracking-tight">Recent Proof of Work</CardTitle>
                <CardDescription className="text-xs font-mono">Real-time ledger entries from your agent</CardDescription>
              </div>
              <History className="w-4 h-4 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 text-yellow-500 font-mono text-[10px]">
                      0{i}
                    </div>
                    <div>
                      <div className="text-sm font-bold">Verification Claim Sealed</div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Product ID: AC-TR-098872</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-yellow-500 font-bold">+0.50 QRON</div>
                    <div className="text-[9px] text-slate-600 uppercase">2m ago</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/5 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-from)_0%,transparent_70%)] from-yellow-500/5 pointer-events-none" />
          <Star className="w-12 h-12 text-yellow-500 mb-6 animate-pulse" />
          <h3 className="text-2xl font-bold mb-3 italic uppercase tracking-tight">Protocol Advancement</h3>
          <p className="text-slate-400 text-sm mb-8 max-w-xs mx-auto">
            Your agent is performing in the top 5% of the network. Stake an additional 100 $QRON to unlock **Multi-ControlNet Artistry**.
          </p>
          <Button className="w-full bg-white text-black font-bold h-12 uppercase italic text-xs tracking-widest rounded-xl hover:bg-slate-200 transition-all">
            Upgrade Agent Matrix
          </Button>
        </Card>
      </div>
    </div>
  );
}
