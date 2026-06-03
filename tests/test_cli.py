"""
tests.test_cli
-----------------
Unit tests for AgentZ CLI parsing.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import importlib


def test_run_parser_accepts_revenue_only_flag():
    cli = importlib.import_module("agentz.cli")
    parser = cli.build_parser()
    args = parser.parse_args(["run", "--all", "--revenue-only", "--mode", "dry-run"])

    assert args.command == "run"
    assert args.all is True
    assert args.revenue_only is True
    assert args.mode == "dry-run"
