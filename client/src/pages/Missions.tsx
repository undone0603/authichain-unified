import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2, ChevronDown, ChevronRight, RefreshCw, Plus, Target,
  Mail, CheckCircle2, XCircle, Eye, Brain, TrendingUp,
  Zap, Clock, AlertCircle,
} from "lucide-react";

// ─── Time helpers ─────────────────────────────────────────────────────────────

function relativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function nextTickIn(lastRanAt: string | Date | null | undefined): string {
  if (!lastRanAt) return "soon";
  const elapsed = (Date.now() - new Date(lastRanAt).getTime()) / 1000;
  const remaining = Math.max(0, 300 - elapsed); // 5-min cron
  if (remaining < 5) return "any moment";
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Re-renders every second for live countdowns */
function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MissionStatus = "PLANNED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
type TaskStatus = "PENDING" | "RUNNING" | "WAITING_HUMAN" | "DONE" | "FAILED";
type MissionType =
  | "GOV_PILOT" | "RETAIL_PILOT" | "PRESS_LAUNCH"
  | "PARTNER_ONBOARDING" | "TECH_OS_LOCK" | "LAUNCH_AUTHICHAIN";

interface Task {
  id: string;
  kind: string;
  status: TaskStatus;
  lastError?: string | null;
  retryCount?: number;
  runAt: string;
}

interface Mission {
  id: string;
  type: string;
  title: string;
  status: MissionStatus;
  priority: number;
  createdAt: string;
  tasks?: Task[];
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const missionStatusColor: Record<MissionStatus, string> = {
  PLANNED:     "bg-slate-500/20 text-slate-300 border-slate-600",
  IN_PROGRESS: "bg-blue-500/20 text-blue-300 border-blue-600",
  BLOCKED:     "bg-orange-500/20 text-orange-300 border-orange-600",
  COMPLETED:   "bg-emerald-500/20 text-emerald-300 border-emerald-600",
};

const taskStatusColor: Record<TaskStatus, string> = {
  PENDING:       "bg-slate-500/20 text-slate-300",
  RUNNING:       "bg-blue-500/20 text-blue-300 animate-pulse",
  WAITING_HUMAN: "bg-yellow-500/20 text-yellow-300",
  DONE:          "bg-emerald-500/20 text-emerald-300",
  FAILED:        "bg-red-500/20 text-red-400",
};

const MISSION_TYPES: MissionType[] = [
  "GOV_PILOT", "RETAIL_PILOT", "PRESS_LAUNCH",
  "PARTNER_ONBOARDING", "TECH_OS_LOCK", "LAUNCH_AUTHICHAIN",
];

// ─── Draft review dialog ──────────────────────────────────────────────────────

function DraftReviewDialog({ taskId, open, onClose, onActioned }: {
  taskId: string;
  open: boolean;
  onClose: () => void;
  onActioned: () => void;
}) {
  const utils = trpc.useUtils();
  const draftQuery = trpc.emailDrafts.getByTaskId.useQuery(
    { taskId },
    { enabled: open },
  );
  const draft = draftQuery.data;

  const approveMut = trpc.emailDrafts.approve.useMutation();
  const sendMut    = trpc.emailDrafts.sendById.useMutation();
  const rejectMut  = trpc.emailDrafts.reject.useMutation();

  const handleApproveAndSend = async () => {
    if (!draft) return;
    try {
      await approveMut.mutateAsync({ id: draft.id });
      await sendMut.mutateAsync({ id: draft.id });
      toast.success("Draft approved and sent");
      utils.emailDrafts.listPending.invalidate();
      onActioned();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    }
  };

  const handleReject = async () => {
    if (!draft) return;
    try {
      await rejectMut.mutateAsync({ id: draft.id });
      toast.success("Draft rejected");
      utils.emailDrafts.listPending.invalidate();
      onActioned();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject");
    }
  };

  const isPending = approveMut.isPending || sendMut.isPending || rejectMut.isPending;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-yellow-400" />
            Review Email Draft
          </DialogTitle>
        </DialogHeader>

        {draftQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !draft ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No pending draft found for this task.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">To</p>
                <p className="font-mono text-xs">{draft.prospectEmail}</p>
              </div>
              {draft.prospectName && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Name</p>
                  <p className="text-xs">{draft.prospectName}</p>
                </div>
              )}
              {draft.prospectCompany && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Company</p>
                  <p className="text-xs">{draft.prospectCompany}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Subject</p>
              <p className="text-sm font-medium border border-white/10 rounded px-3 py-2 bg-white/5">
                {draft.subject}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Body</p>
              <Textarea
                readOnly
                value={draft.body}
                className="text-sm font-mono min-h-[180px] bg-white/5 border-white/10 resize-none"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Generated by <span className="font-mono">{draft.generatedBy}</span>
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="border-white/20">
            Cancel
          </Button>
          {draft && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isPending}
                className="border-red-500/40 text-red-400 hover:text-red-300"
              >
                {rejectMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
                Reject
              </Button>
              <Button
                onClick={handleApproveAndSend}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {(approveMut.isPending || sendMut.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Approve & Send
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskTimeLabel({ task }: { task: Task }) {
  useTick();
  if (task.status === "RUNNING") {
    const elapsed = task.runAt ? Math.floor((Date.now() - new Date(task.runAt).getTime()) / 1000) : 0;
    return <span className="text-blue-300/60 text-xs">{elapsed}s</span>;
  }
  if (task.status === "DONE" || task.status === "FAILED" || task.status === "WAITING_HUMAN") {
    return <span className="text-white/25 text-xs">{relativeTime(task.runAt)}</span>;
  }
  if (task.status === "PENDING") {
    const future = task.runAt && new Date(task.runAt) > new Date();
    if (future) return <span className="text-white/25 text-xs">in {relativeTime(task.runAt).replace(" ago", "")}</span>;
  }
  return null;
}

function TaskRow({ task, onRetry }: { task: Task; onRetry: (id: string) => void }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const retryMut = trpc.tasks.retry.useMutation({ onSuccess: onRetry.bind(null, task.id) });

  return (
    <>
      <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status badge with running pulse */}
          <div className="shrink-0 relative">
            {task.status === "RUNNING" && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
              </span>
            )}
            <Badge variant="outline" className={`text-xs ${taskStatusColor[task.status]}`}>
              {task.status === "RUNNING" ? "RUNNING" : task.status}
            </Badge>
          </div>
          <span className="text-white/80 font-mono text-xs truncate">{task.kind}</span>
          {task.retryCount != null && task.retryCount > 0 && (
            <span className="text-white/40 text-xs">×{task.retryCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TaskTimeLabel task={task} />
          {task.lastError && (
            <span className="text-red-400/70 text-xs truncate max-w-[160px]" title={task.lastError}>
              {task.lastError.slice(0, 35)}…
            </span>
          )}
          {task.status === "WAITING_HUMAN" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-yellow-300 hover:text-yellow-200"
              onClick={() => setReviewOpen(true)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Review
            </Button>
          )}
          {task.status === "FAILED" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-orange-300 hover:text-orange-200"
              onClick={() => retryMut.mutate({ id: task.id })}
              disabled={retryMut.isPending}
            >
              {retryMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          )}
        </div>
      </div>
      {task.status === "WAITING_HUMAN" && (
        <DraftReviewDialog
          taskId={task.id}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onActioned={() => onRetry(task.id)}
        />
      )}
    </>
  );
}

// ─── Mission card ─────────────────────────────────────────────────────────────

function MissionCard({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const tasksQuery = trpc.tasks.list.useQuery(
    { missionId: mission.id },
    { enabled: open, refetchInterval: open ? 5_000 : false },
  );

  const updateStatus = trpc.missions.updateStatus.useMutation({
    onSuccess: () => utils.missions.list.invalidate(),
  });

  const tasks: Task[] = (tasksQuery.data as Task[] | undefined) ?? (mission.tasks as Task[] | undefined) ?? [];

  const doneCount    = tasks.filter(t => t.status === "DONE").length;
  const failedCount  = tasks.filter(t => t.status === "FAILED").length;
  const waitingCount = tasks.filter(t => t.status === "WAITING_HUMAN").length;
  const hasRunning   = tasks.some(t => t.status === "RUNNING");

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setOpen(o => !o)} className="text-white/60 hover:text-white shrink-0 mt-0.5">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div className="min-w-0 flex items-center gap-2">
              <div>
                <CardTitle className="text-sm font-medium text-white truncate">{mission.title}</CardTitle>
                <p className="text-white/40 text-xs font-mono mt-0.5">{mission.type}</p>
              </div>
              {hasRunning && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {failedCount > 0 && (
              <Badge variant="outline" className="text-xs bg-red-500/20 text-red-400 border-red-600">
                {failedCount} failed
              </Badge>
            )}
            {waitingCount > 0 && (
              <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-600">
                {waitingCount} waiting
              </Badge>
            )}
            <Badge variant="outline" className={`text-xs ${missionStatusColor[mission.status]}`}>
              {mission.status}
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="mt-2 ml-6">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.round((doneCount / tasks.length) * 100)}%` }}
                />
              </div>
              <span className="text-white/40 text-xs shrink-0">{doneCount}/{tasks.length}</span>
            </div>
          </div>
        )}

        {/* Status transition buttons */}
        {mission.status !== "COMPLETED" && (
          <div className="flex gap-1.5 mt-2 ml-6">
            {mission.status === "PLANNED" && (
              <Button size="sm" variant="outline" className="h-6 text-xs border-white/20 text-white/60 hover:text-white"
                onClick={() => updateStatus.mutate({ id: mission.id, status: "IN_PROGRESS" })}
                disabled={updateStatus.isPending}>
                Start
              </Button>
            )}
            {mission.status === "IN_PROGRESS" && (
              <>
                <Button size="sm" variant="outline" className="h-6 text-xs border-orange-500/40 text-orange-300 hover:text-orange-200"
                  onClick={() => updateStatus.mutate({ id: mission.id, status: "BLOCKED" })}
                  disabled={updateStatus.isPending}>
                  Block
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-xs border-emerald-500/40 text-emerald-300 hover:text-emerald-200"
                  onClick={() => updateStatus.mutate({ id: mission.id, status: "COMPLETED" })}
                  disabled={updateStatus.isPending}>
                  Complete
                </Button>
              </>
            )}
            {mission.status === "BLOCKED" && (
              <Button size="sm" variant="outline" className="h-6 text-xs border-blue-500/40 text-blue-300 hover:text-blue-200"
                onClick={() => updateStatus.mutate({ id: mission.id, status: "IN_PROGRESS" })}
                disabled={updateStatus.isPending}>
                Unblock
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      {open && (
        <CardContent className="pt-0 ml-6">
          {tasksQuery.isLoading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-white/40 text-xs py-2">No tasks.</p>
          ) : (
            <div>
              {tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onRetry={() => tasksQuery.refetch()}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Pipeline status bar ──────────────────────────────────────────────────────

function PipelineStatusBar() {
  useTick(); // re-render every second for live countdown
  const { data: tick, isLoading } = trpc.pipeline.status.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const ranAt      = tick?.ranAt ? new Date(tick.ranAt) : null;
  const msSinceTick = ranAt ? Date.now() - ranAt.getTime() : Infinity;
  const isRecent   = msSinceTick < 90_000; // within 90s = "just ran"
  const mt         = tick?.missionTasks;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border text-xs transition-colors ${
      isRecent
        ? "bg-blue-500/10 border-blue-500/30"
        : "bg-white/5 border-white/10"
    }`}>
      {/* Live indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`relative flex h-2 w-2`}>
          {isRecent && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${isRecent ? "bg-blue-400" : "bg-white/20"}`} />
        </span>
        <span className={`font-medium ${isRecent ? "text-blue-300" : "text-white/40"}`}>
          {isRecent ? "Pipeline active" : "Pipeline idle"}
        </span>
      </div>

      <span className="text-white/20">|</span>

      {/* Last tick */}
      <div className="flex items-center gap-1 text-white/50">
        <Clock className="h-3 w-3" />
        Last tick: <span className="text-white/70">{isLoading ? "…" : (ranAt ? relativeTime(ranAt) : "never")}</span>
      </div>

      {/* Next tick countdown */}
      <div className="flex items-center gap-1 text-white/50">
        <Zap className="h-3 w-3" />
        Next: <span className="text-white/70">{isLoading ? "…" : nextTickIn(ranAt)}</span>
      </div>

      {/* Last tick results */}
      {mt && (mt.ran > 0 || mt.errors > 0) && (
        <>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-2">
            {mt.ran > 0 && (
              <span className="text-emerald-400">{mt.ran} ran</span>
            )}
            {mt.errors > 0 && (
              <span className="flex items-center gap-0.5 text-red-400">
                <AlertCircle className="h-3 w-3" /> {mt.errors} err
              </span>
            )}
            {mt.total > 0 && (
              <span className="text-white/30">({mt.total} total)</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Bayesian intelligence panel ──────────────────────────────────────────────

const OUTCOME_SIGNALS = [
  "email_opened", "email_replied", "meeting_booked", "deal_created",
  "unsubscribed", "bounced", "no_response",
] as const;
type OutcomeSignal = typeof OUTCOME_SIGNALS[number];

const SIGNAL_LABEL: Record<OutcomeSignal, string> = {
  email_opened:    "Email opened",
  email_replied:   "Replied",
  meeting_booked:  "Meeting booked",
  deal_created:    "Deal created",
  unsubscribed:    "Unsubscribed",
  bounced:         "Bounced",
  no_response:     "No response",
};

const SIGNAL_COLOR: Record<OutcomeSignal, string> = {
  email_opened:    "text-blue-300",
  email_replied:   "text-emerald-300",
  meeting_booked:  "text-purple-300",
  deal_created:    "text-yellow-300",
  unsubscribed:    "text-orange-300",
  bounced:         "text-red-400",
  no_response:     "text-white/40",
};

function IntelPanel() {
  const [open, setOpen] = useState(false);
  const [seg, setSeg] = useState("GOV");
  const [signal, setSignal] = useState<OutcomeSignal>("email_replied");
  const utils = trpc.useUtils();

  const statsQuery = trpc.outcomes.getSegmentStats.useQuery(undefined, { enabled: open });
  const recordMut  = trpc.outcomes.record.useMutation({
    onSuccess: () => {
      toast.success(`Recorded: ${SIGNAL_LABEL[signal]} for ${seg}`);
      utils.outcomes.getSegmentStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const stats = statsQuery.data ?? {};
  const segments = Object.entries(stats);

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-left w-full"
        >
          {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
          <Brain className="h-4 w-4 text-purple-400" />
          <CardTitle className="text-sm font-medium text-white/80">Bayesian Intelligence</CardTitle>
          <span className="ml-auto text-xs text-white/30">live segment priors</span>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 pt-0">
          {statsQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            </div>
          ) : (
            <>
              {/* Segment prior table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40">
                      <th className="text-left py-1.5 pr-4 font-medium">Segment</th>
                      <th className="text-right py-1.5 px-2 font-medium">α</th>
                      <th className="text-right py-1.5 px-2 font-medium">β</th>
                      <th className="text-right py-1.5 px-2 font-medium">Mean%</th>
                      <th className="text-right py-1.5 pl-2 font-medium">Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map(([name, p]) => {
                      const prior = p as { alpha: number; beta: number };
                      const mean = prior.alpha / (prior.alpha + prior.beta);
                      const obs  = Math.max(0, prior.alpha + prior.beta - 2);
                      return (
                        <tr key={name} className="border-b border-white/5 last:border-0">
                          <td className="py-1.5 pr-4 font-mono text-white/70">{name}</td>
                          <td className="py-1.5 px-2 text-right text-emerald-400/80">{prior.alpha.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-right text-red-400/80">{prior.beta.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-right font-medium text-white">
                            {(mean * 100).toFixed(1)}%
                          </td>
                          <td className="py-1.5 pl-2 text-right text-white/40">{obs}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Manual outcome recorder */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-white/40 mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Record outcome signal
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={seg} onValueChange={setSeg}>
                    <SelectTrigger className="w-32 h-7 bg-white/5 border-white/20 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map(([name]) => (
                        <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={signal} onValueChange={v => setSignal(v as OutcomeSignal)}>
                    <SelectTrigger className="w-44 h-7 bg-white/5 border-white/20 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOME_SIGNALS.map(s => (
                        <SelectItem key={s} value={s} className={`text-xs ${SIGNAL_COLOR[s]}`}>
                          {SIGNAL_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs border-white/20 text-white/70"
                    onClick={() => recordMut.mutate({ signal, segment: seg })}
                    disabled={recordMut.isPending}
                  >
                    {recordMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Record"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Create mission dialog ────────────────────────────────────────────────────

function CreateMissionButton({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<MissionType>("GOV_PILOT");
  const utils = trpc.useUtils();

  const create = trpc.missions.create.useMutation({
    onSuccess: () => {
      utils.missions.list.invalidate();
      onCreated();
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Select value={type} onValueChange={v => setType(v as MissionType)}>
        <SelectTrigger className="w-52 h-9 bg-white/5 border-white/20 text-sm text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MISSION_TYPES.map(t => (
            <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => create.mutate({ type })}
        disabled={create.isPending}
      >
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Launch Mission
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Missions() {
  const [statusFilter, setStatusFilter] = useState<MissionStatus | "ALL">("ALL");
  const [refreshKey, setRefreshKey] = useState(0);
  const utils = trpc.useUtils();

  const { data: missions, isLoading } = trpc.missions.list.useQuery(
    { status: statusFilter === "ALL" ? undefined : statusFilter },
    { refetchInterval: 15_000 },
  );

  const missionList = (missions as Mission[] | undefined) ?? [];

  const counts = {
    ALL:         missionList.length,
    PLANNED:     missionList.filter(m => m.status === "PLANNED").length,
    IN_PROGRESS: missionList.filter(m => m.status === "IN_PROGRESS").length,
    BLOCKED:     missionList.filter(m => m.status === "BLOCKED").length,
    COMPLETED:   missionList.filter(m => m.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Missions</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">AgentZ autonomous mission orchestration</p>
        </div>
        <CreateMissionButton onCreated={() => setRefreshKey(k => k + 1)} />
      </div>

      <PipelineStatusBar />

      <IntelPanel />

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(["ALL", "PLANNED", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {s === "ALL" ? "All" : s.replace("_", " ")}
            <span className="ml-1.5 opacity-60">{counts[s]}</span>
          </button>
        ))}
        <button
          onClick={() => utils.missions.list.invalidate()}
          className="ml-auto px-2 py-1 rounded-full text-xs text-white/40 hover:text-white/70"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : missionList.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-12 text-center text-white/40">
            No missions yet. Launch one above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {missionList.map(m => <MissionCard key={m.id} mission={m} />)}
        </div>
      )}
    </div>
  );
}
