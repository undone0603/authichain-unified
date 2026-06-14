import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, DollarSign, Inbox, Cog, AlertCircle, CheckCircle2, RefreshCw, Users,
} from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  success: "text-green-400",
  failure: "text-red-400",
  error:   "text-red-400",
};

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtAgo(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function FounderPanel() {
  const utils = trpc.useUtils();
  const { data, isLoading, dataUpdatedAt } = trpc.founder.snapshot.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const totalAttentionItems =
    data.approvals.draftsPending +
    data.approvals.payoutsPendingApproval +
    data.health.failuresLast24h;

  return (
    <div className="space-y-4">
      {/* Top-line summary */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {totalAttentionItems === 0
                ? "🟢 Nothing needs your attention right now."
                : `🟡 ${totalAttentionItems} item${totalAttentionItems === 1 ? "" : "s"} waiting on you.`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last refreshed {fmtAgo(new Date(dataUpdatedAt).toISOString())}
              {" · "}snapshot from {new Date(data.generatedAt).toLocaleString()}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => utils.founder.snapshot.invalidate()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Money in */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Revenue</CardTitle>
          <CardDescription>What real customers paid you.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-3">
            <Stat label="Today" value={fmtMoney(data.revenue.today)} sub={`${data.revenue.txnsToday} txn(s)`} />
            <Stat label="Last 7 days" value={fmtMoney(data.revenue.last7d)} />
            <Stat label="Last 30 days" value={fmtMoney(data.revenue.last30d)} />
            <Stat label="Sources (30d)" value={Object.keys(data.revenue.bySourceLast30d).length} sub="active" />
          </div>
          {Object.keys(data.revenue.bySourceLast30d).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(data.revenue.bySourceLast30d).map(([src, amt]) => (
                <Badge key={src} variant="outline" className="text-xs">{src} · {fmtMoney(amt)}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waiting on you */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Inbox className="h-4 w-4" />Waiting on you</CardTitle>
          <CardDescription>The approval gates that gate revenue + outreach.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Stat label="Drafts pending" value={data.approvals.draftsPending} sub="review at /email-campaigns" />
            <Stat
              label="Payouts pending"
              value={data.approvals.payoutsPendingApproval}
              sub={data.approvals.payoutsPendingTotalUsd > 0 ? `${fmtMoney(data.approvals.payoutsPendingTotalUsd)} total` : "none queued"}
            />
          </div>
          {Object.keys(data.approvals.draftsByKind).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.approvals.draftsByKind).map(([kind, n]) => (
                <Badge key={kind} variant="secondary" className="text-xs capitalize">{kind.replace(/_/g, " ")}: {n}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Funnel</CardTitle>
          <CardDescription>Leads by status, plus what came in the last 24h.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-3 mb-3">
            <Stat label="New (last 24h)" value={data.pipeline.leadsLast24h} />
            <Stat label="Total tracked" value={Object.values(data.pipeline.leadsByStatus).reduce((a, b) => a + b, 0)} />
            <Stat label="Active missions" value={data.autonomy.missionsActive} />
            <Stat label="Tasks" value={Object.values(data.autonomy.tasksByStatus).reduce((a, b) => a + b, 0)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.pipeline.leadsByStatus).map(([s, n]) => (
              <Badge key={s} variant="outline" className="text-xs capitalize">{s}: {n}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Autonomy heartbeat */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Cog className="h-4 w-4" />Cron heartbeat</CardTitle>
          <CardDescription>Scheduled jobs — last run + the 24h success / failure split.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.autonomy.jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No job runs in the last 7 days yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Job</th>
                    <th className="text-left py-2 px-2 font-medium">Last run</th>
                    <th className="text-left py-2 px-2 font-medium">Status</th>
                    <th className="text-right py-2 px-2 font-medium">24h ✓ / ✗</th>
                  </tr>
                </thead>
                <tbody>
                  {data.autonomy.jobs.map((j) => (
                    <tr key={j.name} className="border-b border-border/50">
                      <td className="py-2 px-2 font-mono text-xs">{j.name}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{fmtAgo(j.lastStartedAt)}</td>
                      <td className="py-2 px-2">
                        {j.lastStatus
                          ? <span className={`text-xs ${STATUS_COLOR[j.lastStatus] ?? ""}`}>
                              {j.lastStatus === "success" ? <CheckCircle2 className="inline h-3 w-3 mr-1" /> : null}
                              {j.lastStatus}
                            </span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-2 text-right text-xs">
                        <span className="text-green-400">{j.successesLast24h}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className={j.failuresLast24h > 0 ? "text-red-400" : "text-muted-foreground"}>{j.failuresLast24h}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health */}
      <Card className={data.health.failuresLast24h > 0 ? "border-red-500/30" : "border-green-500/20"}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" />Errors (24h)</CardTitle>
          <CardDescription>
            {data.health.failuresLast24h === 0
              ? "Clean."
              : `${data.health.failuresLast24h} failure event(s) in the last 24h.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.health.recentFailures.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing to show.</p>
          ) : (
            <div className="space-y-1.5">
              {data.health.recentFailures.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground tabular-nums w-20">{fmtAgo(f.at)}</span>
                  <span className="font-mono">{f.action}</span>
                  {f.reason && <span className="text-muted-foreground truncate">— {f.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg bg-accent/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

