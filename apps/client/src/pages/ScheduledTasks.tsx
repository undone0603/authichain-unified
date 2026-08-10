import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Clock, Play, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Calendar, Database, Shield, Users, BarChart3, Zap, Heart, Search,
} from "lucide-react";

const JOB_ICONS: Record<string, typeof Clock> = {
  "subscription-health-check": Heart,
  "certificate-expiry-check": Shield,
  "lead-nurturing": Users,
  "database-cleanup": Database,
  "weekly-analytics-digest": BarChart3,
  "hubspot-crm-sync": RefreshCw,
  "customer-health-score": Zap,
  "fraud-detection-sweep": AlertTriangle,
};

function cronToHuman(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  if (dow === "1" && hour !== "*") return `Every Monday at ${hour}:${min.padStart(2, "0")} UTC`;
  if (hour.startsWith("*/")) return `Every ${hour.slice(2)} hours`;
  if (hour !== "*" && dom === "*") return `Daily at ${hour}:${min.padStart(2, "0")} UTC`;
  return cron;
}

export default function ScheduledTasks() {
  const [selectedJob, setSelectedJob] = useState<string>("all");

  const { data: jobs, isLoading: jobsLoading } = trpc.scheduler.listJobs.useQuery();
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = trpc.scheduler.getHistory.useQuery({
    jobName: selectedJob === "all" ? undefined : selectedJob,
    limit: 50,
  });

  const runJob = trpc.scheduler.runManually.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchHistory();
    },
    onError: (err) => toast.error(err.message),
  });

  const completedCount = history?.filter((h: any) => h.status === "completed").length || 0;
  const failedCount = history?.filter((h: any) => h.status === "failed").length || 0;
  const runningCount = history?.filter((h: any) => h.status === "running").length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scheduled Tasks</h1>
        <p className="text-muted-foreground mt-1">Automated maintenance jobs that keep your platform running smoothly</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold">{jobs?.filter(j => j.enabled).length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed (Recent)</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed (Recent)</p>
                <p className="text-2xl font-bold">{failedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Running Now</p>
                <p className="text-2xl font-bold">{runningCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Registered Jobs</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          {jobsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading jobs...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs?.map((job) => {
                const Icon = JOB_ICONS[job.name] || Clock;
                return (
                  <Card key={job.name} className="relative overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{job.name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">{cronToHuman(job.schedule)}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={job.enabled ? "default" : "secondary"}>
                          {job.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">{job.description}</p>
                      <div className="flex items-center justify-between">
                        <code className="text-xs bg-muted px-2 py-1 rounded">{job.schedule}</code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runJob.mutate({ jobName: job.name })}
                          disabled={runJob.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Run Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Filter by job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {jobs?.map((job) => (
                  <SelectItem key={job.name} value={job.name}>
                    {job.name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>

          {historyLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading history...</div>
          ) : !history?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No job runs recorded yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Jobs will appear here after their first scheduled or manual execution</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 text-sm font-medium">Job</th>
                        <th className="text-left p-3 text-sm font-medium">Status</th>
                        <th className="text-left p-3 text-sm font-medium">Started</th>
                        <th className="text-left p-3 text-sm font-medium">Duration</th>
                        <th className="text-left p-3 text-sm font-medium">Items</th>
                        <th className="text-left p-3 text-sm font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((run: any) => (
                        <tr key={run.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            <span className="text-sm font-medium">
                              {run.jobName.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge variant={
                              run.status === "completed" ? "default" :
                              run.status === "failed" ? "destructive" : "secondary"
                            }>
                              {run.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                              {run.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                              {run.status === "running" && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                              {run.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString()}
                          </td>
                          <td className="p-3 text-sm">
                            {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : "—"}
                          </td>
                          <td className="p-3 text-sm">{run.itemsProcessed ?? "—"}</td>
                          <td className="p-3 text-sm text-muted-foreground max-w-[200px] truncate">
                            {run.error ? (
                              <span className="text-red-500">{run.error}</span>
                            ) : run.result ? (
                              JSON.stringify(run.result).slice(0, 60)
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
