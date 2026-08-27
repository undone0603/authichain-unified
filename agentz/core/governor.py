"""
agentz.core.governor
---------------------
The Launch Governor — the executive controller that sits above the
existing Supervisor and Runner. It owns the state machine and budget,
runs the six specialists, calculates the Launch Score, and delegates
execution through the existing registry/runner — never bypassing it.

Autonomous loop:

    OBSERVE → MEASURE → IDENTIFY BOTTLENECK → GENERATE ACTIONS →
    RISK SCORE → EXECUTE SAFE ACTION → VERIFY OUTCOME →
    RECORD RESULT → UPDATE PRIORITIES → REPEAT

Primary Objective:
    Reach 3 active paying AuthiChain pilot customers.

Constraints:
    - Never weaken protocol verification.
    - Never expose secrets.
    - Never alter protocol semantics autonomously.
    - Never spend above daily budget.
    - Never send high-impact external communication without approval
      until outbound quality threshold is established.
    - Preserve complete audit trail.

Optimization:
    Minimize time and cost to first recurring revenue.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from agentz.core.modes import Mode, parse_mode
from agentz.core.runner import (
    load_registry,
    resolve_order,
    execute,
    write_audit_log,
    RunResult,
    DEFAULT_AUDIT_LOG,
)
from agentz.core.supervisor import Supervisor
from agentz.core.launch_state import LaunchStateMachine
from agentz.core.launch_score import calculate_launch_score, LaunchScore, persist_score
from agentz.core.specialists import (
    ALL_SPECIALISTS,
    ProtocolGuardian,
    SpecialistResult,
)
from agentz.core.risk_firewall import assess_workflow
from agentz.core.architect import FleetState, WorkflowHealth, ArchitectPlan

logger = logging.getLogger("agentz.governor")

GOVERNOR_LOG = Path(__file__).resolve().parents[1] / "logs" / "governor_cycles.jsonl"
SCORE_HISTORY = Path(__file__).resolve().parents[1] / "logs" / "launch_scores.jsonl"

# Daily budget for autonomous spending (across all workflows)
DEFAULT_DAILY_BUDGET_USD = 50.0


@dataclass
class GovernorCycle:
    """Record of one Governor autonomous loop iteration."""
    cycle_id: str
    started_at: str
    finished_at: str = ""
    stage_before: str = ""
    stage_after: str = ""
    launch_score_before: float = 0.0
    launch_score_after: float = 0.0
    specialist_results: dict[str, Any] = field(default_factory=dict)
    bottleneck: str = ""
    actions_planned: list[dict[str, Any]] = field(default_factory=list)
    actions_executed: list[dict[str, Any]] = field(default_factory=list)
    actions_blocked: list[dict[str, Any]] = field(default_factory=list)
    actions_escalated: list[str] = field(default_factory=list)
    veto_exercised: bool = False
    veto_reason: str = ""
    budget_used: float = 0.0
    budget_remaining: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class LaunchGovernor:
    """
    The Launch Governor.

    Usage:
        governor = LaunchGovernor(mode=Mode.DRY_RUN)
        report = governor.run_cycle()

    In DRY_RUN: observes and plans but executes nothing.
    In CONFIRM: executes safe (low-risk) actions, prompts for medium+.
    In AUTO: executes all non-blocked, non-vetoed actions.
    """

    # Launch workflow IDs that the Governor orchestrates
    LAUNCH_WORKFLOWS = [
        "launch_observe",
        "launch_score",
        "launch_bottleneck",
        "launch_protocol_gate",
        "launch_production_gate",
        "launch_beta_gate",
        "launch_find_prospects",
        "launch_score_prospects",
        "launch_prepare_outreach",
        "launch_followup",
        "launch_onboard_pilot",
        "launch_measure_pilot",
        "launch_convert_paid",
        "launch_revenue_review",
        "launch_incident_response",
        "launch_daily_report",
        "launch_weekly_strategy",
    ]

    def __init__(
        self,
        mode: Mode = Mode.DRY_RUN,
        audit_log_path: Path = DEFAULT_AUDIT_LOG,
        daily_budget: float = DEFAULT_DAILY_BUDGET_USD,
    ):
        self.mode = mode
        self.audit_log_path = audit_log_path
        self.daily_budget = daily_budget
        self.supervisor = Supervisor(log_path=audit_log_path)
        self.state_machine = LaunchStateMachine()
        self.protocol_guardian = ProtocolGuardian()

    # ── The Autonomous Loop ──────────────────────────────────────────────────

    def run_cycle(self, verbose: bool = True) -> GovernorCycle:
        """
        Execute one full autonomous loop:
          OBSERVE → MEASURE → IDENTIFY BOTTLENECK → GENERATE ACTIONS →
          RISK SCORE → EXECUTE SAFE ACTION → VERIFY OUTCOME →
          RECORD RESULT → UPDATE PRIORITIES
        """
        # Clear the conformance cache so each cycle runs fresh checks
        try:
            from agentz.core.launch_gates import clear_conformance_cache
            clear_conformance_cache()
        except ImportError:
            pass

        cycle_id = f"gov-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}"
        started_at = datetime.now(timezone.utc).isoformat()

        if verbose:
            self._print_header(cycle_id)

        cycle = GovernorCycle(
            cycle_id=cycle_id,
            started_at=started_at,
            stage_before=self.state_machine.current_stage.value,
        )

        # 1. OBSERVE — gather operational context
        if verbose:
            print("\n  [OBSERVE] Gathering operational context...")
        ctx = self._observe()

        # 1b. ADAPTIVE STRATEGY — analyze trends and adjust priorities
        ctx["_adaptive_strategy"] = self._compute_adaptive_strategy(ctx)

        # 2. MEASURE — run all six specialists
        if verbose:
            print("\n  [MEASURE] Running specialist assessments...")
        specialist_results = self._measure(ctx)
        cycle.specialist_results = {
            name: asdict(r) for name, r in specialist_results.items()
        }

        # Check for ProtocolGuardian veto
        guardian = specialist_results.get("ProtocolGuardian")
        if guardian and guardian.veto:
            cycle.veto_exercised = True
            cycle.veto_reason = guardian.veto_reason
            if verbose:
                print(f"\n  [VETO] ProtocolGuardian: {guardian.veto_reason}")

        # 3. SCORE — calculate Launch Score
        if verbose:
            print("\n  [SCORE] Calculating Launch Score...")
        score_before = calculate_launch_score(ctx, cycle.stage_before)
        cycle.launch_score_before = score_before.total
        cycle.bottleneck = score_before.bottleneck
        if verbose:
            print(f"  {score_before.summary()}")

        # 4. IDENTIFY BOTTLENECK — already done by score calculation
        # 5a. FLEET ASSESSMENT + LLM PLAN (absorbed from Architect)
        if verbose:
            print("\n  [ASSESS] Fleet assessment + LLM plan generation...")
        fleet_state = self.assess_fleet()
        if verbose:
            print(f"  {fleet_state.summary()}")
        llm_plan = self.generate_llm_plan(
            fleet_state,
            goal=f"Advance from {cycle.stage_before} stage. Bottleneck: {score_before.bottleneck}",
        )
        ctx["_llm_plan"] = llm_plan
        if verbose and llm_plan.actions:
            print(f"  LLM plan: {len(llm_plan.actions)} actions, {len(llm_plan.skip)} skip, {len(llm_plan.escalate)} escalate")
            if llm_plan.rationale:
                print(f"  Rationale: {llm_plan.rationale[:100]}")

        # 5b. GENERATE ACTIONS — merge LLM plan with specialist recommendations
        if verbose:
            print("\n  [GENERATE] Collecting recommended actions...")
        actions = self._generate_actions(specialist_results, ctx)
        cycle.actions_planned = actions

        # 6. RISK SCORE + EXECUTE SAFE ACTIONS
        if verbose:
            print(f"\n  [EXECUTE] Risk-scoring and executing ({self.mode.value})...")
        executed, blocked, escalated = self._execute_with_firewall(actions, ctx, verbose)
        cycle.actions_executed = executed
        cycle.actions_blocked = blocked
        cycle.actions_escalated = escalated
        cycle.budget_used = sum(a.get("cost_usd", 0.0) for a in executed)
        # Budget tracking: accumulate from the audit log, not just this cycle.
        # The risk firewall's _cumulative_spend_today already prevents
        # per-workflow overspend, but the Governor's own accounting must
        # reflect the total spent today across all cycles.
        budget_used_today = self._budget_spent_today()
        cycle.budget_remaining = self.daily_budget - budget_used_today

        # 7. VERIFY OUTCOME — re-assess stage and score
        if verbose:
            print("\n  [VERIFY] Re-assessing stage and score...")
        advanced = self.state_machine.advance(ctx)
        cycle.stage_after = self.state_machine.current_stage.value

        score_after = calculate_launch_score(ctx, cycle.stage_after)
        cycle.launch_score_after = score_after.total

        # 8. RECORD RESULT
        cycle.finished_at = datetime.now(timezone.utc).isoformat()

        # Persist cycle record
        self._persist_cycle(cycle)
        persist_score(score_after, SCORE_HISTORY)
        write_audit_log(
            [RunResult(
                workflow_id="launch_governor",
                status="ok" if self.mode != Mode.DRY_RUN else "skipped",
                started_at=started_at,
                finished_at=cycle.finished_at,
                duration_s=0.0,
                notes=f"score {score_before.total:.0f}→{score_after.total:.0f}, "
                      f"stage {cycle.stage_before}→{cycle.stage_after}",
            )],
            self.audit_log_path,
        )

        if verbose:
            self._print_footer(cycle, score_after, advanced)

        return cycle

    # ── Phase implementations ─────────────────────────────────────────────────

    def _observe(self) -> dict[str, Any]:
        """Gather operational context from the system.

        Pulls real data from:
          - Audit log metrics (via Supervisor)
          - Registry state
          - Credential preflight
          - Launch Score history (trend analysis)
          - Protocol conformance (via launch_gates)
          - Deployment health (HTTP check)

        All checks are wrapped with fallbacks so a missing service
        doesn't crash the Governor — it just reports the gap.
        """
        ctx: dict[str, Any] = {}

        # ── Audit log metrics ─────────────────────────────────────────────
        metrics = self.supervisor.analyze()
        ctx["total_workflows"] = len(metrics)
        ctx["failing_workflows"] = sum(1 for m in metrics.values() if m.runs > 0 and m.failures / m.runs > 0.3)
        ctx["healthy_workflows"] = sum(1 for m in metrics.values() if m.runs > 0 and m.failures / m.runs < 0.1)

        # Registry state
        registry = load_registry()
        ctx["registered_workflows"] = len(registry)
        ctx["auto_executable_workflows"] = sum(
            1 for wf in registry.values()
            if not wf.confirm_before_run
        )

        # ── Current stage ──────────────────────────────────────────────────
        ctx["stage"] = self.state_machine.current_stage.value

        # ── Credential preflight ───────────────────────────────────────────
        from agentz.core.credentials import check_all, CRED_KEY_TO_ENV
        all_keys = list(CRED_KEY_TO_ENV.keys())
        _, missing_creds = check_all(all_keys)
        ctx["secrets_present"] = len(missing_creds) == 0
        ctx["missing_credentials"] = missing_creds

        # ── Protocol conformance (real check) ──────────────────────────────
        # Only run if we're at or past PROTOCOL_READY — in early BOOT
        # the protocol may not be ready yet.
        try:
            from agentz.core.launch_gates import (
                gate_protocol_schema_conformance,
                gate_deployment_healthy,
                gate_observability_active,
            )
            schema_ok, schema_ev = gate_protocol_schema_conformance(ctx)
            ctx["protocol_schema_pass"] = schema_ok
            ctx["protocol_schema_evidence"] = schema_ev

            deploy_ok, deploy_ev = gate_deployment_healthy(ctx)
            ctx["deployment_healthy"] = deploy_ok
            ctx["deployment_evidence"] = deploy_ev

            obs_ok, obs_ev = gate_observability_active(ctx)
            ctx["observability_active"] = obs_ok
            ctx["observability_evidence"] = obs_ev
        except Exception as e:
            logger.warning(f"Gate pre-check failed: {e}")
            # Don't set defaults — let the gate functions report the real
            # failure when assess_stage runs.

        # ── Trend analysis from score history ──────────────────────────────
        ctx["score_trend"] = self._load_score_trend()

        # ── Business metrics ───────────────────────────────────────────────
        # These require Supabase. Fetch if available; default to 0 if not.
        ctx.update(self._fetch_business_metrics())

        return ctx

    def _load_score_trend(self) -> dict[str, Any]:
        """Load recent scores from history for trend analysis."""
        trend: dict[str, Any] = {}
        try:
            from agentz.core.launch_score import SCORE_HISTORY_FILE
            if SCORE_HISTORY_FILE.exists():
                lines = SCORE_HISTORY_FILE.read_text(encoding="utf-8").strip().splitlines()
                # Last 10 scores
                recent = []
                for line in lines[-10:]:
                    try:
                        recent.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
                if recent:
                    trend["last_score"] = recent[-1].get("total", 0)
                    trend["previous_score"] = recent[-2].get("total", 0) if len(recent) > 1 else 0
                    trend["delta"] = trend["last_score"] - trend["previous_score"]
                    # Store recent score totals for regression detection
                    trend["recent_scores"] = [s.get("total", 0) for s in recent]
                    # Count how many cycles the same bottleneck has persisted
                    bottlenecks = [s.get("bottleneck", "") for s in recent]
                    if bottlenecks:
                        current_bn = bottlenecks[-1]
                        persistence = 0
                        for bn in reversed(bottlenecks):
                            if bn == current_bn:
                                persistence += 1
                            else:
                                break
                        trend["bottleneck_persistence"] = persistence
                        trend["bottleneck"] = current_bn
        except Exception as e:
            logger.warning(f"Failed to load score trend: {e}")
        return trend

    def _compute_adaptive_strategy(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """
        Analyze score trends and adjust the Governor's behavior.

        Uses historical score data to:
          - Detect persistent bottlenecks (same bottleneck 3+ cycles)
          - Adjust budget allocation toward the bottleneck dimension
          - Detect score regression (score dropping over 3 cycles)
          - Prioritize actions that address the persistent bottleneck

        Returns a strategy dict that _generate_actions and the firewall use.
        """
        trend = ctx.get("score_trend", {})
        strategy: dict[str, Any] = {
            "bottleneck_persistent": False,
            "score_regression": False,
            "budget_reallocation": {},  # dimension → suggested weight
            "priority_override": None,  # workflow_id to prioritize
        }

        persistence = trend.get("bottleneck_persistence", 0)
        bottleneck = trend.get("bottleneck", "")
        delta = trend.get("delta", 0)

        # ── Persistent bottleneck detection ────────────────────────────────
        # If the same bottleneck has persisted for 3+ cycles, the Governor
        # should focus resources on that dimension.
        if persistence >= 3:
            strategy["bottleneck_persistent"] = True
            strategy["priority_override"] = bottleneck
            logger.info(
                f"Persistent bottleneck detected: {bottleneck} "
                f"({persistence} cycles). Prioritizing {bottleneck} actions."
            )

        # ── Score regression detection ─────────────────────────────────────
        # If the score has been dropping for 3+ cycles, the Governor should
        # become more conservative (escalate more, execute fewer risky actions)
        if delta < 0:
            trend_scores = trend.get("recent_scores", [])
            if len(trend_scores) >= 3:
                # Check if last 3 are monotonically decreasing
                last3 = trend_scores[-3:]
                if all(last3[i] > last3[i + 1] for i in range(len(last3) - 1)):
                    strategy["score_regression"] = True
                    logger.warning(
                        f"Score regression detected: {last3}. "
                        f"Switching to conservative mode."
                    )

        # ── Budget reallocation ────────────────────────────────────────────
        # When a bottleneck persists, suggest shifting budget toward it.
        # This is advisory — the risk firewall still enforces hard limits.
        if strategy["bottleneck_persistent"]:
            # Map bottleneck dimension to budget category
            bottleneck_budget_map = {
                "protocol": "protocol_verification",
                "launch_readiness": "deployment",
                "customer_pipeline": "acquisition",
                "revenue": "revenue_ops",
                "trust": "incident_response",
                "growth": "growth_ops",
            }
            budget_category = bottleneck_budget_map.get(bottleneck)
            if budget_category:
                strategy["budget_reallocation"] = {
                    budget_category: 0.4,  # suggest 40% of remaining budget
                    "other": 0.6,          # 60% for everything else
                }

        return strategy

    def _fetch_business_metrics(self) -> dict[str, Any]:
        """Fetch active pilots, paying customers, prospects from Supabase."""
        metrics: dict[str, Any] = {
            "active_pilots": 0,
            "paying_customers": 0,
            "qualified_prospects": 0,
            "demos_completed": 0,
            "active_incidents": 0,
        }
        if self.mode == Mode.DRY_RUN:
            # In dry-run, don't hit the database — report what we can't verify
            return metrics
        try:
            from agentz.core.credentials import get
            from supabase import create_client
            url = get("supabase_url", required=False)
            key = get("supabase_service_key", required=False)
            if not url or not key:
                return metrics
            sb = create_client(url, key)

            # Active pilots: count of organizations with status='pilot_active'
            try:
                r = sb.table("organizations").select("id", count="exact").eq("status", "pilot_active").execute()
                metrics["active_pilots"] = r.count or 0
            except Exception as e:
                logger.debug(f"Could not fetch pilot count: {e}")

            # Paying customers: count of organizations with status='paid'
            try:
                r = sb.table("organizations").select("id", count="exact").eq("status", "paid").execute()
                metrics["paying_customers"] = r.count or 0
            except Exception as e:
                logger.debug(f"Could not fetch paying customer count: {e}")

            # Qualified prospects: count of prospects with status='qualified'
            try:
                r = sb.table("prospects").select("id", count="exact").eq("status", "qualified").execute()
                metrics["qualified_prospects"] = r.count or 0
            except Exception as e:
                logger.debug(f"Could not fetch prospect count: {e}")

            # Active incidents: count of incidents with status='open'
            try:
                r = sb.table("incidents").select("id", count="exact").eq("status", "open").execute()
                metrics["active_incidents"] = r.count or 0
            except Exception as e:
                logger.debug(f"Could not fetch incident count: {e}")

        except Exception as e:
            logger.warning(f"Could not fetch business metrics from Supabase: {e}")
        return metrics

    def _budget_spent_today(self) -> float:
        """Sum all cost_usd across all workflows from the audit log today.

        This accumulates across cycles, unlike per-cycle budget_used.
        """
        if not self.audit_log_path.exists():
            return 0.0
        total = 0.0
        today = datetime.now(timezone.utc).date()
        try:
            with self.audit_log_path.open("r", encoding="utf-8") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        if data.get("status") not in ("ok", "skipped"):
                            continue
                        started = data.get("started_at", "")
                        if started:
                            dt = datetime.fromisoformat(started)
                            if dt.date() == today:
                                total += data.get("cost_usd", 0.0)
                    except (json.JSONDecodeError, KeyError, ValueError):
                        continue
        except Exception as e:
            logger.warning(f"Failed to read audit log for budget: {e}")
        return total

    # ── Fleet Assessment (absorbed from Architect) ─────────────────────────────

    def assess_fleet(self) -> FleetState:
        """
        Assess the health of every workflow in the registry.

        This method absorbs the Architect's fleet assessment logic so the
        Governor can produce fleet health reports without depending on the
        Architect module. Classification thresholds match the original.
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

                if m.runs < 3:
                    classification = "idle"
                elif failure_rate >= 0.30:
                    classification = "failing"
                elif failure_rate >= 0.10:
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
            state.per_workflow[wf_id] = wh
            getattr(state, classification).append(wf_id)

        return state

    def generate_llm_plan(self, fleet_state: FleetState, goal: str) -> ArchitectPlan:
        """
        Ask the LLM to produce a prioritized action plan given the fleet
        state and goal. Falls back to specialist recommendations if the
        LLM is unavailable.

        Absorbed from the Architect's generate_plan method so the Governor
        can use LLM intelligence for action planning.
        """
        system_prompt = (
            "You are the Launch Governor, the top-level meta-agent for the "
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

        lines = [fleet_state.summary(), "", f"Operator Goal: {goal}", "", "Per-workflow detail:"]
        for wf_id, wh in fleet_state.per_workflow.items():
            if wh.classification == "idle":
                continue
            lines.append(
                f"  {wf_id}: {wh.classification} "
                f"(runs={wh.total_runs}, fail={wh.failures}, "
                f"success={wh.success_rate:.0%}, last={wh.last_status})"
            )
        lines.append("\nProduce the JSON plan now.")
        user_prompt = "\n".join(lines)

        try:
            from agentz.core.llm import get_llm
            from langchain_core.messages import SystemMessage, HumanMessage
            llm = get_llm()
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ])
            return self._parse_llm_plan(response, goal)
        except Exception as e:
            logger.warning(f"LLM plan generation failed: {e}")
            return ArchitectPlan(
                goal=goal,
                actions=[],
                skip=[],
                escalate=[],
                rationale=f"LLM unavailable: {e}. Using specialist recommendations.",
            )

    def _parse_llm_plan(self, response: Any, goal: str) -> ArchitectPlan:
        """Parse LLM response into an ArchitectPlan."""
        content = getattr(response, "content", str(response))
        text = content if isinstance(content, str) else str(content)
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            logger.warning("Governor LLM returned no JSON; using specialist recommendations")
            return ArchitectPlan(goal=goal, rationale="LLM returned no JSON")

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
            logger.warning(f"Governor LLM JSON parse failed: {e}")
            return ArchitectPlan(goal=goal, rationale=f"JSON parse failed: {e}")

    def _measure(self, ctx: dict[str, Any]) -> dict[str, SpecialistResult]:
        """Run all six specialist assessments."""
        results: dict[str, SpecialistResult] = {}
        for name, cls in ALL_SPECIALISTS.items():
            specialist = cls()
            result = specialist.assess(ctx)
            results[name] = result
        return results

    def _generate_actions(
        self,
        specialist_results: dict[str, SpecialistResult],
        ctx: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Collect recommended actions, merging LLM plan with specialist recs.

        If an LLM plan is available in ctx (generated by generate_llm_plan),
        it takes priority. Specialist recommendations fill gaps for
        workflows the LLM plan didn't address.

        Adaptive strategy: if a persistent bottleneck is detected, actions
        targeting that bottleneck dimension are prioritized to the front.
        """
        seen: set[str] = set()
        actions: list[dict[str, Any]] = []

        # ── LLM plan first (if available) ───────────────────────────────────
        llm_plan: ArchitectPlan | None = ctx.get("_llm_plan")
        if llm_plan and llm_plan.actions:
            for action in llm_plan.actions:
                wf_id = action.get("workflow_id", "")
                if wf_id and wf_id not in seen:
                    actions.append(action)
                    seen.add(wf_id)

        # ── Specialist recommendations fill gaps ────────────────────────────
        for name, result in specialist_results.items():
            for action in result.recommended_actions:
                wf_id = action.get("workflow_id", "")
                if wf_id and wf_id not in seen:
                    actions.append(action)
                    seen.add(wf_id)

        # Store skip/escalate lists in ctx for the firewall to use
        if llm_plan:
            if llm_plan.skip:
                ctx["_llm_skip"] = set(llm_plan.skip)
            if llm_plan.escalate:
                ctx["_llm_escalate"] = set(llm_plan.escalate)

        # ── Adaptive prioritization ────────────────────────────────────────
        # If a persistent bottleneck is detected, move actions targeting it
        # to the front of the list so they execute first.
        strategy = ctx.get("_adaptive_strategy", {})
        if strategy.get("bottleneck_persistent"):
            bottleneck = strategy.get("priority_override", "")
            if bottleneck:
                # Map bottleneck dimension to specialist name → workflow IDs
                bottleneck_to_specialist = {
                    "protocol": "ProtocolGuardian",
                    "launch_readiness": "LaunchBuilder",
                    "customer_pipeline": "PilotCloser",
                    "revenue": "RevenueOperator",
                    "trust": "TrustHealer",
                    "growth": "GrowthScout",
                }
                specialist_name = bottleneck_to_specialist.get(bottleneck, "")
                if specialist_name and specialist_name in specialist_results:
                    # Move specialist's actions to the front
                    priority_wf_ids = {
                        a["workflow_id"] for a in specialist_results[specialist_name].recommended_actions
                        if "workflow_id" in a
                    }
                    actions.sort(
                        key=lambda a: 0 if a.get("workflow_id") in priority_wf_ids else 1
                    )

        return actions

    def _execute_with_firewall(
        self,
        actions: list[dict[str, Any]],
        ctx: dict[str, Any],
        verbose: bool,
    ) -> tuple[list[dict], list[dict], list[str]]:
        """
        Execute actions through the existing runner, filtered by the
        risk firewall. Returns (executed, blocked, escalated).

        Honors LLM plan skip/escalate lists if present in ctx.
        """
        registry = load_registry()
        executed: list[dict[str, Any]] = []
        blocked: list[dict[str, Any]] = []
        escalated: list[str] = []

        veto_active = bool(ctx.get("protocol_violations"))
        llm_skip: set[str] = ctx.get("_llm_skip", set())
        llm_escalate: set[str] = ctx.get("_llm_escalate", set())

        for action in actions:
            wf_id = action.get("workflow_id", "")
            wf = registry.get(wf_id)
            if not wf:
                if verbose:
                    print(f"    [skip] {wf_id} — not in registry")
                continue

            # Honor LLM plan skip list
            if wf_id in llm_skip:
                if verbose:
                    print(f"    [skip] {wf_id} — LLM plan skip")
                continue

            # Honor LLM plan escalate list
            if wf_id in llm_escalate:
                if verbose:
                    print(f"    [escalate] {wf_id} — LLM plan escalate")
                escalated.append(wf_id)
                continue

            # Look up risk fields from the registry entry
            risk_class = getattr(wf, "risk_class", "low")
            financial_limit = getattr(wf, "financial_limit_usd", 0.0)
            requires_approval = getattr(wf, "requires_human_approval", False)

            assessment = assess_workflow(
                wf_id=wf_id,
                risk_class=risk_class,
                financial_limit_usd=financial_limit,
                requires_human_approval=requires_approval,
                current_mode=self.mode.value,
                audit_log_path=self.audit_log_path,
                protocol_veto_active=veto_active,
            )

            if not assessment.approved:
                if verbose:
                    print(f"    [blocked] {wf_id}: {assessment.reason}")
                blocked.append({"workflow_id": wf_id, "reason": assessment.reason})
                continue

            if assessment.vetoed:
                if verbose:
                    print(f"    [vetoed] {wf_id}: {assessment.veto_reason}")
                blocked.append({"workflow_id": wf_id, "reason": assessment.veto_reason, "vetoed": True})
                continue

            # Determine effective mode
            effective_mode = self.mode
            if assessment.escalated_mode == "confirm":
                effective_mode = Mode.CONFIRM
                escalated.append(wf_id)

            if verbose:
                print(f"    [execute] {wf_id} (mode={effective_mode.value}, risk={risk_class})")

            if self.mode == Mode.DRY_RUN:
                # Dry-run: just record what would happen
                executed.append({
                    "workflow_id": wf_id,
                    "status": "would_execute",
                    "mode": effective_mode.value,
                    "risk_class": risk_class,
                    "reason": action.get("reason", ""),
                })
            else:
                result = execute(wf, effective_mode, verbose=verbose, audit_log_path=self.audit_log_path)
                executed.append({
                    "workflow_id": wf_id,
                    "status": result.status,
                    "mode": effective_mode.value,
                    "risk_class": risk_class,
                    "cost_usd": result.cost_usd,
                    "error": result.error,
                })

        return executed, blocked, escalated

    # ── Persistence ──────────────────────────────────────────────────────────

    def _persist_cycle(self, cycle: GovernorCycle) -> None:
        GOVERNOR_LOG.parent.mkdir(parents=True, exist_ok=True)
        with GOVERNOR_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(cycle.to_dict()) + "\n")

    # ── Console output ────────────────────────────────────────────────────────

    def _print_header(self, cycle_id: str) -> None:
        print(f"\n{'='*60}")
        print(f"  LAUNCH GOVERNOR: {cycle_id}")
        print(f"  Mode: {self.mode.value}")
        print(f"  Budget: ${self.daily_budget:.2f}/day")
        print(f"  Stage: {self.state_machine.current_stage.value}")
        print(f"{'='*60}")

    def _print_footer(self, cycle: GovernorCycle, score: LaunchScore, advanced: bool) -> None:
        print(f"\n{'='*60}")
        print(f"  CYCLE COMPLETE: {cycle.cycle_id}")
        print(f"  Score: {cycle.launch_score_before:.0f} → {cycle.launch_score_after:.0f}")
        print(f"  Stage: {cycle.stage_before} → {cycle.stage_after}"
              + (" (ADVANCED)" if advanced else ""))
        print(f"  Actions: {len(cycle.actions_executed)} executed, "
              f"{len(cycle.actions_blocked)} blocked, "
              f"{len(cycle.actions_escalated)} escalated")
        if cycle.veto_exercised:
            print(f"  VETO: {cycle.veto_reason}")
        print(f"  Budget: ${cycle.budget_used:.2f} used, ${cycle.budget_remaining:.2f} remaining")
        print(f"  Bottleneck: {cycle.bottleneck}")
        print(f"  Report: {GOVERNOR_LOG}")
        print(f"{'='*60}")


# ── CLI ──────────────────────────────────────────────────────────────────────

# Lock file to prevent concurrent governors
GOVERNOR_LOCK = Path(__file__).resolve().parents[1] / "logs" / "governor.lock"

# Escalation log — separate from the cycle log for human review
ESCALATION_LOG = Path(__file__).resolve().parents[1] / "logs" / "escalations.jsonl"


def _notify_escalation(cycle_id: str, escalated: list[str], veto_reason: str) -> None:
    """Send an escalation notification via the Notifier if configured."""
    try:
        from agentz.core.notifications import Notifier

        # Build a human-readable escalation message
        parts = [f"🚨 Launch Governor escalation — {cycle_id}"]
        if veto_reason:
            parts.append(f"VETO: {veto_reason}")
        if escalated:
            parts.append(f"Escalated workflows ({len(escalated)}): {', '.join(escalated[:5])}")
        message = "\n".join(parts)

        # Write to escalation log
        ESCALATION_LOG.parent.mkdir(parents=True, exist_ok=True)
        with ESCALATION_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps({
                "cycle_id": cycle_id,
                "escalated": escalated,
                "veto_reason": veto_reason,
                "at": datetime.now(timezone.utc).isoformat(),
            }) + "\n")

        # Send via webhook if configured
        webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
        if webhook_url:
            Notifier({"webhook": webhook_url}).notify(message, title=f"Governor Escalation: {cycle_id}")
        else:
            logger.info(f"Escalation logged (no webhook configured): {message}")
    except Exception as e:
        logger.warning(f"Failed to send escalation notification: {e}")


def main():
    import argparse
    import signal
    import sys
    import time as _time

    parser = argparse.ArgumentParser(description="AuthiChain Launch Governor")
    parser.add_argument(
        "--mode",
        choices=["auto", "confirm", "dry-run"],
        default="dry-run",
        help="Execution mode (default: dry-run for safety)",
    )
    parser.add_argument(
        "--budget",
        type=float,
        default=DEFAULT_DAILY_BUDGET_USD,
        help=f"Daily budget in USD (default: {DEFAULT_DAILY_BUDGET_USD})",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run continuously, executing a cycle every --interval seconds",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=900,
        help="Seconds between cycles in daemon mode (default: 900 = 15 min)",
    )
    parser.add_argument(
        "--max-cycles",
        type=int,
        default=0,
        help="Stop after N cycles (0 = unlimited, for daemon mode)",
    )
    args = parser.parse_args()

    mode = parse_mode(args.mode)
    governor = LaunchGovernor(mode=mode, daily_budget=args.budget)

    if not args.daemon:
        # Single cycle (original behavior)
        cycle = governor.run_cycle()
        if cycle.veto_exercised or cycle.actions_escalated:
            _notify_escalation(cycle.cycle_id, cycle.actions_escalated, cycle.veto_reason)
        print(json.dumps(cycle.to_dict(), indent=2))
        return

    # ── Daemon mode ─────────────────────────────────────────────────────
    # Prevent two governors from running simultaneously
    if GOVERNOR_LOCK.exists():
        try:
            pid = int(GOVERNOR_LOCK.read_text().strip())
            # Check if that PID is still alive
            try:
                os.kill(pid, 0)
                print(f"Governor already running (PID {pid}). Exiting.", file=sys.stderr)
                sys.exit(1)
            except (ProcessLookupError, PermissionError):
                # Stale lock — take ownership
                pass
        except (ValueError, OSError):
            pass

    GOVERNOR_LOCK.parent.mkdir(parents=True, exist_ok=True)
    GOVERNOR_LOCK.write_text(str(os.getpid()))

    running = True

    def _shutdown(signum, frame):
        nonlocal running
        print(f"\n[daemon] received signal {signum}, shutting down after current cycle...")
        running = False

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    print(f"[daemon] Launch Governor running — mode={mode.value}, budget=${args.budget:.2f}/day, "
          f"interval={args.interval}s, max_cycles={args.max_cycles or '∞'}")
    print(f"[daemon] PID {os.getpid()}, lock at {GOVERNOR_LOCK}")

    cycle_count = 0
    try:
        while running:
            cycle_count += 1
            if args.max_cycles and cycle_count > args.max_cycles:
                print(f"[daemon] reached max_cycles={args.max_cycles}, stopping")
                break

            try:
                cycle = governor.run_cycle()
                if cycle.veto_exercised or cycle.actions_escalated:
                    _notify_escalation(cycle.cycle_id, cycle.actions_escalated, cycle.veto_reason)

                # Check budget — stop if exhausted
                if cycle.budget_remaining <= 0:
                    print(f"[daemon] daily budget exhausted (${cycle.budget_remaining:.2f} remaining), stopping")
                    break

            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error(f"[daemon] cycle {cycle_count} failed: {e}")
                print(f"[daemon] cycle {cycle_count} error: {e}")

            if running and (not args.max_cycles or cycle_count < args.max_cycles):
                _time.sleep(args.interval)
    finally:
        # Clean up lock file
        try:
            GOVERNOR_LOCK.unlink(missing_ok=True)
        except Exception:
            pass
        print(f"[daemon] stopped after {cycle_count} cycles")


if __name__ == "__main__":
    main()
