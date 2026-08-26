"""
AgentZ CLI

Usage:
    python -m agentz.cli run <workflow_id> [OPTIONS]
    python -m agentz.cli health
    python -m agentz.cli list-agents

Options for 'run <workflow_id>':
    --mode {auto|confirm|dry-run}   Execution mode (default: confirm)
    --serial                        Disable parallel execution
    --lm-url URL                    LM Studio base URL (default: http://localhost:1234/v1)
    --quiet                         Suppress progress output
    --json-out FILE                 Write results to a JSON file
"""

from __future__ import annotations

import argparse
import json
import sys
import os
import importlib

# Helper to discover handlers
def get_available_handlers() -> list[str]:
    handlers = []
    base_path = os.path.join(os.path.dirname(__file__), "workflows", "handlers")
    for root, _, files in os.walk(base_path):
        for file in files:
            if file.endswith(".py") and file != "__init__.py" and not file.startswith("_"):
                # Construct module path
                rel_path = os.path.relpath(os.path.join(root, file), base_path)
                module_path = rel_path.replace(os.path.sep, ".").replace(".py", "")
                handlers.append(module_path)
    return sorted(handlers)

def cmd_run(args: argparse.Namespace) -> int:
    # Use workflow runner to execute the selected handler
    from .workflows.runner import main as runner_main
    
    # Map CLI args to runner args
    runner_args = ["--handler", args.command_name, "--mode", args.mode]
    if args.quiet:
        runner_args.append("--quiet")
        
    return runner_main(runner_args)

def cmd_health(args: argparse.Namespace) -> int:
    from .lm_studio import LMStudioClient

    client = LMStudioClient(base_url=args.lm_url)
    alive = client.health_check()
    if alive:
        models = client.list_models()
        print(f"LM Studio is UP at {args.lm_url}")
        print(f"Loaded models: {', '.join(models) if models else 'none'}")
        return 0
    else:
        print(f"LM Studio is NOT reachable at {args.lm_url}", file=sys.stderr)
        return 1

def cmd_list_agents(_args: argparse.Namespace) -> int:
    from .agents.pipeline import ALL_AGENTS

    print(f"Registered agents ({len(ALL_AGENTS)}):")
    for cls in ALL_AGENTS:
        print(f"  • {cls.name:40s}  {cls.system_prompt[:60]}")
    return 0

def build_parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="agentz",
        description="AuthiChain AgentZ — autonomous agent orchestrator",
    )
    root.add_argument(
        "--lm-url",
        default="http://localhost:1234/v1",
        metavar="URL",
        help="LM Studio OpenAI-compatible base URL",
    )

    sub = root.add_subparsers(dest="command", required=True)

    # ── health ───────────────────────────────────────────────────────────────
    sub.add_parser("health", help="Check LM Studio connectivity")

    # ── list-agents ──────────────────────────────────────────────────────────
    sub.add_parser("list-agents", help="List all registered agents")

    # ── run ──────────────────────────────────────────────────────────────────
    available = get_available_handlers()
    run_p = sub.add_parser("run", help="Run a named workflow")
    run_p.add_argument(
        "command_name",
        choices=available,
        help="Workflow handler to run",
    )
    run_p.add_argument(
        "--mode",
        choices=["auto", "confirm", "dry-run"],
        default="confirm",
        help="Execution mode (default: confirm)",
    )
    run_p.add_argument(
        "--serial",
        action="store_true",
        help="Disable parallel execution",
    )
    run_p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress output",
    )
    run_p.add_argument(
        "--json-out",
        metavar="FILE",
        default=None,
        help="Write results to a JSON file",
    )

    return root

def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "health":
        return cmd_health(args)
    if args.command == "list-agents":
        return cmd_list_agents(args)
    if args.command == "run":
        return cmd_run(args)

    parser.print_help()
    return 1

if __name__ == "__main__":
    sys.exit(main())
