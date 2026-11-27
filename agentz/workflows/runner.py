"""
agentz.workflows.runner
-----------------------
CLI runner for AgentZ workflow handlers. Invoked by GitHub Actions via:
    python -m agentz.workflows.runner --handler <name> [--mode dry-run|confirm|auto]

Policy (#2289). This entry point fails closed:

- The default mode is ``dry-run``. ``auto`` happens only when a caller asks for it,
  with ``--mode auto`` or ``AGENTZ_MODE=auto``.
- The handler is looked up in ``agentz/workflows/registry.yaml``. A handler with no
  registry entry may only run in dry-run.
- The risk firewall is applied with the registry entry's real ``risk_class``,
  ``financial_limit_usd`` and ``requires_human_approval``, not placeholder values.
  ``confirm_before_run`` also promotes AUTO to CONFIRM, as in ``agentz.core.runner``.
- CONFIRM needs a person at a terminal. Without a TTY the run is refused rather than
  left to hang or crash on ``input()``.

Exit codes: 0 handler completed, 1 handler or argument error, 2 refused by policy.
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

from agentz.core.modes import ExecutionContext, Mode, parse_mode

POLICY_REFUSED = 2
_HANDLER_NAME = re.compile(r"^[a-z0-9_]+$")
_RISK_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}
AUDIT_LOG_PATH = Path("agentz/logs/runs.jsonl")


def resolve_registry_entry(handler: str, registry: Optional[dict] = None):
    """Return the registry Workflow that dispatches to ``handlers.<handler>``.

    Prefers the entry whose id equals the handler name. When several entries share
    the handler, the most restrictive one wins: highest risk class, then human
    approval or confirm_before_run, then the smallest non-zero budget.
    Returns None when no entry uses the handler.
    """
    if registry is None:
        from agentz.core.runner import load_registry

        registry = load_registry()
    matches = [wf for wf in registry.values() if wf.handler == f"handlers.{handler}"]
    if not matches:
        return None
    for wf in matches:
        if wf.id == handler:
            return wf

    def strictness(wf):
        limit = float(wf.financial_limit_usd or 0)
        return (
            _RISK_ORDER.get(str(wf.risk_class), 0),
            bool(wf.requires_human_approval) or bool(wf.confirm_before_run),
            -limit if limit > 0 else float("-inf"),
        )

    return max(matches, key=strictness)


def _refuse(message: str) -> int:
    print(f"[firewall] BLOCKED: {message}", file=sys.stderr)
    return POLICY_REFUSED


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
        default=os.getenv("AGENTZ_MODE") or "dry-run",
        choices=["dry-run", "confirm", "auto"],
        help="Execution mode. Defaults to dry-run; auto must be requested explicitly.",
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

    if not _HANDLER_NAME.match(args.handler):
        print(f"[runner] ERROR: invalid handler name {args.handler!r}", file=sys.stderr)
        return 1

    mode = parse_mode(args.mode)

    params = {}
    if args.params:
        try:
            params = json.loads(args.params)
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid JSON in --params: {e}", file=sys.stderr)
            return 1

    # --- Risk Firewall: real registry constraints, fail closed ---
    from agentz.core.risk_firewall import assess_workflow

    wf = resolve_registry_entry(args.handler)
    if wf is None:
        if mode != Mode.DRY_RUN:
            return _refuse(
                f"handler '{args.handler}' has no entry in agentz/workflows/registry.yaml; "
                f"only dry-run is allowed for unregistered handlers (requested {mode.value})"
            )
        workflow_id = args.handler
        print(f"[firewall] handler '{args.handler}' is unregistered; dry-run only")
    else:
        workflow_id = wf.id
        risk_assessment = assess_workflow(
            wf_id=wf.id,
            risk_class=str(wf.risk_class),
            financial_limit_usd=float(wf.financial_limit_usd or 0),
            requires_human_approval=bool(wf.requires_human_approval),
            current_mode=mode.value,
            audit_log_path=AUDIT_LOG_PATH,
            protocol_veto_active=os.getenv("AGENTZ_PROTOCOL_VETO", "").lower() in ("1", "true"),
        )
        if not risk_assessment.approved:
            return _refuse(risk_assessment.reason)
        if mode == Mode.AUTO and (
            risk_assessment.escalated_mode == "confirm" or wf.confirm_before_run
        ):
            print(
                f"[firewall] escalating {wf.id} to CONFIRM "
                f"(risk={wf.risk_class}, confirm_before_run={wf.confirm_before_run})"
            )
            mode = Mode.CONFIRM

    if mode == Mode.CONFIRM and not sys.stdin.isatty():
        return _refuse(
            f"'{workflow_id}' needs CONFIRM, and there is no terminal to confirm on. "
            "Run it interactively, or use --mode dry-run."
        )

    ctx = ExecutionContext(mode=mode, workflow_id=workflow_id, verbose=args.verbose, parameters=params)

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

    print(f"[runner] Starting handler '{args.handler}' in mode='{mode.value}'")
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
