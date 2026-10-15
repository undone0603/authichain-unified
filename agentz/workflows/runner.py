"""
agentz.workflows.runner
-----------------------
CLI runner for AgentZ workflow handlers. Invoked by GitHub Actions via:
    python -m agentz.workflows.runner --handler <name> [--mode dry-run|confirm|auto]

The runner dynamically imports agentz.workflows.handlers.<name>,
creates an ExecutionContext, and calls the module's run(ctx) function.
"""
from __future__ import annotations
import argparse
import importlib
import os
import sys

from typing import Any, Dict, Optional

from agentz.core.modes import ExecutionContext, Mode, parse_mode
from agentz.skills.browser_layer_orchestrator import BrowserLayerOrchestrator, LayerRole

# Distinct exit codes so schedulers can tell a deliberate halt from a crash.
EXIT_KILL_SWITCH = 10
EXIT_APPROVAL_REQUIRED = 11
EXIT_VERIFY_FAILED = 12
EXIT_POLICY_UNAVAILABLE = 13


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m agentz.workflows.runner",
        description="AgentZ Workflow Runner: executes a named handler module.",
    )
    parser.add_argument(
        "--handler",
        required=True,
        help="Handler name (module inside agentz.workflows.handlers).",
    )
    parser.add_argument(
        "--mode",
        default=os.getenv("AGENTZ_MODE", "auto"),
        choices=["dry-run", "confirm", "auto"],
        help="Execution mode: dry-run (no side-effects), confirm, or auto.",
    )
    parser.add_argument(
        "--params",
        type=str,
        help="JSON string of parameters to pass to the handler.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=True,
    )
    args = parser.parse_args(argv)

    mode = parse_mode(args.mode)
    
    params = {}
    if args.params:
        try:
            import json
            params = json.loads(args.params)
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid JSON in --params: {e}", file=sys.stderr)
            return 1

    # --- Autonomy policy: kill switch + registry-driven policy ---
    from agentz.core import autonomy_policy as _policy

    killed, kill_reason = _policy.kill_switch_status()
    if killed:
        print(f"[kill-switch] HALTED: {kill_reason}", file=sys.stderr)
        return EXIT_KILL_SWITCH
    try:
        policy = _policy.policy_for(args.handler)
    except _policy.PolicyUnavailable as exc:
        print(f"[policy] HALTED (AGENTZ_POLICY_STRICT): {exc}", file=sys.stderr)
        return EXIT_POLICY_UNAVAILABLE

    # --- Risk Firewall Integration ---
    from agentz.core.risk_firewall import assess_workflow, RiskAssessment
    from pathlib import Path
    
    # Risk class, spend limit and approval need come from registry.yaml.
    risk_assessment = assess_workflow(
        wf_id=args.handler,
        risk_class=policy.risk_class,
        financial_limit_usd=policy.financial_limit_usd,
        requires_human_approval=policy.requires_human_approval,
        current_mode=mode.value,
        audit_log_path=Path("agentz/logs/runs.jsonl"),
        protocol_veto_active=False
    )
    
    if not risk_assessment.approved:
        print(f"[firewall] ❌ BLOCKED: {risk_assessment.reason}", file=sys.stderr)
        return 1

    # --- Approval gate: registry sets confirm_before_run ---
    if policy.requires_human_approval and mode.value == "auto":
        if not _policy.consume_approval(policy.workflow_id):
            request_id = _policy.request_approval(
                policy.workflow_id, mode.value, "registry: confirm_before_run"
            )
            print(
                f"[approval] '{policy.workflow_id}' needs human approval before an "
                f"unattended run. Request {request_id} queued; approve with: "
                f"python -m agentz.cli approvals approve {request_id}",
                file=sys.stderr,
            )
            return EXIT_APPROVAL_REQUIRED
        
    if risk_assessment.escalated_mode == "confirm" and mode == Mode.AUTO:
        print(f"[firewall] ⚠️ Escalating mode to CONFIRM: {risk_assessment.reason}")
        mode = Mode.CONFIRM

    ctx = ExecutionContext(mode=mode, workflow_id=args.handler, verbose=args.verbose, parameters=params)

    # Dynamically import the requested handler module.
    module_path = f"agentz.workflows.handlers.{args.handler}"
    try:
        handler_module = importlib.import_module(module_path)
    except ModuleNotFoundError:
        print(
            f"[runner] ERROR: handler module '{module_path}' not found.\n"
            f"  Available handlers live in agentz/workflows/handlers/*.py",
            file=sys.stderr,
        )
        return 1

    handler_fn = getattr(handler_module, "run", None)
    if handler_fn is None:
        print(
            f"[runner] ERROR: '{module_path}' must define a run(ctx) function.",
            file=sys.stderr,
        )
        return 1

    print(f"[runner] Starting handler '{args.handler}' in mode='{args.mode}'")
    try:
        result = handler_fn(ctx)
        print(f"[runner] Handler '{args.handler}' completed.")
        if result:
            print(f"[runner] Result: {result}")
        # --- Independent verification: never trust the handler alone ---
        if mode.value != "dry-run":
            from agentz.core import verifier as _verifier

            verdict = _verifier.run_checks(policy.verify)
            if verdict.configured:
                print(verdict.summary(), file=sys.stdout if verdict.ok else sys.stderr)
            if not verdict.ok:
                return EXIT_VERIFY_FAILED
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"[runner] Handler '{args.handler}' failed: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


class WorkflowRunner:
    """Executes AgentZ workflows including multi-layer browser workflows."""

    def __init__(self):
        self.orchestrator = BrowserLayerOrchestrator()

    def run_workflow(self, workflow_name: str, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if workflow_name in ("browser_layer", "browser-layer", "browser_layer_orchestrator"):
            return self.run_browser_layer_workflow(config or {})
        return {"status": "executed", "workflow": workflow_name, "config": config or {}}

    def run_browser_layer_workflow(self, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        config = config or {}
        target_layer = config.get("target_layer", LayerRole.L4_TERMINAL_PANEL)
        handle_modals = config.get("handle_modals", True)

        analysis = self.orchestrator.analyze_layers()
        if handle_modals and self.orchestrator.has_blocking_modals():
            dismissed = self.orchestrator.dismiss_modals()
        else:
            dismissed = []

        if isinstance(target_layer, str):
            try:
                target_layer = LayerRole[target_layer]
            except KeyError:
                pass

        focused_layer = self.orchestrator.focus_layer(target_layer)
        active = self.orchestrator.get_active_layer()

        return {
            "status": "success",
            "active_layer": active.value if hasattr(active, "value") else str(active),
            "focused_layer": repr(focused_layer),
            "dismissed_modals": dismissed,
            "analysis": analysis,
            "context_preserved": True
        }


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
