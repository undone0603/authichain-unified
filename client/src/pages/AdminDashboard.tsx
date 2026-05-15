import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, Users, DollarSign, AlertTriangle, Activity, BarChart3, Settings, ShoppingBag } from "lucide-react";
import SystemControlPanel from "@/components/SystemControlPanel";
import { ORDER_STATUSES, type OrderStatus } from "@shared/const";

const SERVICE_NAMES: Record<string, string> = {
  authenticity_audit: "Authenticity Audit",
  cinematic_page: "Cinematic Product Page",
  automation_setup: "Automation Setup",
  landing_page: "Landing Page",
  brand_story_pack: "Brand Story Pack",
  government_dossier: "Government Dossier",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  paid: "secondary",
  in_progress: "default",
  delivered: "secondary",
  cancelled: "destructive",
};

export default function AdminDashboard() {
  const { data: metrics, isLoading } = trpc.admin.metrics.useQuery();
  const { data: users } = trpc.admin.users.useQuery();
  const { data: revenue } = trpc.admin.revenue.useQuery();
  const { data: revenueStats } = trpc.admin.revenueStats.useQuery();
  const { data: fraudAlerts } = trpc.admin.fraudAlerts.useQuery();
  const { data: healthScores } = trpc.admin.healthScores.useQuery();
  const { data: activity } = trpc.admin.activity.useQuery({ limit: 30 });
  const { data: subscriptions } = trpc.admin.subscriptions.useQuery();

  if (isLoading) return (
    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform overview and management (admin only)</p>
      </div>

      {/* Metrics Overview */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Total Users" value={metrics?.totalUsers ?? 0} />
        <MetricCard icon={Shield} label="Authentications" value={metrics?.totalAuthentications ?? 0} />
        <MetricCard icon={DollarSign} label="Revenue" value={`$${metrics?.totalRevenue ?? "0"}`} />
        <MetricCard icon={AlertTriangle} label="Fraud Alerts" value={fraudAlerts?.length ?? 0} color="text-red-400" />
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="users">Users ({users?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Alerts ({fraudAlerts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="health">Health Scores</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="subs">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          {revenueStats ? (
            <>
              {/* MRR / ARR / Revenue KPIs */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="MRR" value={`$${revenueStats.mrr.toLocaleString()}`} sub="monthly recurring" color="text-green-400" />
                <StatCard label="ARR" value={`$${revenueStats.arr.toLocaleString()}`} sub="annualised" color="text-blue-400" />
                <StatCard label="Revenue (30d)" value={`$${revenueStats.revenue30d.toLocaleString()}`} sub="last 30 days" />
                <StatCard label="Total Revenue" value={`$${revenueStats.totalRevenue.toLocaleString()}`} sub="all time" />
              </div>

              {/* Subscription health */}
              <div className="grid sm:grid-cols-3 gap-4">
                <StatCard label="Active Subs" value={revenueStats.activeSubs} sub={`of ${revenueStats.totalSubs} total`} color="text-green-400" />
                <StatCard label="Past Due" value={revenueStats.pastDueSubs} sub="need recovery" color={revenueStats.pastDueSubs > 0 ? "text-red-400" : undefined} />
                <StatCard label="Total Subs" value={revenueStats.totalSubs} sub="all time" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Subscriptions by plan */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Subs by Plan</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(revenueStats.subsByPlan).map(([plan, count]) => (
                      <div key={plan} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{plan}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(((count as number) / revenueStats.totalSubs) * 100)}%` }} />
                          </div>
                          <span className="text-sm font-bold w-8 text-right">{count as number}</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(revenueStats.subsByPlan).length === 0 && <p className="text-xs text-muted-foreground">No subscriptions yet</p>}
                  </CardContent>
                </Card>

                {/* Revenue by source */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue by Source</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(revenueStats.bySource).map(([src, amt]) => (
                      <div key={src} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{src}</span>
                        <span className="text-sm font-bold">${(amt as number).toFixed(2)}</span>
                      </div>
                    ))}
                    {Object.keys(revenueStats.bySource).length === 0 && <p className="text-xs text-muted-foreground">No revenue recorded yet</p>}
                  </CardContent>
                </Card>
              </div>

              {/* Subscription status breakdown */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Subscription Status Breakdown</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {Object.entries(revenueStats.subsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/30">
                      <Badge variant="outline" className="text-xs capitalize">{status}</Badge>
                      <span className="text-sm font-bold">{count as number}</span>
                    </div>
                  ))}
                  {Object.keys(revenueStats.subsByStatus).length === 0 && <p className="text-xs text-muted-foreground">No subscription data</p>}
                </CardContent>
              </Card>
            </>
          ) : <EmptyState text="Loading analytics…" />}
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {users && users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Name</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Email</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Role</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u: any) => (
                        <tr key={u.id} className="border-b border-border/50">
                          <td className="py-2 px-3">{u.name || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{u.email || "—"}</td>
                          <td className="py-2 px-3"><Badge variant="outline" className="text-xs capitalize">{u.role}</Badge></td>
                          <td className="py-2 px-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState text="No users yet" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {revenue ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-accent/30">
                      <p className="text-xs text-muted-foreground">Total Transactions</p>
                      <p className="text-2xl font-bold text-green-400">{revenue.length}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/30">
                      <p className="text-xs text-muted-foreground">Total Amount</p>
                      <p className="text-2xl font-bold">${revenue.reduce((sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0).toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/30">
                      <p className="text-xs text-muted-foreground">Sources</p>
                      <p className="text-2xl font-bold">{new Set(revenue.map((r: any) => r.source)).size}</p>
                    </div>
                  </div>
                  {revenue.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Recent Transactions</h3>
                      {revenue.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                          <div>
                            <span className="text-sm capitalize">{t.type}</span>
                            <span className="text-xs text-muted-foreground ml-2">{t.source}</span>
                          </div>
                          <span className="text-sm font-bold">${t.amount} {t.currency}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : <EmptyState text="No revenue data" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fraud" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {fraudAlerts && fraudAlerts.length > 0 ? (
                <div className="space-y-3">
                  {fraudAlerts.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{a.alertType.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="border-red-500/30 text-red-400">{a.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-green-400 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No fraud alerts. System is clean.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {healthScores && healthScores.length > 0 ? (
                <div className="space-y-2">
                  {healthScores.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                      <span className="text-sm">User #{h.userId}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${h.score}%` }} />
                        </div>
                        <span className="text-sm font-bold w-10 text-right">{h.score}</span>
                        <Badge variant="outline" className="text-xs capitalize">{h.riskLevel}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState text="No health scores calculated yet" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {activity && activity.length > 0 ? (
                <div className="space-y-2">
                  {activity.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded bg-accent/20 text-sm">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3 text-primary" />
                        <span className="capitalize">{a.action.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState text="No activity recorded" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subs" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {subscriptions && subscriptions.length > 0 ? (
                <div className="space-y-2">
                  {subscriptions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                      <div>
                        <span className="text-sm font-medium capitalize">{s.plan}</span>
                        <Badge variant="outline" className="ml-2 text-xs capitalize">{s.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">User #{s.userId}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState text="No subscription data" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {serviceOrders && serviceOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">#</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Customer</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Service</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Amount</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceOrders.map((o: any) => (
                        <tr key={o.id} className="border-b border-border/50 align-middle">
                          <td className="py-2 px-3 font-mono text-xs text-muted-foreground">#{o.id}</td>
                          <td className="py-2 px-3">
                            <div>{o.customerName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                          </td>
                          <td className="py-2 px-3">{SERVICE_NAMES[o.serviceType] || o.serviceType}</td>
                          <td className="py-2 px-3 text-right font-medium">${(o.amount / 100).toFixed(2)}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <Badge variant={STATUS_BADGE_VARIANT[o.status] || "outline"} className="text-xs capitalize">
                                {o.status.replace(/_/g, " ")}
                              </Badge>
                              <Select
                                value={o.status}
                                onValueChange={(next) => {
                                  if (next !== o.status) {
                                    updateOrderStatus.mutate({ id: o.id, status: next as OrderStatus });
                                  }
                                }}
                                disabled={updateOrderStatus.isPending}
                              >
                                <SelectTrigger className="h-7 w-[140px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ORDER_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs capitalize">
                                      {s.replace(/_/g, " ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-xs">
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No service orders yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10"><Icon className={`h-5 w-5 ${color || "text-primary"}`} /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-8"><p className="text-sm text-muted-foreground">{text}</p></div>;
}

function StatCard({ label, value, sub, color }: { label: string; value: any; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color || ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
