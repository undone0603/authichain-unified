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

from agentz.core.modes import ExecutionContext, Mode, parse_mode


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

    # --- Risk Firewall Integration ---
    from agentz.core.risk_firewall import assess_workflow, RiskAssessment
    from pathlib import Path
    
    # Defaults for the firewall; in a production system, these would come from the registry.yaml
    risk_assessment = assess_workflow(
        wf_id=args.handler,
        risk_class="medium", # Default for now
        financial_limit_usd=100.0,
        requires_human_approval=False,
        current_mode=mode.value,
        audit_log_path=Path("agentz/logs/runs.jsonl"),
        protocol_veto_active=False
    )
    
    if not risk_assessment.approved:
        print(f"[firewall] ❌ BLOCKED: {risk_assessment.reason}", file=sys.stderr)
        return 1
        
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
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"[runner] Handler '{args.handler}' failed: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
