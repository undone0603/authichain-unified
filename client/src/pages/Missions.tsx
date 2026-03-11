import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, ChevronDown, ChevronRight, RefreshCw, Plus, Target,
} from "lucide-react";

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

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onRetry }: { task: Task; onRetry: (id: string) => void }) {
  const retryMut = trpc.tasks.retry.useMutation({ onSuccess: onRetry.bind(null, task.id) });

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className={`text-xs shrink-0 ${taskStatusColor[task.status]}`}>
          {task.status}
        </Badge>
        <span className="text-white/80 font-mono text-xs truncate">{task.kind}</span>
        {task.retryCount != null && task.retryCount > 0 && (
          <span className="text-white/40 text-xs">×{task.retryCount}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {task.lastError && (
          <span className="text-red-400/70 text-xs truncate max-w-[180px]" title={task.lastError}>
            {task.lastError.slice(0, 40)}…
          </span>
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
  );
}

// ─── Mission card ─────────────────────────────────────────────────────────────

function MissionCard({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const tasksQuery = trpc.tasks.list.useQuery(
    { missionId: mission.id },
    { enabled: open },
  );

  const updateStatus = trpc.missions.updateStatus.useMutation({
    onSuccess: () => utils.missions.list.invalidate(),
  });

  const tasks: Task[] = (tasksQuery.data as Task[] | undefined) ?? (mission.tasks as Task[] | undefined) ?? [];

  const doneCount = tasks.filter(t => t.status === "DONE").length;
  const failedCount = tasks.filter(t => t.status === "FAILED").length;
  const waitingCount = tasks.filter(t => t.status === "WAITING_HUMAN").length;

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setOpen(o => !o)} className="text-white/60 hover:text-white shrink-0 mt-0.5">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium text-white truncate">{mission.title}</CardTitle>
              <p className="text-white/40 text-xs font-mono mt-0.5">{mission.type}</p>
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
