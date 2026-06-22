import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Zap, 
  TrendingUp, 
  Lock, 
  ArrowRight, 
  Wallet,
  Trophy,
  History
} from "lucide-react";
import { toast } from "sonner";

export default function StakingHub() {
  const { data: positions, refetch } = trpc.staking.list.useQuery();
  const { data: agent } = trpc.character.getAgent.useQuery();
  
  const stake = trpc.staking.stake.useMutation({
    onSuccess: () => {
      toast.success("Tokens Staked Successfully");
      refetch();
    },
    onError: (e) => toast.error(e.message)
  });

  const [amount, setAmount] = useState("1000");

  return (
    <div className="min-h-screen protocol-bg py-12">
      <div className="container max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="protocol-badge mb-4 mx-auto">Truth Validator Program</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight gradient-text">QRON Staking & Reputation</h1>
          <p className="text-muted-foreground text-lg mt-2">
            Stake $QRON to increase your Protocol Agent's consensus weight and earn validation rewards.
          </p>
        </div>

        <div className="grid md:grid-cols-12 gap-8">
          {/* Stake Form */}
          <Card className="md:col-span-5 glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Active Staking
              </CardTitle>
              <CardDescription>Lock tokens to amplify your agent's authority.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                  <span className="text-muted-foreground">Staking APY</span>
                  <span className="text-primary">12.5%</span>
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-muted-foreground">Agent Multiplier</span>
                  <span className="text-yellow-500">x1.50</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount to Stake ($QRON)</label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-background/50 pl-10"
                  />
                  <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Button className="w-full h-12 font-bold" onClick={() => stake.mutate({ amount: amount, agentId: agent?.id })}>
                Initialize Staking Lock <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <p className="text-[10px] text-center text-muted-foreground italic">
                Staked tokens are locked for a minimum of 90 days. Unstaking triggers a 7-day cooldown.
              </p>
            </CardContent>
          </Card>

          {/* Agent Reputation */}
          <div className="md:col-span-7 space-y-6">
            <Card className="glass-card bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Agent Authority Status
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Reputation Score</p>
                  <p className="text-2xl font-bold">{agent?.reputationScore || "842"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Consensus Weight</p>
                  <p className="text-2xl font-bold">{(agent?.level || 1) * 1.5}x</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Validations</p>
                  <p className="text-2xl font-bold">{agent?.totalVerifications || "124"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Rewards Earned</p>
                  <p className="text-2xl font-bold text-primary">{agent?.qronPending || "45.20"} QRON</p>
                </div>
              </CardContent>
            </Card>

            {/* Active Positions */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Staking History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {positions && positions.length > 0 ? (
                  positions.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center p-3 rounded border border-border/30 bg-muted/5">
                       <div>
                         <p className="text-xs font-bold">{p.amount} $QRON</p>
                         <p className="text-[10px] text-muted-foreground uppercase">{new Date(p.stakedAt).toLocaleDateString()}</p>
                       </div>
                       <Badge variant="outline" className="text-[9px] uppercase border-primary/20 text-primary">
                         {p.status}
                       </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm italic">
                    No active staking positions found.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
