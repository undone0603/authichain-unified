"""CLI surface for the autonomy layer: approvals, kill switch, ledger, autoloop.

Registered into ``python -m agentz.cli`` (see ``agentz/cli.py``). The runner's
approval hint points here: ``python -m agentz.cli approvals approve <id>``.
Approving is a human action; nothing in the autonomy layer approves on its own.
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys
import time
from dataclasses import asdict

from agentz.core import autoloop, autonomy_policy as ap

COMMANDS = ("approvals", "kill", "resume", "ledger", "autoloop")


def register(sub) -> None:
    approvals = sub.add_parser("approvals", help="List, approve or reject queued human approvals")
    asub = approvals.add_subparsers(dest="approvals_cmd", required=True)
    listing = asub.add_parser("list", help="Show pending and approved requests")
    listing.add_argument("--all", action="store_true", help="include rejected, consumed and expired")
    for name in ("approve", "reject"):
        item = asub.add_parser(name, help="%s a pending request" % name.capitalize())
        item.add_argument("request_id")
        item.add_argument("--note", default="")

    kill = sub.add_parser("kill", help="Engage the kill switch: every guarded run halts")
    kill.add_argument("--reason", default="manual")
    sub.add_parser("resume", help="Release the kill switch")

    ledger = sub.add_parser("ledger", help="Show recent run-loop ledger events")
    ledger.add_argument("--tail", type=int, default=20)

    loop = sub.add_parser("autoloop", help="Unattended, dependency-ordered run (default: dry-run)")
    loop.add_argument("--mode", choices=["dry-run", "auto"], default="dry-run")
    target = loop.add_mutually_exclusive_group()
    target.add_argument("-w", "--workflow", action="append", dest="workflows", default=None,
                        help="workflow id (repeatable)")
    target.add_argument("--all", action="store_true", dest="run_all", help="every eligible workflow")
    loop.add_argument("--allow-auto", action="store_true", help="permit --mode auto")
    loop.add_argument("--allow-all", action="store_true", help="permit --all together with --mode auto")
    loop.add_argument("--max-risk", choices=["low", "medium", "high", "critical"], default="medium")
    loop.add_argument("--max-steps", type=int, default=25)
    loop.add_argument("--no-prereqs", action="store_true", help="do not pull in prerequisites")
    loop.add_argument("--exclude", action="append", default=[], help="extra id substring to exclude")
    loop.add_argument("--json", action="store_true", dest="as_json")


def _approvals(args: argparse.Namespace) -> int:
    if args.approvals_cmd == "list":
        rows = ap.list_requests()
        if not args.all:
            rows = [r for r in rows if r.get("status") in ("pending", "approved")]
        if not rows:
            print("[approvals] none")
            return 0
        for r in rows:
            hours = int((float(r.get("expires_at", 0)) - time.time()) / 3600)
            print("%s  %-9s  %s  mode=%s  expires_in=%dh  %s" % (
                r.get("id"), r.get("status", "?"), r.get("workflow_id"), r.get("mode"), hours, r.get("reason", "")))
        return 0
    approved = args.approvals_cmd == "approve"
    try:
        who = getpass.getuser()
    except Exception:  # noqa: BLE001 - no passwd entry in some containers
        who = "human"
    if not ap.decide(args.request_id, approved, by=who, note=args.note):
        print("[approvals] no pending request with id %s" % args.request_id, file=sys.stderr)
        return 1
    print("[approvals] %s %s by %s" % (args.request_id, "approved" if approved else "rejected", who))
    return 0


def _autoloop(args: argparse.Namespace) -> int:
    if not args.workflows and not args.run_all:
        print("autoloop needs --workflow ID (repeatable) or --all", file=sys.stderr)
        return 2
    try:
        entries = ap.load_registry()
    except ap.PolicyUnavailable as exc:
        print("[autoloop] policy unavailable: %s" % exc, file=sys.stderr)
        return autoloop.EXIT_POLICY
    if not entries:
        print("[autoloop] registry is empty or missing; nothing to run", file=sys.stderr)
        return 2
    policies = [ap.policy_for(e["id"], entries) for e in entries if e.get("id")]
    try:
        report = autoloop.run_loop(
            policies,
            selected=None if args.run_all else args.workflows,
            mode=args.mode,
            allow_auto=args.allow_auto,
            allow_all=args.allow_all,
            max_risk=args.max_risk,
            exclude=tuple(autoloop.DEFAULT_EXCLUDE) + tuple(args.exclude),
            include_prerequisites=not args.no_prereqs,
            max_steps=args.max_steps,
        )
    except autoloop.AutoModeNotAllowed as exc:
        print("[autoloop] refused: %s" % exc, file=sys.stderr)
        return 2
    if args.as_json:
        print(json.dumps({
            "run_id": report.run_id, "mode": report.mode, "exit_code": report.exit_code,
            "halted": report.halted, "halt_reason": report.halt_reason, "counts": report.counts(),
            "steps": [asdict(s) for s in report.steps],
        }, indent=2))
    else:
        print(report.summary())
    return report.exit_code


def dispatch(args: argparse.Namespace) -> int:
    cmd = args.command
    if cmd == "approvals":
        return _approvals(args)
    if cmd == "kill":
        path = ap.engage_kill_switch(args.reason)
        print("[kill] engaged (%s). Every guarded run now halts; release with: resume" % path)
        return 0
    if cmd == "resume":
        removed = ap.release_kill_switch()
        killed, why = ap.kill_switch_status()
        if killed:
            print("[resume] kill file removed=%s but the switch is still engaged: %s" % (removed, why), file=sys.stderr)
            return 1
        print("[resume] kill switch released" if removed else "[resume] kill switch was not engaged")
        return 0
    if cmd == "ledger":
        events = autoloop.read_ledger(limit=args.tail)
        if not events:
            print("[ledger] empty")
        for e in events:
            print(json.dumps(e, sort_keys=True))
        return 0
    if cmd == "autoloop":
        return _autoloop(args)
    return 2
