"""
AgentZ CLI

Usage:
    python -m agentz.cli run power_launch_all [OPTIONS]
    python -m agentz.cli health
    python -m agentz.cli list-agents

Options for 'run power_launch_all':
    --mode {auto|confirm|dry-run}   Execution mode (default: auto)
    --serial                        Disable parallel execution
    --lm-url URL                    LM Studio base URL (default: http://localhost:1234/v1)
    --quiet                         Suppress progress output
    --json-out FILE                 Write results to a JSON file
"""

from __future__ import annotations

import argparse
import json
import sys


def cmd_run(args: argparse.Namespace) -> int:
    from .power_launch import power_launch_all

    results = power_launch_all(
        mode=args.mode,
        parallel=not args.serial,
        lm_base_url=args.lm_url,
        verbose=not args.quiet,
    )

    if args.json_out:
        payload = [
            {
                "name": r.name,
                "ok": r.ok,
                "output": r.output,
                "error": r.error,
                "duration_ms": r.duration_ms,
            }
            for r in results
        ]
        with open(args.json_out, "w") as fh:
            json.dump(payload, fh, indent=2)
        if not args.quiet:
            print(f"\nResults written to {args.json_out}")

    return 0 if all(r.ok for r in results) else 1


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
    run_p = sub.add_parser("run", help="Run a named command")
    run_p.add_argument(
        "command_name",
        choices=["power_launch_all"],
        help="Command to run",
    )
    run_p.add_argument(
        "--mode",
        choices=["auto", "confirm", "dry-run"],
        default="auto",
        help="Execution mode (default: auto)",
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

    # Propagate --lm-url to sub-commands that need it
    if not hasattr(args, "lm_url"):
        args.lm_url = "http://localhost:1234/v1"

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
