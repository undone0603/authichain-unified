"""
agentz.core.modes
-----------------
Execution mode primitives. Wraps every workflow side-effect so the
runner can dry-run, confirm interactively, or auto-execute.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, List
from agentz.core.intelligence import get_recent_success_signals


class Mode(str, Enum):
    DRY_RUN = "dry-run"     # describe what would happen; touch nothing
    CONFIRM = "confirm"     # prompt before each side-effect
    AUTO    = "auto"        # execute everything without prompting


@dataclass
class ExecutionContext:
    mode: Mode
    workflow_id: str
    verbose: bool = True
    intelligence_signals: List[dict] = None

    def load_intelligence(self, limit: int = 5):
        """Loads recent success signals from the AuthiChain training ledger."""
        self.intelligence_signals = get_recent_success_signals(limit)

    def step(self, description: str, action: Callable[[], Any] | None = None) -> Any:
        """Execute or describe a single side-effect step."""
        prefix = f"  [{self.workflow_id}] "
        if self.mode == Mode.DRY_RUN:
            print(f"{prefix}WOULD: {description}")
            return None

        if self.mode == Mode.CONFIRM:
            print(f"{prefix}NEXT:  {description}")
            answer = input(f"{prefix}Run? [y/N/skip-all] ").strip().lower()
            if answer == "skip-all":
                raise KeyboardInterrupt("User chose skip-all")
            if answer != "y":
                print(f"{prefix}skipped.")
                return None

        if self.verbose:
            print(f"{prefix}RUN:   {description}")
        if action is None:
            return None
        result = action()
        if self.verbose and result is not None:
            print(f"{prefix}  → {_truncate(repr(result))}")
        return result


def _truncate(s: str, limit: int = 200) -> str:
    return s if len(s) <= limit else s[:limit] + "…"


def parse_mode(value: str) -> Mode:
    try:
        return Mode(value)
    except ValueError:
        valid = ", ".join(m.value for m in Mode)
        print(f"Invalid mode '{value}'. Use one of: {valid}", file=sys.stderr)
        sys.exit(2)
