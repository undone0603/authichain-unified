import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Award, Gem, Package, ArrowRight, Bot, Loader2, Blocks, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

          {/* Blockchain Status */}
          <BlockchainStatusCard />
        </>
      )}
    </div>
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
