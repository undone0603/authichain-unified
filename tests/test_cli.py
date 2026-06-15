"""
tests.test_cli
-----------------
<<<<<<< HEAD
Regression tests for the AgentZ CLI.
=======
Unit tests for AgentZ CLI parsing.
>>>>>>> origin/add-agentz-editable
"""

import sys
from pathlib import Path
<<<<<<< HEAD
import importlib
=======
>>>>>>> origin/add-agentz-editable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

<<<<<<< HEAD

def test_cli_parser_supports_power_launch():
    cli = importlib.import_module("agentz.cli")
    parser = cli.build_parser()
    args = parser.parse_args(["power-launch", "--mode", "dry-run", "--no-parallel"])

    assert args.command == "power-launch"
    assert args.mode == "dry-run"
    assert args.no_parallel is True


def test_cli_parser_supports_revenue_only_run():
=======
import importlib


def test_run_parser_accepts_revenue_only_flag():
>>>>>>> origin/add-agentz-editable
    cli = importlib.import_module("agentz.cli")
    parser = cli.build_parser()
    args = parser.parse_args(["run", "--all", "--revenue-only", "--mode", "dry-run"])

    assert args.command == "run"
    assert args.all is True
    assert args.revenue_only is True
    assert args.mode == "dry-run"
