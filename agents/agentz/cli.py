"""
agentz.cli
----------
Command-line interface for the AgentZ workflow runner.

Usage:
  python -m agentz.cli list
  python -m agentz.cli plan --priority critical,high
  python -m agentz.cli run vercel_fix_authichain_unified --mode dry-run
  python -m agentz.cli run --priority critical --mode confirm
  python -m agentz.cli run --all --mode auto --revenue-only
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from agentz.core.modes import Mode, parse_mode
from agentz.core.runner import (
    Workflow,
    execute,
    load_registry,
    resolve_order,
    write_audit_log,
)

AUDIT_LOG = Path(__file__).resolve().parent / "logs" / "runs.jsonl"


def cmd_list(args, registry: dict[str, Workflow]) -> int:
    print(f"\n{len(registry)} workflows registered\n")
    by_priority: dict[str, list[Workflow]] = {}
    for wf in registry.values():
        by_priority.setdefault(wf.priority, []).append(wf)
    for priority in ("critical", "high", "medium", "low"):
        items = by_priority.get(priority, [])
        if not items:
            continue
        print(f"  ── {priority.upper()} ──")
        for wf in items:
            rev = "💰" if wf.blocks_revenue else "  "
            print(f"  {rev} {wf.id:42s}  {wf.title}")
        print()
    return 0


def _filter(registry: dict[str, Workflow], args) -> list[str]:
    ids: list[str] = []
    if args.workflow_ids:
        ids = list(args.workflow_ids)
    elif args.all:
        ids = list(registry.keys())
    elif args.priority:
        wanted = set(p.strip() for p in args.priority.split(","))
        ids = [wf.id for wf in registry.values() if wf.priority in wanted]
    else:
        print("Specify workflow IDs, --all, or --priority", file=sys.stderr)
        sys.exit(2)

    if args.revenue_only:
        ids = [wf_id for wf_id in ids if registry[wf_id].blocks_revenue]
    return ids


def cmd_plan(args, registry: dict[str, Workflow]) -> int:
    ids = _filter(registry, args)
    ordered = resolve_order(registry, ids)
    total = sum(wf.estimated_minutes for wf in ordered)
    print(f"\nPlan: {len(ordered)} workflows, ~{total} min total\n")
    for i, wf in enumerate(ordered, 1):
        rev = "💰" if wf.blocks_revenue else "  "
        deps = f"  ← {','.join(wf.prerequisites)}" if wf.prerequisites else ""
        print(f"  {i:2d}. {rev} [{wf.priority}] {wf.id} ({wf.estimated_minutes}m){deps}")
    print()
    return 0


# ... (Keep all existing imports and functions up to cmd_run) ...

def cmd_run(args, registry: dict[str, Workflow]) -> int:
    from agentz import di  # <-- Import the new DI container

    mode = parse_mode(args.mode)
    ids = _filter(registry, args)
    ordered = resolve_order(registry, ids)

    # 1. Initialize the dependency graph based on execution mode
    injected_deps = di.init(args.mode)

    print(f"\nRunning {len(ordered)} workflows in {mode.value} mode\n")
    results = []
    for wf in ordered:
        try:
            # 2. Pass the dependencies safely down into the runner
            result = execute(wf, mode, verbose=not args.quiet, deps=injected_deps)
        except KeyboardInterrupt:
            print("\nAborted by user.")
            break
        results.append(result)
        # Stop the chain on failure unless --continue-on-error
        if result.status == "failed" and not args.continue_on_error:
            print(f"  ✗ {wf.id} failed; stopping. Use --continue-on-error to override.")
            break

    write_audit_log(results, AUDIT_LOG)

    # Summary
    print("\n──────── SUMMARY ────────")
    counts: dict[str, int] = {}
    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1
        marker = {"ok": "✓", "skipped": "·", "blocked": "⊘", "failed": "✗"}.get(r.status, "?")
        print(f"  {marker} {r.workflow_id:42s}  {r.status}  ({r.duration_s:.1f}s)")
        if r.notes:
            print(f"      └─ {r.notes}")
        if r.error:
            print(f"      └─ ERROR: {r.error.splitlines()[0]}")
    print(f"\n  totals: {counts}")
    print(f"  audit log: {AUDIT_LOG}\n")

    return 0 if counts.get("failed", 0) == 0 else 1

# ... (Keep main() and _add_filter_args exactly as they are) ...
