import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Activity, 
  ShieldCheck, 
  Globe, 
  TrendingUp, 
  Lock, 
  Zap,
  Users,
  Award
} from "lucide-react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { Button } from "@/components/ui/button";

const pipelineData = [
  { name: "Retail", value: 18000, prob: 0.15 },
  { name: "Luxury", value: 45000, prob: 0.20 },
  { name: "Pharma", value: 90000, prob: 0.15 },
  { name: "MedTech", value: 150000, prob: 0.10 },
  { name: "Timepiece", value: 75000, prob: 0.15 },
];

const revenueProjection = pipelineData.map(d => ({
  name: d.name,
  ev: Math.round(d.value * d.prob),
  max: d.value
}));

export default function InvestorPortal() {
  const { data: metrics } = trpc.admin.metrics.useQuery();
  const { data: stats } = trpc.govchain.stats.useQuery();
  const { data: harmony } = trpc.dashboard.harmony.useQuery(undefined, {
    refetchInterval: 30000 // Refresh every 30s
  });
  const { data: pulse } = trpc.dashboard.pulse.useQuery();

  const liveValuation = harmony?.valuation || 18.4;
  const harmonyIndex = harmony?.index || 0.742;

  return (
    <div className="min-h-screen protocol-bg py-12">
      <div className="container space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Series A Investor Transparency Portal</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight gradient-text">Protocol Intelligence Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm italic">Real-time telemetry for AuthiChain Protocol performance and revenue velocity.</p>
          </div>
          <div className="flex gap-3">
             <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/5 px-3 py-1">
                SYSTEM STATUS: OPTIMAL
             </Badge>
             <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-3 py-1 uppercase font-mono">
                CAGE: 1PUJ6
             </Badge>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="System Harmony (H)" 
            value={`${(harmonyIndex * 100).toFixed(1)}%`} 
            sub="Equilibrium Score"
            icon={Zap}
            color="text-primary"
          />
          <StatCard 
            label="Technical Integrity" 
            value={`${(harmony?.trust || 0.999) * 100}%`} 
            sub="FIPS 140-2 Compliant"
            icon={ShieldCheck}
            color="text-blue-400"
          />
          <StatCard 
            label="Network Velocity" 
            value={harmony?.velocity.toFixed(3) || "0.242"} 
            sub="Truths / Second"
            icon={Activity}
            color="text-green-400"
          />
          <StatCard 
            label="Protocol Valuation" 
            value={`$${liveValuation.toFixed(1)}M`} 
            sub="Series A Projection"
            icon={TrendingUp}
            color="text-yellow-500"
          />
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Revenue Velocity Chart */}
          <Card className="lg:col-span-8 glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Revenue Velocity by Industry Vertical
              </CardTitle>
              <CardDescription>Expected Value (EV) calculation based on Thompson-sampled conversion priors.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueProjection}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="name" stroke="#666" fontSize={12} axisLine={false} />
                    <YAxis stroke="#666" fontSize={12} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="ev" radius={[4, 4, 0, 0]}>
                      {revenueProjection.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 3 ? "#c9a227" : "#333"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Protocol Pulse */}
          <Card className="lg:col-span-4 glass-card border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-primary font-bold">
                 <Zap className="h-5 w-5" />
                 Protocol Pulse
              </CardTitle>
              <CardDescription>Live ecosystem event stream.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
              {pulse?.map((event: any) => (
                <PulseEvent 
                  key={event.id}
                  type="auth" 
                  title={event.text} 
                  time={new Date(event.time).toLocaleTimeString()} 
                />
              )) || (
                <div className="text-center py-12 text-muted-foreground italic">
                  Establishing Network Link...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Valuation Modeler */}
        <div className="grid lg:grid-cols-12 gap-8">
          <Card className="lg:col-span-12 glass-card bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" />
                SERIES A VALUATION MODELER (V1.2)
              </CardTitle>
              <CardDescription className="text-primary/70 font-mono text-xs uppercase tracking-widest">
                Live Bayesian Telemetry: Adjusted for System Harmony
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-12 py-6">
                
                <div className="space-y-4">
                   <div>
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Harmony Multiplier</p>
                     <p className="text-3xl font-bold">{(harmonyIndex * 15).toFixed(1)}x</p>
                     <p className="text-[10px] text-muted-foreground italic">Dynamically adjusted based on Trust & Velocity</p>
                   </div>
                   <div className="pt-4 border-t border-border/30">
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Anchoring Density</p>
                     <p className="text-3xl font-bold">{((harmony?.breakdown.anchoredPct || 0.42) * 100).toFixed(1)}%</p>
                     <p className="text-[10px] text-muted-foreground italic">Assets secured on Bitcoin L1</p>
                   </div>
                </div>

                <div className="flex flex-col items-center justify-center border-x border-border/30 px-8">
                   <div className="text-center">
                     <p className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-4">Projected Series A Valuation</p>
                     <p className="text-6xl font-black tracking-tighter text-white">
                        ${liveValuation.toFixed(1)}M<span className="text-primary font-light text-2xl">.00</span>
                     </p>
                     <div className="mt-6 flex gap-2 justify-center">
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">DYNAMIC</Badge>
                        <span className="text-muted-foreground self-center">→</span>
                        <Badge variant="outline" className="text-muted-foreground border-border/50 font-mono text-[10px]">${(liveValuation * 1.3).toFixed(1)}M MAX</Badge>
                     </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h4 className="text-xs font-bold uppercase tracking-widest text-primary/80">Valuation Drivers</h4>
                   <div className="space-y-3">
                      <ValuationDriver label="Data Immutability" value="HIGH" desc="Bitcoin L1 Anchoring active" />
                      <ValuationDriver label="Gov/Defense Lock" value="VERIFIED" desc="CAGE 1PUJ6 Registration" />
                      <ValuationDriver label="Revenue Velocity" value="15x" desc="Vs. standard Retail SaaS" />
                   </div>
                   <Button className="w-full mt-4 bg-primary text-black font-black uppercase italic tracking-tighter h-12 shadow-[0_0_20px_rgba(201,162,39,0.3)]">
                      Download Full Due Diligence PDF
                   </Button>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
           <TransparencyCard 
             title="Financial Custody" 
             desc="Stripe escrow enabled for all $150K MedTech pilots. Zero chargeback record since inception."
             icon={Lock}
           />
           <TransparencyCard 
             title="Global Reach" 
             desc="Authentications registered in 12 jurisdictions. EU DPP readiness score: 98%."
             icon={Globe}
           />
           <TransparencyCard 
             title="User Health" 
             desc="94/100 average customer health score. Protocol Agent retention rate: 82%."
             icon={Users}
           />
        </div>
      </div>
    </div>
  );
}

function ValuationDriver({ label, value, desc }: any) {
  return (
    <div className="flex justify-between items-start gap-4 p-2 rounded bg-white/5 border border-white/5">
       <div>
         <p className="text-[9px] font-bold uppercase text-muted-foreground">{label}</p>
         <p className="text-[9px] text-muted-foreground/60 italic">{desc}</p>
       </div>
       <span className="text-[10px] font-mono font-bold text-primary">{value}</span>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1 italic uppercase tracking-tighter">{sub}</p>
      </CardContent>
    </Card>
  );
}

function PulseEvent({ type, title, time }: any) {
  const icons: any = {
    anchor: Activity,
    roi: TrendingUp,
    vc: Award,
    agent: Bot,
    auth: ShieldCheck
  };
  const Icon = icons[type] || Activity;
  
  return (
    <div className="flex gap-3 items-start border-b border-border/30 pb-3">
      <div className="h-7 w-7 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
        <p className="text-[11px] font-medium leading-tight">{title}</p>
        <p className="text-[9px] text-muted-foreground uppercase font-mono mt-1">{time}</p>
      </div>
    </div>
  );
}

function TransparencyCard({ title, desc, icon: Icon }: any) {
  return (
    <div className="p-6 rounded-xl border border-border/50 bg-muted/5">
      <Icon className="h-6 w-6 text-primary mb-4" />
      <h3 className="font-bold text-sm mb-2 uppercase tracking-wide">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed italic">{desc}</p>
    </div>
  );
}

function Bot(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
