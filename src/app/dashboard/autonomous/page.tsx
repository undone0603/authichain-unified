"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Activity, Play, Square, RefreshCw, Clock, CheckCircle, XCircle, Loader2, Zap } from "lucide-react";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${active ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-400 animate-pulse" : "bg-zinc-500"}`} />
      {active ? "Active" : "Paused"}
    </span>
  );
}

function JobRow({ job, onRun }: { job: { name: string; description: string; schedule: string; enabled: boolean; isRunning: boolean }; onRun: (name: string) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{job.name}</p>
        <p className="text-xs text-zinc-500 truncate">{job.description}</p>
        <code className="text-xs text-zinc-600">{job.schedule}</code>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <StatusBadge active={job.enabled} />
        <button
          onClick={() => onRun(job.name)}
          className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          title="Run now"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function RunRow({ run }: { run: { jobName: string; status: string; startedAt: Date | string; duration?: number | null; itemsProcessed?: number | null } }) {
  const icon = run.status === "completed"
    ? <CheckCircle className="w-4 h-4 text-green-400" />
    : run.status === "running"
    ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
    : <XCircle className="w-4 h-4 text-red-400" />;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-0 text-sm">
      {icon}
      <span className="flex-1 text-zinc-300 truncate">{run.jobName}</span>
      <span className="text-zinc-500 text-xs">{run.duration ? `${(run.duration / 1000).toFixed(1)}s` : ""}</span>
      <span className="text-zinc-600 text-xs">{new Date(run.startedAt).toLocaleTimeString()}</span>
    </div>
  );
}

export default function AutonomousPage() {
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const statusQ = trpc.scheduler.getSystemStatus.useQuery(undefined, { refetchInterval: 10_000 });
  const jobsQ = trpc.scheduler.listJobs.useQuery();
  const historyQ = trpc.scheduler.getHistory.useQuery({ limit: 20 }, { refetchInterval: 15_000 });
  const autopilotQ = trpc.autopilot.getStatus.useQuery(undefined, { refetchInterval: 30_000 });

  const toggleMutation = trpc.scheduler.toggleSystemState.useMutation({
    onSuccess: () => { statusQ.refetch(); },
  });
  const runMutation = trpc.scheduler.runManually.useMutation({
    onSuccess: () => { historyQ.refetch(); setRunningJob(null); },
    onError: () => setRunningJob(null),
  });

  const status = statusQ.data;
  const autopilot = autopilotQ.data;

  function handleRun(jobName: string) {
    setRunningJob(jobName);
    runMutation.mutate({ jobName });
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-7 h-7 text-yellow-400" />
            <div>
              <h1 className="text-2xl font-black text-white">Autonomous Operations</h1>
              <p className="text-sm text-zinc-500">AgentZ pipeline — real-time control panel</p>
            </div>
          </div>
          {status && (
            <button
              onClick={() => toggleMutation.mutate({ active: !status.isActive })}
              disabled={toggleMutation.isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                status.isActive
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                  : "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
              }`}
            >
              {status.isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {status.isActive ? "Emergency Stop" : "Activate"}
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pipeline", value: status ? <StatusBadge active={status.isActive} /> : "—" },
            { label: "Scheduled Jobs", value: status ? `${status.activeJobs} / ${status.totalJobs}` : "—" },
            { label: "Decisions Today", value: autopilot?.decisionsToday ?? "—" },
            { label: "Success Rate", value: autopilot ? `${autopilot.successRate}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">{label}</p>
              <div className="text-lg font-bold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Registered Jobs */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-500" /> Scheduled Jobs
              </h2>
              <button onClick={() => jobsQ.refetch()} className="text-zinc-600 hover:text-zinc-400">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {jobsQ.isLoading ? (
              <p className="text-zinc-600 text-sm">Loading...</p>
            ) : (
              <div>
                {(jobsQ.data ?? []).map(job => (
                  <JobRow key={job.name} job={job} onRun={handleRun} />
                ))}
              </div>
            )}
          </div>

          {/* Job History */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-500" /> Recent Runs
              </h2>
              <button onClick={() => historyQ.refetch()} className="text-zinc-600 hover:text-zinc-400">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {historyQ.isLoading ? (
              <p className="text-zinc-600 text-sm">Loading...</p>
            ) : (historyQ.data ?? []).length === 0 ? (
              <p className="text-zinc-600 text-sm">No runs yet — jobs will appear here once the pipeline fires.</p>
            ) : (
              <div>
                {(historyQ.data ?? []).slice(0, 15).map((run, i) => (
                  <RunRow key={i} run={run} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Autopilot Decisions */}
        {autopilot?.recentDecisions && autopilot.recentDecisions.length > 0 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" /> Recent Autopilot Decisions
            </h2>
            <div className="space-y-2">
              {autopilot.recentDecisions.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-zinc-800/50 last:border-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.status === "executed" ? "bg-green-400" : d.status === "overridden" ? "bg-yellow-400" : "bg-zinc-600"}`} />
                  <span className="flex-1 text-zinc-300 truncate">{d.action || d.type}</span>
                  <span className="text-zinc-500 text-xs">{d.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Env hint */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-700/50 p-4 text-xs text-zinc-500">
          <p className="font-semibold text-zinc-400 mb-1">Required environment variables</p>
          <code className="block">AUTONOMOUS_PIPELINE_ENABLED=true</code>
          <code className="block">CRON_SECRET=&lt;random 32-char secret&gt;</code>
          <code className="block">OPENAI_API_KEY, STRIPE_SECRET_KEY, DATABASE_URL</code>
          <p className="mt-2">Cron jobs fire automatically on Vercel Pro. Pipeline tick: every 5 min. Daily maintenance: 06:00 UTC.</p>
        </div>
      </div>
    </div>
  );
}
