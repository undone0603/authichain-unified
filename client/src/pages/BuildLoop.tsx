/**
 * BuildLoop.tsx — AgentZ Dev Team Build Loop Dashboard
 *
 * Create TECH_SPRINT missions, watch the build loop live,
 * approve merges, retry failures, review PR links.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  GitBranch, GitPullRequest, Play, CheckCircle2, XCircle, Clock,
  Loader2, RefreshCw, Terminal, Zap, Code2, ShieldCheck, Rocket,
  AlertTriangle, UserCheck,
} from "lucide-react";

// ─── Task status display ──────────────────────────────────────────────────

const KIND_ICONS: Record<string, React.ReactNode> = {
  PLAN_SPRINT:    <Terminal className="h-3.5 w-3.5" />,
  WRITE_CODE:     <Code2 className="h-3.5 w-3.5" />,
  OPEN_PR:        <GitPullRequest className="h-3.5 w-3.5" />,
  RUN_TESTS:      <Play className="h-3.5 w-3.5" />,
  CODE_REVIEW:    <ShieldCheck className="h-3.5 w-3.5" />,
  MERGE_PR:       <GitBranch className="h-3.5 w-3.5" />,
  MONITOR_DEPLOY: <Rocket className="h-3.5 w-3.5" />,
  FILE_BUG:       <AlertTriangle className="h-3.5 w-3.5" />,
  AUTO_FIX:       <Zap className="h-3.5 w-3.5" />,
};

const STATUS_BADGE: Record<string, React.ReactNode> = {
  PENDING:       <Badge variant="outline" className="text-xs gap-1 text-muted-foreground"><Clock className="h-3 w-3" />Pending</Badge>,
  RUNNING:       <Badge className="text-xs gap-1 bg-blue-500 text-white"><Loader2 className="h-3 w-3 animate-spin" />Running</Badge>,
  DONE:          <Badge className="text-xs gap-1 bg-green-500 text-white"><CheckCircle2 className="h-3 w-3" />Done</Badge>,
  FAILED:        <Badge className="text-xs gap-1 bg-red-500 text-white"><XCircle className="h-3 w-3" />Failed</Badge>,
  WAITING_HUMAN: <Badge className="text-xs gap-1 bg-amber-500 text-white"><UserCheck className="h-3 w-3" />Awaiting You</Badge>,
};

function TaskRow({ task, missionId }: { task: any; missionId: string }) {
  const utils = (trpc as any).useUtils();

  const retry = (trpc as any).devTeam.retryTask.useMutation({
    onSuccess: () => { toast.success("Task re-queued"); (utils as any).devTeam.sprintTasks.invalidate({ missionId }); },
    onError: (e: any) => toast.error(e.message),
  });
  const approve = (trpc as any).devTeam.approveMerge.useMutation({
    onSuccess: () => { toast.success("Merge approved — AgentZ will merge on next tick"); (utils as any).devTeam.sprintTasks.invalidate({ missionId }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="mt-0.5 text-muted-foreground shrink-0">
        {KIND_ICONS[task.kind] ?? <Terminal className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono font-medium">{task.kind}</span>
          {STATUS_BADGE[task.status] ?? <Badge variant="outline" className="text-xs">{task.status}</Badge>}
        </div>
        {task.payload?.feature && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.payload.feature}</p>
        )}
        {task.payload?.branch && (
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{task.payload.branch}</p>
        )}
        {task.lastError && (
          <p className="text-xs text-red-500 mt-1 font-mono line-clamp-2">{task.lastError}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {task.status === 'WAITING_HUMAN' && task.kind === 'MERGE_PR' && (
          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => approve.mutate({ taskId: task.id })} disabled={approve.isPending}>
            <UserCheck className="h-3 w-3" />Approve Merge
          </Button>
        )}
        {(task.status === 'FAILED' || task.status === 'WAITING_HUMAN') && task.kind !== 'MERGE_PR' && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => retry.mutate({ taskId: task.id })} disabled={retry.isPending}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Sprint card ──────────────────────────────────────────────────────────

function SprintCard({ sprint }: { sprint: any }) {
  const [expanded, setExpanded] = useState(false);
  const { data: tasks = [], refetch } = (trpc as any).devTeam.sprintTasks.useQuery(
    { missionId: sprint.id },
    { enabled: expanded, refetchInterval: expanded ? 15_000 : false }
  );

  const total   = Number(sprint.task_count ?? 0);
  const done    = Number(sprint.done_count ?? 0);
  const failed  = Number(sprint.failed_count ?? 0);
  const waiting = Number(sprint.waiting_count ?? 0);
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{sprint.title}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              {/* Progress bar */}
              <div className="flex-1 max-w-[120px] h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{done}/{total} tasks</span>
              {failed > 0 && <Badge className="text-xs bg-red-500/10 text-red-600 border-red-200">{failed} failed</Badge>}
              {waiting > 0 && <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">{waiting} waiting</Badge>}
            </div>
          </div>
          <Badge variant="outline" className="text-xs shrink-0 capitalize">{sprint.status?.toLowerCase()}</Badge>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-3">
          <Separator className="mb-3" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">TASK PIPELINE</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1" />Refresh
            </Button>
          </div>
          {tasks.length === 0
            ? <p className="text-xs text-muted-foreground py-4 text-center">No tasks yet — AgentZ is planning…</p>
            : tasks.map((t: any) => <TaskRow key={t.id} task={t} missionId={sprint.id} />)
          }
        </CardContent>
      )}
    </Card>
  );
}

// ─── New sprint form ──────────────────────────────────────────────────────

function NewSprintForm() {
  const [feature, setFeature] = useState("");
  const [context, setContext] = useState("");
  const utils = (trpc as any).useUtils();

  const create = (trpc as any).devTeam.createSprint.useMutation({
    onSuccess: (data: any) => {
      toast.success("Sprint created", { description: `PLAN_SPRINT task queued. AgentZ will start on the next 5-min tick.` });
      setFeature("");
      setContext("");
      (utils as any).devTeam.sprints.invalidate();
    },
    onError: (e: any) => toast.error("Sprint failed", { description: e.message }),
  });

  const examples = [
    "Add a /verify/:productId public page showing QRON trust score",
    "Add email digest of weekly authentication stats",
    "Add dark/light mode toggle to the dashboard",
    "Add pagination to the QRON registry table",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-primary" />
          New Sprint
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Feature request</label>
          <Textarea
            placeholder="Describe what to build…"
            value={feature}
            onChange={e => setFeature(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Extra context (optional)</label>
          <Input
            placeholder="e.g. Keep it admin-only, use existing stripe-service.ts"
            value={context}
            onChange={e => setContext(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Examples:</p>
          <div className="flex flex-wrap gap-1.5">
            {examples.map(ex => (
              <button
                key={ex}
                onClick={() => setFeature(ex)}
                className="text-xs px-2 py-1 rounded border bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          disabled={!feature.trim() || create.isPending}
          onClick={() => create.mutate({ feature, context: context || undefined })}
        >
          {create.isPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating sprint…</>
            : <><Zap className="h-4 w-4 mr-2" />Launch Sprint</>
          }
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Build loop diagram ───────────────────────────────────────────────────

function LoopDiagram() {
  const steps = [
    { kind: "PLAN_SPRINT",    label: "Plan",     desc: "LLM decomposes feature → tasks" },
    { kind: "WRITE_CODE",     label: "Code",     desc: "LLM writes + commits to branch" },
    { kind: "OPEN_PR",        label: "PR",       desc: "GitHub PR created" },
    { kind: "RUN_TESTS",      label: "CI",       desc: "GitHub Actions: tests run" },
    { kind: "CODE_REVIEW",    label: "Review",   desc: "LLM reviews diff, posts comments" },
    { kind: "MERGE_PR",       label: "Merge",    desc: "Squash-merge (approval gate)" },
    { kind: "MONITOR_DEPLOY", label: "Deploy",   desc: "Health check after Cloudflare deploy" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="h-4 w-4 text-primary" />
          Build Loop
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {steps.map((step, i) => (
            <div key={step.kind} className="flex items-start gap-3 mb-3 last:mb-0">
              <div className="flex flex-col items-center shrink-0">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {i + 1}
                </div>
                {i < steps.length - 1 && <div className="w-px h-3 bg-border mt-1" />}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2">
                  {KIND_ICONS[step.kind]}
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="text-xs font-mono text-muted-foreground">{step.kind}</span>
                </div>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Separator className="my-3" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>↩ <span className="font-medium text-foreground">On review failure:</span> AUTO_FIX → WRITE_CODE loop</p>
          <p>↩ <span className="font-medium text-foreground">On deploy failure:</span> FILE_BUG → hotfix branch</p>
          <p>🔒 <span className="font-medium text-foreground">MERGE_PR</span> pauses for human approval by default</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function BuildLoop() {
  const { data: sprints = [], isLoading, refetch } = (trpc as any).devTeam.sprints.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );

  const activeSprints  = sprints.filter((s: any) => s.status === 'IN_PROGRESS');
  const doneSprints    = sprints.filter((s: any) => s.status === 'COMPLETED');
  const totalTasks     = sprints.reduce((s: number, m: any) => s + Number(m.task_count ?? 0), 0);
  const totalDone      = sprints.reduce((s: number, m: any) => s + Number(m.done_count ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary" />
          Build Loop
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AgentZ dev team — autonomous plan → code → PR → test → review → merge → deploy
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{activeSprints.length}</div>
          <p className="text-xs text-muted-foreground">Active Sprints</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{totalDone}<span className="text-sm text-muted-foreground">/{totalTasks}</span></div>
          <p className="text-xs text-muted-foreground">Tasks Completed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{doneSprints.length}</div>
          <p className="text-xs text-muted-foreground">Sprints Shipped</p>
        </CardContent></Card>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: new sprint + loop diagram */}
        <div className="space-y-4">
          <NewSprintForm />
          <LoopDiagram />
        </div>

        {/* Right: sprint list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sprint History</h2>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sprints.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Terminal className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No sprints yet.</p>
                <p className="text-xs mt-1">Create a sprint to kick off the build loop.</p>
              </CardContent>
            </Card>
          ) : (
            sprints.map((sprint: any) => <SprintCard key={sprint.id} sprint={sprint} />)
          )}
        </div>
      </div>
    </div>
  );
}
