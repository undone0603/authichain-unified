import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Power, Loader2, AlertTriangle, ShieldCheck, Zap, ServerCog } from "lucide-react";
import { toast } from "sonner";

export default function SystemControlPanel() {
  const { data: status, isLoading, refetch } = trpc.scheduler.getSystemStatus.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const toggleMutation = trpc.scheduler.toggleSystemState.useMutation({
    onSuccess: (data: { message: string }) => {
      toast.success(data.message);
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    }
  });

  if (isLoading) {
    return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  const isActive = status?.isActive;

  return (
    <Card className={`border-2 transition-colors ${isActive ? "border-green-500/20" : "border-red-500/50 bg-red-500/5"}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ServerCog className="h-5 w-5" />
              Global System Control
            </CardTitle>
            <CardDescription>
              Manage full automation, self-healing routines, and global operation state.
            </CardDescription>
          </div>
          <Badge variant={isActive ? "default" : "destructive"} className="text-xs uppercase tracking-wider">
            {isActive ? "System Online" : "System Halted"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-accent/30 border border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              Automation Jobs
            </div>
            <p className="text-2xl font-bold">
              {status?.activeJobs} / {status?.totalJobs}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-accent/30 border border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Self-Healing
            </div>
            <p className="text-2xl font-bold">
              {isActive ? "Active" : "Disabled"}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-accent/30 border border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ActivityIcon active={isActive} />
              Status
            </div>
            <p className={`text-2xl font-bold ${isActive ? "text-green-500" : "text-red-500"}`}>
              {isActive ? "Optimal" : "Suspended"}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border/50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground max-w-lg">
              {isActive ? (
                <span>All scheduled operations, AI agents, and billing systems are running normally. Use the kill switch only in emergencies to pause all background tasks.</span>
              ) : (
                <span className="text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <strong>EMERGENCY STOP ACTIVE.</strong> Background jobs, billing syncs, and automated agents are paused.
                </span>
              )}
            </div>
            <Button 
              size="lg" 
              variant={isActive ? "destructive" : "default"}
              onClick={() => toggleMutation.mutate({ active: !isActive })}
              disabled={toggleMutation.isPending}
              className={`min-w-[200px] shadow-lg ${!isActive && "bg-green-600 hover:bg-green-700"}`}
            >
              {toggleMutation.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
              ) : isActive ? (
                <><Power className="mr-2 h-5 w-5" /> Trigger Kill Switch</>
              ) : (
                <><Power className="mr-2 h-5 w-5" /> Resume Operations</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ active }: { active?: boolean }) {
  if (active) {
    return (
      <span className="relative flex h-3 w-3 mr-1">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
      </span>
    );
  }
  return <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 mr-1"></span>;
}
