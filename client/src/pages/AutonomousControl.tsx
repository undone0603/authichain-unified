import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Activity, Zap, DollarSign, Target, AlertTriangle,
  RefreshCw, Play, TrendingUp, CheckCircle2, Clock, XCircle,
  Cpu, Radio, Flame
} from "lucide-react";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export default function AutonomousControl() {
  const [mode, setMode] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [activityLimit] = useState(30);

  const status = trpc.autonomous.getSystemStatus.useQuery(undefined, { refetchInterval: 10000 });
  const activity = trpc.autonomous.getLiveActivity.useQuery({ limit: activityLimit }, { refetchInterval: 10000 });
  const missions = trpc.autonomous.getActiveMissions.useQuery(undefined, { refetchInterval: 15000 });
  const revenue = trpc.autonomous.getRevenueSummary.useQuery(undefined, { refetchInterval: 30000 });

  const setHandsOff = trpc.autonomous.setHandsOffMode.useMutation({
    onSuccess: (data) => {
      toast.success(data.enabled ? "Hands-Off Mode ACTIVATED — the machine runs itself." : "Hands-Off Mode deactivated.");
      status.refetch();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const triggerTick = trpc.autonomous.triggerPipelineTick.useMutation({
    onSuccess: () => { toast.success("Pipeline tick triggered."); activity.refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const dealBlitz = trpc.autonomous.runDealBlitz.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Deal Blitz launched — ${data.segmentsHit} segments, ${data.tasksQueued.length} tasks queued, ${data.hotLeadsPitched} HOT leads pitched.`,
        { duration: 6000 }
      );
      status.refetch(); activity.refetch(); missions.refetch();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  useEffect(() => {
    if (status.data?.mode) setMode(status.data.mode as typeof mode);
  }, [status.data?.mode]);

  const handsOff = status.data?.handsOffEnabled ?? false;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Cpu className="w-8 h-8 text-cyan-400" />
            {handsOff && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Autonomous Control</h1>
            <p className="text-gray-400 text-sm">Mission-Critical Business Automation</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { status.refetch(); activity.refetch(); missions.refetch(); revenue.refetch(); }}
          className="border-gray-700 text-gray-300 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Master Toggle */}
      <Card className={`border-2 transition-all duration-300 ${handsOff ? "bg-green-950/30 border-green-500/50" : "bg-gray-900 border-gray-700"}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Radio className={`w-5 h-5 ${handsOff ? "text-green-400 animate-pulse" : "text-gray-500"}`} />
                <span className="font-bold text-lg">HANDS-OFF MODE</span>
                {handsOff && <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ACTIVE</Badge>}
              </div>
              <p className="text-gray-400 text-sm max-w-md">
                When enabled, the pipeline runs autonomously — finding leads, drafting emails, building pilot packets, and closing deals without human intervention.
              </p>
            </div>
            <Switch
              checked={handsOff}
              onCheckedChange={(checked) => setHandsOff.mutate({ enabled: checked, mode })}
              disabled={setHandsOff.isPending}
              className="scale-125"
            />
          </div>

          {/* Mode Selector */}
          <div className="mt-4 flex gap-2">
            {(["conservative", "balanced", "aggressive"] as const).map((m) => (
              <Button
                key={m}
                variant={mode === m ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode(m);
                  if (handsOff) setHandsOff.mutate({ enabled: true, mode: m });
                }}
                className={mode === m
                  ? m === "aggressive" ? "bg-red-600 hover:bg-red-700" : m === "balanced" ? "bg-cyan-600 hover:bg-cyan-700" : "bg-gray-600"
                  : "border-gray-700 text-gray-400"}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-cyan-400 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Active Missions</span>
            </div>
            <div className="text-3xl font-bold">{status.data?.activeMissionCount ?? "—"}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-yellow-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Pending Tasks</span>
            </div>
            <div className="text-3xl font-bold">{status.data?.pendingTaskCount ?? "—"}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Today's Actions</span>
            </div>
            <div className="text-3xl font-bold">{status.data?.todayActivityCount ?? "—"}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Today's Revenue</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(status.data?.todayRevenue ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Summary + Manual Trigger */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 grid grid-cols-3 gap-4">
          {[
            { label: "7-Day Revenue", data: revenue.data?.week },
            { label: "Monthly Revenue", data: revenue.data?.month },
            { label: "All-Time Revenue", data: revenue.data?.allTime },
          ].map(({ label, data }) => (
            <Card key={label} className="bg-gray-900 border-gray-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1 text-green-400 mb-1">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs">{label}</span>
                </div>
                <div className="text-xl font-bold">{formatCurrency(data?.total ?? 0)}</div>
                <div className="text-xs text-gray-500">{data?.count ?? 0} transactions</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Pipeline Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full bg-red-700 hover:bg-red-600 font-bold text-base"
              onClick={() => dealBlitz.mutate()}
              disabled={dealBlitz.isPending || triggerTick.isPending}
            >
              {dealBlitz.isPending
                ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                : <Flame className="w-4 h-4 mr-2" />}
              {dealBlitz.isPending ? "Blitzing..." : "DEAL BLITZ"}
            </Button>
            <p className="text-xs text-gray-500 text-center">All 6 segments, 25 leads each, HOT leads pitched now.</p>
            <Button
              className="w-full bg-cyan-900 hover:bg-cyan-800 text-sm"
              onClick={() => triggerTick.mutate()}
              disabled={triggerTick.isPending || dealBlitz.isPending}
              variant="outline"
            >
              {triggerTick.isPending ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}
              {triggerTick.isPending ? "Running..." : "Trigger Tick"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Live Feed + Mission Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Activity Feed */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Live Activity Feed
              </CardTitle>
              <span className="text-xs text-gray-500">auto-refresh 10s</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {activity.data && activity.data.length > 0 ? (
                activity.data.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                    <ActivityIcon action={entry.action} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-200 truncate">{entry.action}</span>
                        <span className="text-xs text-gray-500 shrink-0">{timeAgo(entry.createdAt.toString())}</span>
                      </div>
                      {entry.entityType && (
                        <span className="text-xs text-gray-500">{entry.entityType}{entry.entityId ? ` #${entry.entityId}` : ""}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">No activity yet. Trigger the pipeline to start.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Mission Queue */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              Active Mission Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {missions.data && missions.data.length > 0 ? (
                missions.data.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-200 truncate">{m.title || m.type}</div>
                      <div className="text-xs text-gray-500">{m.type}</div>
                    </div>
                    <MissionStatusBadge status={m.status} />
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">No active missions. The pipeline will create them automatically.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kill Switch Warning */}
      {handsOff && (
        <Card className="bg-red-950/20 border-red-800/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">
                <span className="font-bold">Hands-Off Mode is active.</span> The system is autonomously executing leads, outreach, and deal actions.
                Toggle off above to pause all autonomous operations immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActivityIcon({ action }: { action: string }) {
  if (action.includes("fail") || action.includes("error")) return <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
  if (action.includes("done") || action.includes("success") || action.includes("complete")) return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />;
  return <Activity className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />;
}

function MissionStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "active" || s === "in_progress") return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Active</Badge>;
  if (s === "pending") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
  return <Badge variant="outline" className="text-gray-400">{status}</Badge>;
}
