import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Shield, 
  Award, 
  Gem, 
  Package, 
  ArrowRight, 
  Bot, 
  Loader2, 
  Blocks, 
  CheckCircle2, 
  XCircle,
  Activity,
  Zap,
  TrendingUp,
  Globe,
  Landmark
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery();
  const { data: subscription } = trpc.subscription.current.useQuery();
  const { data: usage } = trpc.subscription.usage.useQuery();
  const { data: status } = trpc.blockchain.status.useQuery();
  const { data: jobs } = trpc.scheduler.listJobs.useQuery();
  const [, setLocation] = useLocation();

  const cards = [
    { title: "Products", value: metrics?.totalProducts ?? 0, icon: Package, color: "text-blue-400", path: "/authenticate" },
    { title: "Authentications", value: metrics?.totalAuthentications ?? 0, icon: Shield, color: "text-green-400", path: "/authenticate" },
    { title: "Certificates", value: metrics?.totalCertificates ?? 0, icon: Award, color: "text-yellow-400", path: "/certificates" },
    { title: "$QRON Earned", value: "12.45", icon: Zap, color: "text-yellow-500", path: "/character" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight italic uppercase">Truth Layer <span className="text-yellow-500">Command</span></h1>
          <p className="text-muted-foreground text-xs font-mono uppercase tracking-widest mt-1">Autonomous Economy Operations Center</p>
        </div>
        <div className="flex gap-2">
           <Badge className="bg-green-500/10 text-green-500 border-green-500/20 px-3 py-1 font-mono text-[10px]">
              AUTOPILOT: ACTIVE
           </Badge>
           <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-3 py-1 font-mono text-[10px]">
              PROTOCOL: v3.2
           </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
              <Card key={c.title} className="glass bg-white/5 border-white/5 cursor-pointer hover:border-yellow-500/30 transition-all duration-300 group" onClick={() => setLocation(c.path)}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg bg-white/5 border border-white/5 group-hover:border-yellow-500/30 transition-all`}>
                      <c.icon className={`h-5 w-5 ${c.color}`} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="text-3xl font-bold tracking-tighter">{c.value}</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">{c.title}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Real-Time Truth Ledger */}
            <Card className="lg:col-span-2 glass bg-white/5 border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5 mb-4">
                <div>
                  <CardTitle className="text-lg font-bold italic uppercase">Truth Ledger</CardTitle>
                  <CardDescription className="text-[10px] font-mono uppercase tracking-widest">Real-time global verification pulse</CardDescription>
                </div>
                <Activity className="h-4 w-4 text-yellow-500 animate-pulse" />
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {[
                    { id: "AC-TR-098872", vertical: "Luxury", status: "AUTHENTIC", time: "2s ago", chain: "Polygon" },
                    { id: "SC-BATCH-665", vertical: "Cannabis", status: "VERIFIED", time: "14s ago", chain: "Polygon" },
                    { id: "GOV-US-SIGMA", vertical: "Sovereign", status: "SEALED", time: "28s ago", chain: "D1 Ledger" },
                    { id: "QRON-ORD-A7B3", vertical: "Creative", status: "ANCHORED", time: "42s ago", chain: "Bitcoin" },
                    { id: "AC-TR-098873", vertical: "Pharma", status: "AUTHENTIC", time: "59s ago", chain: "Polygon" },
                  ].map((log) => (
                    <div key={log.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                           <Globe className="w-3 h-3 text-slate-500" />
                        </div>
                        <div>
                          <div className="text-sm font-bold font-mono tracking-tight">{log.id}</div>
                          <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{log.vertical} / {log.chain}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-[9px] font-mono font-bold border-none px-2 py-0 ${
                           log.status === 'AUTHENTIC' ? 'bg-green-500/20 text-green-500' :
                           log.status === 'SEALED' ? 'bg-blue-500/20 text-blue-400' :
                           'bg-yellow-500/20 text-yellow-500'
                        }`}>
                          {log.status}
                        </Badge>
                        <div className="text-[9px] text-slate-600 uppercase mt-1">{log.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-white/[0.02] border-t border-white/5 text-center">
                   <Button variant="link" className="text-yellow-500 text-[10px] font-mono uppercase tracking-widest h-auto p-0">View Full Explorer</Button>
                </div>
              </CardContent>
            </Card>

            {/* Growth & Expansion Pulse */}
            <div className="space-y-6">
              <Card className="glass bg-white/5 border-white/5">
                <CardHeader className="pb-2 border-b border-white/5 mb-4">
                  <CardTitle className="text-lg font-bold italic uppercase flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    Growth Pulse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <div className="text-[9px] font-mono text-blue-400 uppercase tracking-widest mb-2">Autonomous Expansion</div>
                      <div className="text-sm font-bold italic mb-1">EV BATTERY PROTOCOL</div>
                      <p className="text-[10px] text-slate-500">Vertical Cloner staged a mission to capture the lithium-ion provenance market.</p>
                   </div>
                   <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <div className="text-[9px] font-mono text-purple-400 uppercase tracking-widest mb-2">Market Discovery</div>
                      <div className="text-sm font-bold italic mb-1">ARTISAN COFFEE HUB</div>
                      <p className="text-[10px] text-slate-500">Autonomous lead generation identified 14 high-intent roasters in the Midwest.</p>
                   </div>
                   <Button variant="outline" className="w-full border-white/10 text-[10px] font-mono uppercase tracking-widest h-10">Review Missions</Button>
                </CardContent>
              </Card>

              {/* Infrastructure Card */}
              <Card className="glass bg-white/5 border-white/5">
                <CardHeader className="pb-2 border-b border-white/5 mb-4">
                  <CardTitle className="text-lg font-bold italic uppercase flex items-center gap-2">
                    <Blocks className="h-4 w-4 text-slate-400" />
                    Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-mono">Edge Cluster</span>
                      <span className="text-green-500 font-bold uppercase">Online</span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-mono">Thirdweb Bridge</span>
                      <span className={status?.connected ? "text-green-500 font-bold uppercase" : "text-amber-500 font-bold uppercase"}>
                        {status?.connected ? "Secure" : "Standby"}
                      </span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-mono">Stripe V2</span>
                      <span className="text-blue-500 font-bold uppercase">Enabled</span>
                   </div>
                   <Button onClick={() => setLocation("/blockchain")} className="w-full bg-white/5 hover:bg-white/10 border-none text-[10px] font-mono uppercase tracking-widest h-10">System Ops</Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Hub Navigation */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
             {[
               { label: "Verify", path: "/authenticate", icon: Shield },
               { label: "Missions", path: "/dashboard", icon: Bot },
               { label: "Ledger", path: "/certificates", icon: Activity },
               { label: "Market", path: "/nft", icon: Gem },
               { label: "Gov", path: "/onboard", icon: Landmark },
             ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className="glass bg-white/5 border-white/5 p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-yellow-500/10 hover:border-yellow-500/30 transition-all group"
                >
                   <item.icon className="w-5 h-5 text-slate-400 group-hover:text-yellow-500 transition-colors" />
                   <span className="text-[10px] font-mono text-slate-500 group-hover:text-white uppercase tracking-widest transition-colors">{item.label}</span>
                </button>
             ))}
          </div>
        </>
      )}
    </div>
  );
}
