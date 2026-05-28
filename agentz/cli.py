\"\"\"
AgentZ CLI

Usage:
    python -m agentz.cli run power_launch_all [OPTIONS]
    python -m agentz.cli health
    python -m agentz.cli list-agents
    python -m agentz.cli list
\"\"\"

from __future__ import annotations

import argparse
import json
import sys

from .deps import resolve_dependencies

def cmd_run(args: argparse.Namespace) -> int:
    from .agents.pipeline import power_launch_all
    
    # Resolve dependencies before execution
    try:
        order = resolve_dependencies()
        if args.verbose:
            print(f\"Validated dependency order: {', '.join(order)}\")
    except Exception as e:
        print(f\"Dependency error: {e}\", file=sys.stderr)
        return 1

    results = power_launch_all(
        mode=args.mode,
        verbose=not args.quiet,
    )

    if args.json_out:
        payload = [
            {
                \"name\": r.name,
                \"ok\": r.ok,
                \"output\": r.output,
                \"error\": r.error,
                \"duration_ms\": r.duration_ms,
            }
            for r in results
        ]
        with open(args.json_out, \"w\") as fh:
            json.dump(payload, fh, indent=2)
        if not args.quiet:
            print(f\"\\nResults written to {args.json_out}\")

    return 0 if all(r.ok for r in results) else 1


def cmd_health(args: argparse.Namespace) -> int:
    from .lm_studio import LMStudioClient
    
    alive = LMStudioClient(base_url=args.lm_url).check_health()
    if alive:
        print(f\"LM Studio is reachable at {args.lm_url}\")
        return 0
    else:
        print(f\"LM Studio is NOT reachable at {args.lm_url}\", file=sys.stderr)
        return 1


def cmd_list_agents(_args: argparse.Namespace) -> int:
    from .agents.pipeline import ALL_AGENTS
    
    print(f\"Registered agents ({len(ALL_AGENTS)}):\")
    for cls in ALL_AGENTS:
        print(f\"  • {cls.name:40s} {cls.system_prompt[:60]}\")
    return 0

def cmd_list(_args: argparse.Namespace) -> int:
    try:
        order = resolve_dependencies()
        print(\"Validated Execution Order:\")
        for i, wf_id in enumerate(order, 1):
            print(f\"{i}. {wf_id}\")
        return 0
    except Exception as e:
        print(f\"Error resolving dependencies: {e}\", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog=\"agentz\",
        description=\"AuthiChain AgentZ – autonomous agent orchestrator\",
    )
    root.add_argument(
        \"--lm-url\",
        default=\"http://localhost:1234/v1\",
        metavar=\"URL\",
        help=\"LM Studio API base URL\",
    )
    root.add_argument(
        \"--quiet\", \"-q\",
        action=\"store_true\",
        help=\"Suppress progress output\",
    )
    root.add_argument(
        \"--json-out\",
        metavar=\"FILE\",
        help=\"Write results to a JSON file\",
    )
    root.add_argument(
        \"--verbose\", \"-v\",
        action=\"store_true\",
        help=\"Enable verbose output\",
    )

    sub = root.add_subparsers(dest=\"command\", required=True)

    p_run = sub.add_parser(\"run\", help=\"Run a workflow\")
    p_run.add_argument(\"workflow_id\", help=\"ID of the workflow to run\")
    p_run.add_argument(
        \"--mode\",
        choices=[\"auto\", \"confirm\", \"dry-run\"],
        default=\"auto\",
        help=\"Execution mode\",
    )
    p_run.set_defaults(func=cmd_run)

    p_health = sub.add_parser(\"health\", help=\"Check LM Studio connectivity\")
    p_health.set_defaults(func=cmd_health)

    p_list_agents = sub.add_parser(\"list-agents\", help=\"List registered agents\")
    p_list_agents.set_defaults(func=cmd_list_agents)

    p_list = sub.add_parser(\"list\", help=\"List validated execution order\")
    p_list.set_defaults(func=cmd_list)

    return root


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == \"__main__\":
    sys.exit(main())
