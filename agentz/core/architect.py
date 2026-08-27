"""
agentz.core.architect
---------------------
Unified Architect Agent — the meta-agent that sits above the existing
Supervisor (failure analysis) and the workflow Runner (execution). It
plans, delegates, reviews, and makes architecture-level decisions
across the entire AgentZ fleet.

Capabilities:
  1. Fleet assessment  — load registry + audit logs, compute per-workflow
     health, and classify each as healthy / degraded / failing / idle.
  2. Plan generation   — ask the LLM (via LimitProofLLM) to produce a
     prioritized action plan: which workflows to run, fix, skip, or
     escalate, given the current fleet state and the operator's goal.
  3. Delegated execution — dispatch the plan through the existing
     Runner, respecting prerequisites, rate limits, and modes.
  4. Post-cycle review  — compare before/after metrics, surface wins
     and regressions, and persist a cycle report to the audit log.

Design principles (matching existing AgentZ patterns):
  - Uses LimitProofLLM from agentz.core.llm (zero-budget waterfall).
  - Honors ExecutionContext + Mode (dry-run / confirm / auto).
  - Reads credentials through agentz.core.credentials (never logs secrets).
  - Audit log format matches runner.write_audit_log (JSONL RunResult).
  - No new dependencies — reuses dataclasses, pathlib, json, logging.
"""
from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from agentz.core.modes import Mode, ExecutionContext
from agentz.core.runner import (
    load_registry,
    resolve_order,
    execute,
    write_audit_log,
    Workflow,
    RunResult,
    DEFAULT_AUDIT_LOG,
)
from agentz.core.supervisor import Supervisor

logger = logging.getLogger("agentz.architect")

# ── Data structures ──────────────────────────────────────────────────────────


@dataclass
class WorkflowHealth:
    """Health snapshot for a single workflow, derived from audit logs."""

    workflow_id: str
    total_runs: int = 0
    failures: int = 0
    success_rate: float = 1.0
    avg_duration_s: float = 0.0
    total_cost_usd: float = 0.0
    last_run_iso: Optional[str] = None
    last_status: Optional[str] = None
    classification: str = "idle"  # healthy | degraded | failing | idle


@dataclass
class FleetState:
    """Aggregate health of all workflows in the registry."""

    generated_at: str = ""
    total_workflows: int = 0
    healthy: list[str] = field(default_factory=list)
    degraded: list[str] = field(default_factory=list)
    failing: list[str] = field(default_factory=list)
    idle: list[str] = field(default_factory=list)
    per_workflow: dict[str, WorkflowHealth] = field(default_factory=dict)

    def summary(self) -> str:
        lines = [
            f"Fleet State ({self.generated_at}):",
            f"  Total workflows: {self.total_workflows}",
            f"  Healthy:  {len(self.healthy)}  {self.healthy[:5]}",
            f"  Degraded: {len(self.degraded)} {self.degraded[:5]}",
            f"  Failing:  {len(self.failing)}  {self.failing[:5]}",
            f"  Idle:     {len(self.idle)}     {self.idle[:5]}",
        ]
        return "\n".join(lines)


@dataclass
class ArchitectPlan:
    """LLM-generated action plan for the cycle."""

    goal: str = ""
    actions: list[dict[str, Any]] = field(default_factory=list)
    skip: list[str] = field(default_factory=list)
    escalate: list[str] = field(default_factory=list)
    rationale: str = ""

    def to_prompt(self) -> str:
        """Render as a compact string for LLM context."""
        parts = [f"Goal: {self.goal}", f"Rationale: {self.rationale}"]
        if self.actions:
            parts.append("Actions:")
            for a in self.actions:
                parts.append(f"  - {a.get('workflow_id', '?')}: {a.get('reason', '')}")
        if self.skip:
            parts.append(f"Skip: {', '.join(self.skip)}")
        if self.escalate:
            parts.append(f"Escalate: {', '.join(self.escalate)}")
        return "\n".join(parts)


@dataclass
class CycleReport:
    """Post-cycle comparison of before/after fleet state."""

    cycle_id: str
    started_at: str
    finished_at: str
    goal: str
    plan_summary: str
    results: list[dict[str, Any]] = field(default_factory=list)
    before_healthy: int = 0
    after_healthy: int = 0
    before_failing: int = 0
    after_failing: int = 0
    net_improvement: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── The Architect Agent ──────────────────────────────────────────────────────


class ArchitectAgent:
    """
    Unified meta-agent that orchestrates the entire AgentZ fleet.

    Usage:
        architect = ArchitectAgent()
        report = architect.run_cycle(
            goal="Stabilize failing workflows and run revenue-critical jobs",
            mode=Mode.AUTO,
        )

    In DRY_RUN mode, it assesses the fleet and generates a plan without
    executing anything — safe for inspection before committing.
    """

    # Health classification thresholds
    FAILURE_RATE_DEGRADED = 0.10  # >10% failures = degraded
    FAILURE_RATE_FAILING = 0.30   # >30% failures = failing
    MIN_RUNS_FOR_CLASSIFICATION = 3  # below this, classify as "idle"

    def __init__(self, audit_log_path: Path = DEFAULT_AUDIT_LOG):
        self.audit_log_path = audit_log_path
        self.supervisor = Supervisor(log_path=audit_log_path)
        self._llm: Any = None

    @property
    def llm(self):
        """Lazy-init LimitProofLLM (avoids import cost if only assessing)."""
        if self._llm is None:
            from agentz.core.llm import LimitProofLLM
            self._llm = LimitProofLLM(temperature=0.0)
        return self._llm

    # ── Phase 1: Fleet Assessment ─────────────────────────────────────────────

    def assess_fleet(self) -> FleetState:
        """
        Load the registry and audit logs, compute per-workflow health,
        and classify each workflow.
        """
        registry = load_registry()
        supervisor_metrics = self.supervisor.analyze()

        state = FleetState(
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_workflows=len(registry),
        )

        for wf_id, wf in registry.items():
            m = supervisor_metrics.get(wf_id)
            classification = "unknown"
            if not m or m.runs == 0:
                classification = "idle"
                wh = WorkflowHealth(workflow_id=wf_id, classification=classification)
            else:
                failure_rate = m.failures / m.runs if m.runs > 0 else 0
                avg_dur = m.total_duration / m.runs if m.runs > 0 else 0

                if m.runs < self.MIN_RUNS_FOR_CLASSIFICATION:
                    classification = "idle"
                elif failure_rate >= self.FAILURE_RATE_FAILING:
                    classification = "failing"
                elif failure_rate >= self.FAILURE_RATE_DEGRADED:
                    classification = "degraded"
                else:
                    classification = "healthy"

                wh = WorkflowHealth(
                    workflow_id=wf_id,
                    total_runs=m.runs,
                    failures=m.failures,
                    success_rate=1.0 - failure_rate,
                    avg_duration_s=avg_dur,
                    total_cost_usd=m.total_cost,
                    classification=classification,
                )

            # Find last run status from audit log
            wh.last_run_iso, wh.last_status = self._last_run_info(wf_id)

            state.per_workflow[wf_id] = wh
            getattr(state, classification).append(wf_id)

        return state

    def _last_run_info(self, wf_id: str) -> tuple[Optional[str], Optional[str]]:
        """Scan audit log for the most recent entry for this workflow."""
        if not self.audit_log_path.exists():
            return None, None
        last_iso, last_status = None, None
        try:
            with self.audit_log_path.open("r", encoding="utf-8") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        if data.get("workflow_id") == wf_id:
                            last_iso = data.get("finished_at") or data.get("started_at")
                            last_status = data.get("status")
                    except (json.JSONDecodeError, KeyError):
                        continue
        except Exception as e:
            logger.warning(f"Failed to read audit log for {wf_id}: {e}")
        return last_iso, last_status

    # ── Phase 2: Plan Generation ─────────────────────────────────────────────

    def generate_plan(self, fleet_state: FleetState, goal: str) -> ArchitectPlan:
        """
        Ask the LLM to produce a prioritized action plan given the
        current fleet state and the operator's goal.
        """
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(fleet_state, goal)

        try:
            from langchain_core.messages import SystemMessage, HumanMessage
            response = self.llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ])
            return self._parse_plan(response, goal)
        except Exception as e:
            logger.error(f"LLM plan generation failed: {e}")
            # Fallback: deterministic plan based on fleet state
            return self._deterministic_plan(fleet_state, goal)

    def _build_system_prompt(self) -> str:
        return (
            "You are the Unified Architect, the top-level meta-agent for the "
            "AuthiChain AgentZ fleet. You receive a fleet health report and a "
            "goal from the operator. You produce a JSON action plan.\n\n"
            "Output ONLY valid JSON with this shape:\n"
            '{\n'
            '  "rationale": "why you chose this plan",\n'
            '  "actions": [{"workflow_id": "...", "reason": "..."}],\n'
            '  "skip": ["workflow_id", ...],\n'
            '  "escalate": ["workflow_id", ...]\n'
            '}\n\n'
            "Rules:\n"
            "- Prioritize failing workflows that block revenue.\n"
            "- Skip workflows that are idle and irrelevant to the goal.\n"
            "- Escalate workflows with missing credentials or repeated failures.\n"
            "- Never run workflows that would double-fire (check prerequisites).\n"
            "- Keep the plan concise: at most 8 actions per cycle.\n"
        )

    def _build_user_prompt(self, fleet: FleetState, goal: str) -> str:
        lines = [fleet.summary(), "", f"Operator Goal: {goal}", "", "Per-workflow detail:"]
        for wf_id, wh in fleet.per_workflow.items():
            if wh.classification == "idle":
                continue  # skip idle to save tokens
            lines.append(
                f"  {wf_id}: {wh.classification} "
                f"(runs={wh.total_runs}, fail={wh.failures}, "
                f"success={wh.success_rate:.0%}, last={wh.last_status})"
            )
        lines.append("\nProduce the JSON plan now.")
        return "\n".join(lines)

    def _parse_plan(self, response: Any, goal: str) -> ArchitectPlan:
        """Parse LLM response into an ArchitectPlan."""
        content = getattr(response, "content", str(response))

        # Extract JSON from the response (may be wrapped in markdown)
        text = content if isinstance(content, str) else str(content)
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            logger.warning("Architect LLM returned no JSON; using deterministic fallback")
            return self._deterministic_plan(FleetState(), goal)

        try:
            data = json.loads(text[start : end + 1])
            return ArchitectPlan(
                goal=goal,
                actions=data.get("actions", []),
                skip=data.get("skip", []),
                escalate=data.get("escalate", []),
                rationale=data.get("rationale", ""),
            )
        except json.JSONDecodeError as e:
            logger.warning(f"Architect LLM JSON parse failed: {e}")
            return self._deterministic_plan(FleetState(), goal)

    def _deterministic_plan(self, fleet_state: FleetState, goal: str) -> ArchitectPlan:
        """
        Fallback plan when the LLM is unavailable: prioritize by
        registry order, skip failing workflows, run everything else.
        """
        registry = load_registry()
        actions = []
        skip = []
        escalate = []

        metrics = self.supervisor.analyze()
        for wf_id, wf in registry.items():
            m = metrics.get(wf_id)
            if m and m.runs > 0 and m.failures / m.runs > self.FAILURE_RATE_FAILING:
                escalate.append(wf_id)
            elif wf.priority in ("critical", "high"):
                actions.append({"workflow_id": wf_id, "reason": f"priority={wf.priority}"})
            else:
                skip.append(wf_id)

        return ArchitectPlan(
            goal=goal,
            actions=actions[:8],
            skip=skip,
            escalate=escalate,
            rationale="Deterministic fallback: LLM unavailable, prioritizing by registry priority.",
        )

    # ── Phase 3: Delegated Execution ──────────────────────────────────────────

    def execute_plan(
        self, plan: ArchitectPlan, mode: Mode = Mode.AUTO, verbose: bool = True
    ) -> list[RunResult]:
        """
        Dispatch the plan's action list through the existing Runner,
        respecting prerequisites and rate limits.
        """
        registry = load_registry()
        action_ids = [a["workflow_id"] for a in plan.actions if a["workflow_id"] in registry]

        if not action_ids:
            if verbose:
                print("  [architect] No actionable workflows in plan.")
            return []

        # Resolve topological order (handles prerequisites)
        try:
            ordered = resolve_order(registry, action_ids)
        except (KeyError, RuntimeError) as e:
            if verbose:
                print(f"  [architect] Plan resolution failed: {e}")
            return []

        results: list[RunResult] = []
        for wf in ordered:
            if wf.id in plan.skip:
                if verbose:
                    print(f"  [architect] Skipping {wf.id} (per plan)")
                continue

            if verbose:
                print(f"\n  [architect] Executing {wf.id}...")

            if mode == Mode.DRY_RUN:
                if verbose:
                    print(f"    WOULD: run {wf.id} ({wf.title})")
                results.append(RunResult(
                    workflow_id=wf.id,
                    status="skipped",
                    started_at=datetime.now(timezone.utc).isoformat(),
                    finished_at=datetime.now(timezone.utc).isoformat(),
                    duration_s=0.0,
                    notes="architect dry-run skip",
                ))
            else:
                result = execute(wf, mode, verbose=verbose)
                results.append(result)

        return results

    # ── Phase 4: Post-Cycle Review ────────────────────────────────────────────

    def review_cycle(
        self,
        cycle_id: str,
        started_at: str,
        goal: str,
        plan: ArchitectPlan,
        results: list[RunResult],
        before_state: FleetState,
    ) -> CycleReport:
        """Compare before/after fleet state and persist the report."""
        after_state = self.assess_fleet()

        report = CycleReport(
            cycle_id=cycle_id,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc).isoformat(),
            goal=goal,
            plan_summary=plan.to_prompt(),
            results=[{
                "workflow_id": r.workflow_id,
                "status": r.status,
                "duration_s": r.duration_s,
                "error": r.error,
            } for r in results],
            before_healthy=len(before_state.healthy),
            after_healthy=len(after_state.healthy),
            before_failing=len(before_state.failing),
            after_failing=len(after_state.failing),
        )
        report.net_improvement = (
            (report.after_healthy - report.before_healthy)
            - (report.after_failing - report.before_failing)
        )

        # Persist to audit log alongside runner results
        report_path = self.audit_log_path.parent / "architect_cycles.jsonl"
        try:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            with report_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(report.to_dict()) + "\n")
        except Exception as e:
            logger.error(f"Failed to persist architect cycle report: {e}")

        # Also write runner results to the main audit log
        write_audit_log(results, self.audit_log_path)

        return report

    # ── Full Cycle ────────────────────────────────────────────────────────────

    def run_cycle(
        self,
        goal: str = "Assess fleet health, fix failing workflows, and run priority jobs.",
        mode: Mode = Mode.AUTO,
        verbose: bool = True,
    ) -> CycleReport:
        """
        Execute one architect cycle.

        The Governor is now the single execution authority. This method:
          1. Runs the Governor cycle (which absorbs fleet assessment + LLM plan)
          2. Maps the GovernorCycle results into a CycleReport for backward
             compatibility with existing callers and audit log format.
        """
        from agentz.core.governor import LaunchGovernor

        governor = LaunchGovernor(
            mode=mode,
            audit_log_path=self.audit_log_path,
        )

        if verbose:
            print(f"\n{'='*60}")
            print(f"  ARCHITECT CYCLE (delegated to Governor)")
            print(f"  Goal: {goal}")
            print(f"  Mode: {mode.value}")
            print(f"{'='*60}")

        # Run the Governor cycle — it handles observe, fleet assessment,
        # LLM plan, specialist measurement, risk firewall, and execution.
        gov_cycle = governor.run_cycle(verbose=verbose)

        # Map GovernorCycle → CycleReport for backward compatibility
        after_state = self.assess_fleet()
        before_healthy = len([a for a in gov_cycle.actions_executed if a.get("status") == "ok"])
        after_healthy = len(after_state.healthy)

        report = CycleReport(
            cycle_id=gov_cycle.cycle_id,
            started_at=gov_cycle.started_at,
            finished_at=gov_cycle.finished_at,
            goal=goal,
            plan_summary=f"Governor cycle: {len(gov_cycle.actions_planned)} planned, {len(gov_cycle.actions_executed)} executed",
            results=[{
                "workflow_id": a.get("workflow_id", ""),
                "status": a.get("status", "unknown"),
                "reason": a.get("reason", ""),
            } for a in gov_cycle.actions_executed],
            before_healthy=before_healthy,
            after_healthy=after_healthy,
            before_failing=len([a for a in gov_cycle.actions_blocked if a.get("vetoed")]),
            after_failing=len(after_state.failing),
        )
        report.net_improvement = (
            (report.after_healthy - report.before_healthy)
            - (report.after_failing - report.before_failing)
        )

        # Persist to the architect cycle log for backward compatibility
        report_path = self.audit_log_path.parent / "architect_cycles.jsonl"
        try:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            with report_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(report.to_dict()) + "\n")
        except Exception as e:
            logger.error(f"Failed to persist architect cycle report: {e}")

        if verbose:
            print(f"\n  Cycle Complete: {report.cycle_id}")
            print(f"  Healthy: {report.before_healthy} -> {report.after_healthy}")
            print(f"  Failing: {report.before_failing} -> {report.after_failing}")
            print(f"  Net improvement: {report.net_improvement:+d}")
            print(f"  Report: {report_path}")

        return report


# ── CLI entry point ───────────────────────────────────────────────────────────


def main():
    """Run an architect cycle from the command line.

    Delegates to the Governor's CLI, which has the full feature set
    including daemon mode, budget tracking, and escalation notifications.
    """
    from agentz.core.governor import main as governor_main
    governor_main()


if __name__ == "__main__":
    main()
