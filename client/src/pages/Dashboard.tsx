import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Award, Gem, Package, ArrowRight, Bot, Loader2, Blocks, CheckCircle2, XCircle, Target, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery();
  const { data: subscription } = trpc.subscription.current.useQuery();
  const { data: usage } = trpc.subscription.usage.useQuery();
  const [, setLocation] = useLocation();

  const cards = [
    { title: "Products", value: metrics?.totalProducts ?? 0, icon: Package, color: "text-blue-400", path: "/authenticate" },
    { title: "Authentications", value: metrics?.totalAuthentications ?? 0, icon: Shield, color: "text-green-400", path: "/authenticate" },
    { title: "Certificates", value: metrics?.totalCertificates ?? 0, icon: Award, color: "text-yellow-400", path: "/certificates" },
    { title: "NFTs Owned", value: metrics?.totalNfts ?? 0, icon: Gem, color: "text-purple-400", path: "/nft" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your AuthiChain activity</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
              <Card key={c.title} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setLocation(c.path)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <c.icon className={`h-5 w-5 ${c.color}`} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{c.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.title}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Subscription Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                {subscription ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Plan</span>
                      <span className="font-medium capitalize">{subscription.plan}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className="text-sm px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 capitalize">{subscription.status}</span>
                    </div>
                    {usage && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Usage</span>
                          <span>{usage.used} / {usage.limit}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(usage.percentage, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">No active subscription</p>
                    <Button size="sm" onClick={() => setLocation("/subscriptions")}>Choose a Plan</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Authenticate a Product", path: "/authenticate", icon: Shield },
                  { label: "Generate QR Code", path: "/qr-codes", icon: Package },
                  { label: "Browse NFT Marketplace", path: "/nft", icon: Gem },
                  { label: "Configure AI Autopilot", path: "/autopilot", icon: Bot },
                  { label: "Blockchain Hub", path: "/blockchain", icon: Blocks },
                ].map((a) => (
                  <button
                    key={a.path}
                    onClick={() => setLocation(a.path)}
                    className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
                  >
                    <a.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm">{a.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* AgentZ Missions + Pipeline */}
          <div className="grid md:grid-cols-2 gap-6">
            <MissionSummaryCard />
            <PendingDraftsCard />
          </div>

          {/* Blockchain Status */}
          <BlockchainStatusCard />
        </>
      )}
    </div>
  );
}

function MissionSummaryCard() {
  const { data: missions } = trpc.missions.list.useQuery({}, { refetchInterval: 30_000 });
  const [, setLocation] = useLocation();
  const list = (missions as any[] | undefined) ?? [];

  const counts = {
    IN_PROGRESS: list.filter(m => m.status === "IN_PROGRESS").length,
    PLANNED:     list.filter(m => m.status === "PLANNED").length,
    BLOCKED:     list.filter(m => m.status === "BLOCKED").length,
    COMPLETED:   list.filter(m => m.status === "COMPLETED").length,
  };

  return (
    <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setLocation("/missions")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          AgentZ Missions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Active",     count: counts.IN_PROGRESS, color: "bg-blue-500/20 text-blue-300 border-blue-600" },
            { label: "Planned",    count: counts.PLANNED,     color: "bg-slate-500/20 text-slate-300 border-slate-600" },
            { label: "Blocked",    count: counts.BLOCKED,     color: "bg-orange-500/20 text-orange-300 border-orange-600" },
            { label: "Completed",  count: counts.COMPLETED,   color: "bg-emerald-500/20 text-emerald-300 border-emerald-600" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Badge variant="outline" className={`text-xs ${color}`}>{count}</Badge>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="w-full text-xs border-white/20">
          Open Missions <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function PendingDraftsCard() {
  const { data: drafts } = trpc.emailDrafts.listPending.useQuery(undefined, { refetchInterval: 30_000 });
  const [, setLocation] = useLocation();
  const list = (drafts as any[] | undefined) ?? [];
  const count = list.length;

  return (
    <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setLocation("/missions")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-yellow-400" />
          Pending Approvals
          {count > 0 && (
            <Badge variant="outline" className="ml-auto text-xs bg-yellow-500/20 text-yellow-300 border-yellow-600">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No drafts awaiting review</p>
        ) : (
          <div className="space-y-2">
            {list.slice(0, 4).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate text-white/80">{d.subject}</p>
                  <p className="truncate text-white/40">{d.prospectEmail}</p>
                </div>
                <Badge variant="outline" className="shrink-0 bg-yellow-500/20 text-yellow-300 border-yellow-600 text-xs">
                  review
                </Badge>
              </div>
            ))}
            {count > 4 && (
              <p className="text-xs text-muted-foreground text-center">+{count - 4} more</p>
            )}
            <Button size="sm" variant="outline" className="w-full text-xs border-yellow-500/30 text-yellow-300 mt-1">
              Review All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlockchainStatusCard() {
  const { data: status, isLoading } = trpc.blockchain.status.useQuery();
  const [, setLocation] = useLocation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Blocks className="h-4 w-4" />
          Blockchain Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : status?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">Thirdweb Connected</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Chain</span>
              <span>{status.chain}</span>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => setLocation("/blockchain")}>
              Open Blockchain Hub <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-muted-foreground">Not connected</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
