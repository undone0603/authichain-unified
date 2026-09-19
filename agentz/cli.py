"""
AgentZ CLI

Usage:
    python -m agentz.cli list [--revenue-only]
    python -m agentz.cli creds [--missing-only] [--critical]
    python -m agentz.cli run <workflow_id> [--mode dry-run|confirm|auto]
    python -m agentz.cli run --all [--revenue-only] --mode dry-run
    python -m agentz.cli health
    python -m agentz.cli list-agents
    python -m agentz.cli openclaw status
    python -m agentz.cli openclaw notify "message" [--dry-run|--send]
    python -m agentz.cli openclaw command agents

`run` dispatches through the registry runner (credential preflight,
risk firewall, audit log). Default mode is confirm — never auto.
`--all --mode auto` is refused.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from typing import Any

from agentz.core.modes import Mode, parse_mode
from agentz.core.runner import (
    PRIORITY_RANK,
    DEFAULT_AUDIT_LOG,
    Workflow,
    execute,
    load_registry,
    resolve_order,
    write_audit_log,
)


def cmd_health(args: argparse.Namespace) -> int:
    from agentz.lm_studio import LMStudioClient

    client = LMStudioClient(base_url=args.lm_url)
    alive = client.health_check()
    if alive:
        models = client.list_models()
        print(f"LM Studio is UP at {args.lm_url}")
        print(f"Loaded models: {', '.join(models) if models else 'none'}")
        return 0
    print(f"LM Studio is NOT reachable at {args.lm_url}", file=sys.stderr)
    return 1


def cmd_list_agents(_args: argparse.Namespace) -> int:
    from agentz.agents.pipeline import ALL_AGENTS

    print(f"Registered agents ({len(ALL_AGENTS)}):")
    for cls in ALL_AGENTS:
        print(f"  • {cls.name:40s}  {cls.system_prompt[:60]}")
    return 0


def _selected_workflows(args: argparse.Namespace) -> list[Workflow]:
    registry = load_registry()
    if getattr(args, "all", False):
        ids = [
            wf.id
            for wf in registry.values()
            if not getattr(args, "revenue_only", False) or wf.blocks_revenue
        ]
        if not ids:
            raise KeyError("no workflows match --all/--revenue-only")
        return resolve_order(registry, ids)
    name = getattr(args, "workflow_id", None)
    if not name:
        raise KeyError("pass a workflow id or --all")
    if name in registry:
        return resolve_order(registry, [name])
    # Back-compat: old CLI used handler module paths (e.g. launch.governor)
    for wf in registry.values():
        handler = wf.handler
        aliases = {
            handler,
            handler.removeprefix("handlers."),
            handler.replace("handlers.", "").replace("/", "."),
        }
        if name in aliases:
            return resolve_order(registry, [wf.id])
    known = ", ".join(sorted(registry)[:12])
    raise KeyError(
        f"Unknown workflow {name!r}. Try `python -m agentz.cli list`. "
        f"Examples: {known}, …"
    )


def cmd_list(args: argparse.Namespace) -> int:
    registry = load_registry()
    wfs = list(registry.values())
    if args.revenue_only:
        wfs = [w for w in wfs if w.blocks_revenue]
    wfs.sort(key=lambda w: (PRIORITY_RANK.get(w.priority, 99), w.id))
    if args.json:
        payload = [
            {
                "id": w.id,
                "title": w.title,
                "priority": w.priority,
                "blocks_revenue": w.blocks_revenue,
                "handler": w.handler,
                "requires": w.requires,
                "confirm_before_run": w.confirm_before_run,
            }
            for w in wfs
        ]
        print(json.dumps(payload, indent=2))
        return 0
    print(f"{len(wfs)} workflows (default run mode: confirm)")
    for w in wfs:
        flag = "revenue" if w.blocks_revenue else "       "
        print(f"  {w.id:42s} {w.priority:8s} {flag}  {w.title}")
    return 0


def cmd_creds(args: argparse.Namespace) -> int:
    from agentz.core.credentials import DPP_LOOP_CREDS, inventory

    keys = list(DPP_LOOP_CREDS) if args.critical else None
    data = inventory(missing_only=args.missing_only, keys=keys)
    print(json.dumps(data, indent=2))
    if args.critical and data["missing_count"]:
        return 1
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    mode = parse_mode(args.mode)
    if args.all and mode == Mode.AUTO:
        print(
            "Refusing `run --all --mode auto`. Re-run with --mode dry-run "
            "(or confirm a single workflow id).",
            file=sys.stderr,
        )
        return 2
    try:
        workflows = _selected_workflows(args)
    except KeyError as e:
        print(str(e), file=sys.stderr)
        return 2

    verbose = not args.quiet
    results = []
    for wf in workflows:
        res = execute(wf, mode, verbose=verbose)
        results.append(res)
        if verbose or res.status in {"failed", "blocked"}:
            extra = res.notes or res.error or ""
            print(f"   → {res.status}{': ' + extra if extra else ''}")

    write_audit_log(results, DEFAULT_AUDIT_LOG)

    if args.json_out:
        payload: list[dict[str, Any]] = [
            asdict(r) if hasattr(r, "__dataclass_fields__") else r.__dict__ for r in results
        ]
        with open(args.json_out, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)

    if any(r.status == "failed" for r in results):
        return 1
    return 0


def cmd_openclaw(args: argparse.Namespace) -> int:
    """AgentZ → OpenClaw bridge (claw.authichain.com)."""
    from agentz.integrations.openclaw import OpenClawClient, status_summary

    client = OpenClawClient()
    action = args.openclaw_action

    if action == "status":
        summary = status_summary(client)
        print(json.dumps(summary, indent=2))
        if not summary.get("health_ok"):
            return 1
        if summary.get("openclaw_gateway") == "not_set" or summary.get("agentz_api") == "not_set":
            print(
                "Note: Worker reports gateway/AgentZ URL secrets as not_set. "
                "Owner must wrangler secret put OPENCLAW_GATEWAY_URL and "
                "AGENTZ_API_URL=https://agentz.authichain.com "
                "(publicly reachable — not localhost).",
                file=sys.stderr,
            )
        return 0

    if action == "notify":
        text = args.message
        if not text:
            print("openclaw notify requires a message", file=sys.stderr)
            return 2
        dry_run = not getattr(args, "send", False)
        if getattr(args, "dry_run", False):
            dry_run = True
        result = client.notify(
            text,
            channel=getattr(args, "channel", None),
            to=getattr(args, "to", None),
            dry_run=dry_run,
        )
        print(
            json.dumps(
                {
                    "ok": result.ok,
                    "dry_run": result.dry_run,
                    "status_code": result.status_code,
                    "data": result.data,
                    "error": result.error,
                },
                indent=2,
            )
        )
        return 0 if result.ok else 1

    if action == "command":
        cmd = args.bridge_command
        if not cmd:
            print("openclaw command requires a bridge command (e.g. agents)", file=sys.stderr)
            return 2
        result = client.command(
            cmd,
            args=getattr(args, "bridge_args", "") or "",
            dry_run=getattr(args, "dry_run", False),
        )
        print(
            json.dumps(
                {
                    "ok": result.ok,
                    "dry_run": result.dry_run,
                    "status_code": result.status_code,
                    "data": result.data,
                    "error": result.error,
                },
                indent=2,
            )
        )
        return 0 if result.ok else 1

    print(f"unknown openclaw action: {action}", file=sys.stderr)
    return 2


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

    sub.add_parser("health", help="Check LM Studio connectivity")
    sub.add_parser("list-agents", help="List all registered LM Studio agents")

    list_p = sub.add_parser("list", help="List registry workflows")
    list_p.add_argument(
        "--revenue-only",
        action="store_true",
        help="Only workflows with blocks_revenue: true",
    )
    list_p.add_argument(
        "--json",
        action="store_true",
        help="Machine-readable list",
    )

    creds_p = sub.add_parser(
        "creds",
        help="Credential inventory (names, status, length — never values)",
    )
    creds_p.add_argument(
        "--missing-only",
        action="store_true",
        help="Only keys that are unset or placeholders",
    )
    creds_p.add_argument(
        "--critical",
        action="store_true",
        help="Only the DPP revenue-loop keys (exit 1 if any missing)",
    )

    run_p = sub.add_parser("run", help="Run a registry workflow by id")
    run_p.add_argument(
        "workflow_id",
        nargs="?",
        default=None,
        help="Registry workflow id (see `agentz list`)",
    )
    run_p.add_argument(
        "--all",
        action="store_true",
        help="Run every matching workflow (refuses --mode auto)",
    )
    run_p.add_argument(
        "--revenue-only",
        action="store_true",
        help="With --all, only blocks_revenue workflows",
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
        help="Kept for compatibility; execution is already serial",
    )
    run_p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-step progress output",
    )
    run_p.add_argument(
        "--json-out",
        metavar="FILE",
        default=None,
        help="Write run results to a JSON file",
    )

    oc = sub.add_parser(
        "openclaw",
        help="Talk to the OpenClaw bridge (claw.authichain.com)",
    )
    oc_sub = oc.add_subparsers(dest="openclaw_action", required=True)
    oc_sub.add_parser("status", help="GET bridge /health (+ gateway status if available)")

    oc_notify = oc_sub.add_parser(
        "notify",
        help="POST /notify via bridge (dry-run by default; pass --send to deliver)",
    )
    oc_notify.add_argument("message", help="Notification text")
    oc_notify.add_argument("--channel", default=None, help="Optional channel (telegram, slack, …)")
    oc_notify.add_argument("--to", default=None, help="Optional recipient id")
    oc_notify.add_argument(
        "--dry-run",
        action="store_true",
        help="Force dry-run (default unless --send)",
    )
    oc_notify.add_argument(
        "--send",
        action="store_true",
        help="Actually deliver via Worker → OpenClaw gateway (not dry-run)",
    )

    oc_cmd = oc_sub.add_parser(
        "command",
        help="POST /command on the bridge (agents, workflows, architect, …)",
    )
    oc_cmd.add_argument("bridge_command", help="Command verb (agents, workflows, architect, run …)")
    oc_cmd.add_argument("bridge_args", nargs="?", default="", help="Optional args string")
    oc_cmd.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the request without sending",
    )

    return root


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "health":
        return cmd_health(args)
    if args.command == "list-agents":
        return cmd_list_agents(args)
    if args.command == "list":
        return cmd_list(args)
    if args.command == "creds":
        return cmd_creds(args)
    if args.command == "run":
        if not args.all and not args.workflow_id:
            parser.error("run requires a workflow id or --all")
        return cmd_run(args)
    if args.command == "openclaw":
        return cmd_openclaw(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
