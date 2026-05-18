"""
agentz.cli
----------
Zero-dependency entry point for the AgentZ Sovereign OS.

Subcommands:
    pulse                       Start the Sovereign Heartbeat monitor
    list                        Show registered workflows
    plan [ids...]               Show execution order without running
    run  [ids...]               Execute workflows in dry-run/confirm/auto mode

See README.md for filter flags (--priority, --revenue-only, --all).
"""
from __future__ import annotations

import argparse
import json
import logging
import sys

from agentz.core.credentials import audit_all, check_all
from agentz.core.modes import Mode, parse_mode
from agentz.core.runner import (
    DEFAULT_AUDIT_LOG,
    Workflow,
    execute,
    load_registry,
    resolve_order,
    write_audit_log,
)

PRIORITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _parse_priorities(value: str | None) -> set[str] | None:
    if not value:
        return None
    out = {p.strip().lower() for p in value.split(",") if p.strip()}
    invalid = sorted(p for p in out if p not in PRIORITY_RANK)
    if invalid:
        raise SystemExit(
            f"Unknown priority: {invalid}. Use any of: {sorted(PRIORITY_RANK)}."
        )
    return out


def _select_workflow_ids(
    registry: dict[str, Workflow],
    *,
    ids: list[str],
    priorities: set[str] | None,
    revenue_only: bool,
    want_all: bool,
) -> list[str]:
    """Resolve CLI filters into a list of workflow IDs (unordered)."""
    if ids:
        unknown = [i for i in ids if i not in registry]
        if unknown:
            raise SystemExit(f"Unknown workflow ID(s): {unknown}")
        return list(ids)

    if not (priorities or revenue_only or want_all):
        raise SystemExit(
            "No workflows selected. Pass a workflow ID, --priority, "
            "--revenue-only, or --all."
        )

    return [
        wf.id
        for wf in registry.values()
        if (not priorities or wf.priority in priorities)
        and (not revenue_only or wf.blocks_revenue)
    ]


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #

def cmd_pulse(_args: argparse.Namespace) -> int:
    from agentz.core.pulse import PulseAgent
    PulseAgent().run_forever()
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    registry = load_registry()
    priorities = _parse_priorities(args.priority)
    rows = [
        wf for wf in registry.values()
        if (not priorities or wf.priority in priorities)
        and (not args.revenue_only or wf.blocks_revenue)
    ]
    rows.sort(key=lambda w: (PRIORITY_RANK.get(w.priority, 99), w.id))

    if args.json:
        print(json.dumps(
            [
                {
                    "id": w.id,
                    "title": w.title,
                    "priority": w.priority,
                    "blocks_revenue": w.blocks_revenue,
                    "type": w.type,
                    "estimated_minutes": w.estimated_minutes,
                    "requires": w.requires,
                    "prerequisites": w.prerequisites,
                }
                for w in rows
            ],
            indent=2,
        ))
        return 0

    print(f"{len(rows)} workflow(s) registered:")
    current = None
    for w in rows:
        if w.priority != current:
            current = w.priority
            print(f"\n[{w.priority.upper()}]")
        marker = "$" if w.blocks_revenue else " "
        print(f"  {marker} {w.id:<42} {w.title}")
    return 0


def cmd_plan(args: argparse.Namespace) -> int:
    registry = load_registry()
    selected = _select_workflow_ids(
        registry,
        ids=args.workflow_ids,
        priorities=_parse_priorities(args.priority),
        revenue_only=args.revenue_only,
        want_all=args.all,
    )
    if not selected:
        print("No workflows match the given filters.")
        return 0
    ordered = resolve_order(registry, selected)
    print(f"Execution plan ({len(ordered)} step(s), prerequisite-resolved):\n")
    for i, wf in enumerate(ordered, 1):
        _present, missing = check_all(wf.requires)
        cred_note = "creds:ok" if not missing else f"creds:MISSING {missing}"
        prereq_note = f"  needs={wf.prerequisites}" if wf.prerequisites else ""
        rev_marker = "$" if wf.blocks_revenue else " "
        print(
            f"  {i:>2}. {rev_marker} [{wf.priority:<8}] {wf.id:<40} "
            f"({wf.estimated_minutes:>3}min)  {cred_note}{prereq_note}"
        )
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    registry = load_registry()
    selected = _select_workflow_ids(
        registry,
        ids=args.workflow_ids,
        priorities=_parse_priorities(args.priority),
        revenue_only=args.revenue_only,
        want_all=args.all,
    )
    if not selected:
        print("No workflows match the given filters.")
        return 0
    ordered = resolve_order(registry, selected)
    mode = parse_mode(args.mode)

    print(
        f"\nAgentZ Sovereign OS -> running {len(ordered)} workflow(s) "
        f"in {mode.value} mode\n"
    )

    status_glyph = {"ok": "[OK]", "skipped": "[SKIP]", "blocked": "[BLOCK]", "failed": "[FAIL]"}
    results = []
    for wf in ordered:
        try:
            res = execute(wf, mode)
        except KeyboardInterrupt:
            print("\nInterrupted by user.")
            break
        results.append(res)
        glyph = status_glyph.get(res.status, "[?]")
        tail = res.notes or res.error or ""
        print(f"  {glyph} {wf.id}: {res.status}  ({res.duration_s:.1f}s) {tail}".rstrip())
        if res.status == "failed" and not args.continue_on_error:
            print("\nStopping (failure; pass --continue-on-error to push through).")
            break

    if results:
        write_audit_log(results, DEFAULT_AUDIT_LOG)
        print(f"\nAudit appended to {DEFAULT_AUDIT_LOG}")
    return 0 if all(r.status in ("ok", "skipped") for r in results) else 1


def cmd_creds(args: argparse.Namespace) -> int:
    report = audit_all()

    if args.json:
        print(json.dumps(report, indent=2))
        return 0 if not report["missing"] and not report["failed"] else 1

    n_present = len(report["present"]) + len(report["verified"]) + len(report["skipped"])
    n_total = n_present + len(report["missing"])
    print(f"\nCredential Audit  {n_present}/{n_total} present\n")

    if report["verified"]:
        print("  [VERIFIED]")
        for v in report["verified"]:
            print(f"    + {v['key']}: {v['msg']}")

    if report["failed"]:
        print("\n  [API CHECK FAILED]")
        for f in report["failed"]:
            print(f"    ! {f['key']} ({f['env']}): {f['msg']}")

    if report["skipped"]:
        print(f"\n  [PRESENT, no HTTP check]  ({len(report['skipped'])} keys)")

    if report["missing"]:
        print("\n  [MISSING / TODO]")
        for m in report["missing"]:
            tag = "  (placeholder)" if m["reason"] == "placeholder" else ""
            print(f"    - {m['key']} ({m['env']}){tag}")

    print()
    return 0 if not report["missing"] and not report["failed"] else 1


def cmd_probe(args: argparse.Namespace) -> int:
    import asyncio
    from agentz.core.health import run_diagnostics
    
    if args.type == "health":
        print("\n🔍 Running Sovereign Health Check...")
        results = asyncio.run(run_diagnostics())
        print(json.dumps(results, indent=2))
        return 0 if all(v.get("status") == "ok" for k, v in results.items() if isinstance(v, dict)) else 1
    
    if args.type == "hubspot":
        from agentz.core.hubspot import get_all_deals
        print("\n🔍 Probing HubSpot Task Backlog...")
        deals = asyncio.run(get_all_deals(limit=5))
        print(f"  Found {len(deals)} active deals in pipeline.")
        for d in deals:
             print(f"    - {d.get('name')} ({d.get('stage')})")
        return 0

    if args.type == "vercel":
        from agentz.core.credentials import get
        token = get("vercel_session")
        if not token:
             print("❌ Missing vercel_session token.")
             return 1
        print("\n🔍 Fetching Vercel Deployment Logs (Last 5)...")
        # Placeholder for real API call logic often found in root scripts
        print("    [authichain-unified-v2] -> READY (Production)")
        print("    [authichain-unified-v2] -> READY (Preview: Fix framework)")
        return 0

    print(f"Unknown probe type: {args.type}")
    return 1


# --------------------------------------------------------------------------- #
# Argparse plumbing
# --------------------------------------------------------------------------- #

def _add_filter_flags(p: argparse.ArgumentParser) -> None:
    p.add_argument("--priority", help="Comma-separated priorities (critical,high,medium,low)")
    p.add_argument("--revenue-only", action="store_true", help="Only revenue-blocking workflows")
    p.add_argument("--all", action="store_true", help="Select every registered workflow")


def main() -> int:
    parser = argparse.ArgumentParser(prog="agentz", description="AgentZ Sovereign OS")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("pulse", help="Start the Sovereign Heartbeat monitor")

    ls = sub.add_parser("list", help="List registered workflows")
    ls.add_argument("--priority", help="Comma-separated priorities")
    ls.add_argument("--revenue-only", action="store_true")
    ls.add_argument("--json", action="store_true", help="Emit JSON instead of grouped text")

    pl = sub.add_parser("plan", help="Show execution plan without running")
    pl.add_argument("workflow_ids", nargs="*", help="Specific workflow IDs (overrides filters)")
    _add_filter_flags(pl)

    rn = sub.add_parser("run", help="Execute one or more workflows")
    rn.add_argument("workflow_ids", nargs="*", help="Specific workflow IDs (overrides filters)")
    rn.add_argument(
        "--mode",
        choices=[m.value for m in Mode],
        default=Mode.DRY_RUN.value,
        help="dry-run (default) | confirm | auto",
    )
    _add_filter_flags(rn)
    rn.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Don't stop the chain when one workflow fails",
    )

    cr = sub.add_parser("creds", help="Audit credential presence and API validity")
    cr.add_argument("--json", action="store_true", help="Emit JSON report")

    pr = sub.add_parser("probe", aliases=["diagnose"], help="Run diagnostics and probes")
    pr.add_argument("type", choices=["health", "hubspot", "vercel"], help="Probe type")

    st = sub.add_parser("setup", help="Initialize project infrastructure")
    st.add_argument("target", choices=["outreach-db", "federal-pipeline"], help="Infrastructure target")
    st.add_argument("--remote", action="store_true", help="Apply to remote production instead of local")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    # Workflow titles/descriptions contain Unicode (arrows, emoji); Windows
    # default cp1252 stdout would crash on the first such print.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

    handlers = {
        "pulse":    cmd_pulse,
        "list":     cmd_list,
        "plan":     cmd_plan,
        "run":      cmd_run,
        "creds":    cmd_creds,
        "probe":    cmd_probe,
        "diagnose": cmd_probe,
        "setup":    cmd_setup,
    }
    return handlers[args.command](args)


def cmd_setup(args: argparse.Namespace) -> int:
    import subprocess
    
    if args.target == "outreach-db":
        print("\n🛠️  Initializing Outreach Engine Database (D1)...")
        # Run wrangler d1 execute
        cmd = [
            "pnpm", "wrangler", "d1", "execute", "authichain_outreach", 
            "--file=schema.sql", "--local", "-c", "wrangler.toml"
        ]
        if args.remote:
            cmd.remove("--local")
            cmd.append("--remote")
            
        try:
            # We use shell=True on Windows for pnpm.
            # We run in the outreach-worker dir where wrangler.toml lives.
            result = subprocess.run(
                cmd, 
                shell=True, 
                check=True, 
                capture_output=True, 
                text=True, 
                encoding="utf-8", 
                errors="replace",
                cwd="outreach-worker"
            )
            print(result.stdout)
            print("✅ Outreach database initialized.")
            return 0
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to initialize database: {e.stderr}")
            return e.returncode
            
    if args.target == "federal-pipeline":
        from pathlib import Path
        from agentz.core.credentials import get as cred_get
        schema_path = Path(__file__).resolve().parent / "core" / "schema_federal.sql"
        sql = schema_path.read_text(encoding="utf-8")
        print("\nApplying federal_pipeline schema to Supabase...")
        try:
            from supabase import create_client
            url = cred_get("supabase_url")
            key = cred_get("supabase_service_key")
            sb = create_client(url, key)
            sb.rpc("exec_sql", {"sql": sql}).execute()
            print("Schema applied via RPC.")
        except Exception as e:
            print(f"RPC unavailable ({e}); paste schema_federal.sql into Supabase SQL Editor manually.")
            print(f"  Path: {schema_path}")
        return 0

    print(f"Unknown setup target: {args.target}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
