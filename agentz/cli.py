"""
AgentZ CLI

Usage:
    python -m agentz.cli pulse
    python -m agentz.cli creds [--json]
    python -m agentz.cli list
    python -m agentz.cli probe <workflow_id>
    python -m agentz.cli run <workflow_id> [--mode auto|confirm|dry-run]
    python -m agentz.cli run --all [--mode dry-run|auto]
    python -m agentz.cli setup {federal-pipeline}
    python -m agentz.cli health
    python -m agentz.cli list-agents
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

# Ensure stdout/stderr can handle Unicode on Windows (CP1252 terminals)
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


# ── pulse ─────────────────────────────────────────────────────────────────────
def cmd_pulse(args: argparse.Namespace) -> int:
    from .core.credentials import get
    print("AgentZ heartbeat: OK")
    for key in ("hubspot_token", "stripe_secret", "openai_api_key", "supabase_url", "ollama_api_key"):
        val = get(key, required=False)
        print(f"  {key:35s}: {'set' if val else 'MISSING'}")
    return 0


# ── creds ─────────────────────────────────────────────────────────────────────
def cmd_creds(args: argparse.Namespace) -> int:
    from .core.credentials import audit_all
    report = audit_all()

    if getattr(args, "json", False):
        print(json.dumps(report, indent=2))
        return 0

    print(f"\n{'─'*60}")
    print(f"  AgentZ Credential Audit  ({len(report['present'])} present / "
          f"{len(report['missing'])} missing)")
    print(f"{'─'*60}")
    if report["verified"]:
        print("\n[OK]  VERIFIED:")
        for v in report["verified"]:
            print(f"    {v['key']:35s}  {v['msg']}")
    if report["failed"]:
        print("\n[XX]  FAILED:")
        for v in report["failed"]:
            print(f"    {v['key']:35s}  {v['msg']}")
    if report["missing"]:
        print("\n[!!]  MISSING:")
        for m in report["missing"]:
            print(f"    {m['key']:35s}  ({m['reason']}) -> {m['env']}")
    print(f"\n   skipped (no health-check): {len(report['skipped'])}")
    print(f"{'─'*60}\n")
    return 0 if not report["failed"] else 1


# ── list ──────────────────────────────────────────────────────────────────────
def cmd_list(args: argparse.Namespace) -> int:
    from .core.runner import load_registry
    reg = load_registry()
    print(f"\n{'─'*80}")
    print(f"  AgentZ Workflow Registry  ({len(reg)} workflows)")
    print(f"{'─'*80}")
    for wf in sorted(reg.values(), key=lambda w: (w.priority != "critical", w.priority, w.id)):
        rev = "$$" if wf.blocks_revenue else "  "
        print(f"  {rev} [{wf.priority:8s}]  {wf.id:45s}  ~{wf.estimated_minutes}min")
    print()
    return 0


# ── probe ─────────────────────────────────────────────────────────────────────
def cmd_probe(args: argparse.Namespace) -> int:
    from .core.runner import load_registry
    from .core.credentials import check_all
    reg = load_registry()
    wf = reg.get(args.workflow_id)
    if not wf:
        print(f"Unknown workflow: {args.workflow_id}", file=sys.stderr)
        return 1
    present, missing = check_all(wf.requires)
    print(f"\nWorkflow : {wf.id}")
    print(f"Title    : {wf.title}")
    print(f"Priority : {wf.priority}")
    print(f"Type     : {wf.type}  ~{wf.estimated_minutes}min")
    print(f"Requires : {wf.requires or '(none)'}")
    print(f"Present  : {present}")
    print(f"Missing  : {missing}")
    print(f"Prereqs  : {wf.prerequisites or '(none)'}")
    print(f"Runnable : {'YES' if not missing else 'NO - missing ' + str(missing)}")
    return 0 if not missing else 1


# ── setup ─────────────────────────────────────────────────────────────────────
def cmd_setup(args: argparse.Namespace) -> int:
    if args.target == "federal-pipeline":
        print("federal-pipeline: Supabase table applied via MCP in prior session.")
        print("  Table: public.federal_pipeline (notice_id PK, status, history JSONB)")
        return 0
    print(f"Unknown setup target: {args.target}", file=sys.stderr)
    return 1


# ── run ───────────────────────────────────────────────────────────────────────
def cmd_run(args: argparse.Namespace) -> int:
    from .core.runner import load_registry, execute, resolve_order, write_audit_log
    from .core.modes import parse_mode

    mode = parse_mode(args.mode)
    reg = load_registry()

    if getattr(args, "all", False):
        ordered = resolve_order(reg, [wf.id for wf in reg.values() if wf.type != "browser"])
    else:
        wf_id = args.workflow_id
        if not wf_id:
            print("Specify a workflow ID or use --all", file=sys.stderr)
            return 1
        if wf_id not in reg:
            print(f"Unknown workflow: {wf_id}. Run 'python -m agentz.cli list' to see all.", file=sys.stderr)
            return 1
        ordered = resolve_order(reg, [wf_id])

    results = []
    for wf in ordered:
        res = execute(wf, mode=mode, verbose=not args.quiet)
        results.append(res)
        icon = {"ok": "[OK]", "skipped": "[--]", "failed": "[XX]", "blocked": "[  ]"}.get(res.status, "[?]")
        print(f"  {icon}  {res.workflow_id:45s}  {res.status:8s}  {res.duration_s:.1f}s")
        if res.error:
            for line in (res.error or "").splitlines()[:3]:
                print(f"       {line}")
        if res.notes:
            print(f"       -> {res.notes[:120]}")

    write_audit_log(results, Path(__file__).parent / "logs" / "runs.jsonl")
    ok = sum(1 for r in results if r.status == "ok")
    skip = sum(1 for r in results if r.status == "skipped")
    fail = sum(1 for r in results if r.status in ("failed", "blocked"))
    print(f"\n  Summary: {ok} ok, {skip} skipped, {fail} failed/blocked")

    if getattr(args, "json_out", None):
        with open(args.json_out, "w") as fh:
            json.dump([r.__dict__ for r in results], fh, indent=2)
        if not args.quiet:
            print(f"  Results written to {args.json_out}")

    return 0 if fail == 0 else 1


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

    sub.add_parser("pulse",       help="Heartbeat + credential spot-check")
    sub.add_parser("list",        help="List all registered workflows")
    sub.add_parser("health",      help="Check LM Studio connectivity")
    sub.add_parser("list-agents", help="List all registered agents")

    creds_p = sub.add_parser("creds", help="Full credential audit")
    creds_p.add_argument("--json", action="store_true")

    probe_p = sub.add_parser("probe", help="Check if a workflow is runnable")
    probe_p.add_argument("workflow_id")

    setup_p = sub.add_parser("setup", help="One-time infra setup")
    setup_p.add_argument("target", choices=["federal-pipeline"])

    run_p = sub.add_parser("run", help="Run a workflow by ID (or --all)")
    run_p.add_argument("workflow_id", nargs="?")
    run_p.add_argument("--all",  action="store_true", help="Run all non-browser workflows")
    run_p.add_argument("--mode", choices=["auto", "confirm", "dry-run"], default="auto")
    run_p.add_argument("--serial", action="store_true")
    run_p.add_argument("--quiet",  action="store_true")
    run_p.add_argument("--json-out", metavar="FILE", default=None)

    return root


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    # Propagate --lm-url to sub-commands that need it
    if not hasattr(args, "lm_url"):
        args.lm_url = "http://localhost:1234/v1"

    dispatch = {
        "pulse":       cmd_pulse,
        "creds":       cmd_creds,
        "list":        cmd_list,
        "probe":       cmd_probe,
        "setup":       cmd_setup,
        "run":         cmd_run,
        "health":      cmd_health,
        "list-agents": cmd_list_agents,
    }
    fn = dispatch.get(args.command)
    if fn:
        return fn(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
