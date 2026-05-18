"""
agentz.core.modes
-----------------
Execution mode primitives. Wraps every workflow side-effect so the
runner can dry-run, confirm interactively, or auto-execute.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Callable

CHECKPOINT_DIR = Path(__file__).resolve().parents[1] / "logs" / "checkpoints"


class Mode(str, Enum):
    DRY_RUN = "dry-run"     # describe what would happen; touch nothing
    CONFIRM = "confirm"     # prompt before each side-effect
    AUTO    = "auto"        # execute everything without prompting


@dataclass
class ExecutionContext:
    mode: Mode
    workflow_id: str
    verbose: bool = True

    def save_state(self, data: dict[str, Any]) -> None:
        """Persist workflow state to a checkpoint file."""
        CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
        path = CHECKPOINT_DIR / f"{self.workflow_id}.json"
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        if self.verbose:
            print(f"  [{self.workflow_id}] Checkpoint saved: {path}")

    def load_state(self) -> dict[str, Any]:
        """Load persisted workflow state, if any."""
        path = CHECKPOINT_DIR / f"{self.workflow_id}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if self.verbose:
                    print(f"  [{self.workflow_id}] Checkpoint loaded.")
                return data
            except Exception:
                pass
        return {}

    def clear_state(self) -> None:
        """Remove the checkpoint file."""
        path = CHECKPOINT_DIR / f"{self.workflow_id}.json"
        if path.exists():
            path.unlink()

    def set_usage(self, token_usage: dict[str, int], cost_usd: float = 0.0) -> None:
        """Record resource usage for this execution."""
        self._token_usage = token_usage
        self._cost_usd = cost_usd

    def get_usage(self) -> tuple[dict[str, int], float]:
        """Retrieve recorded usage."""
        return getattr(self, "_token_usage", {}), getattr(self, "_cost_usd", 0.0)

    def step(self, description: str, action: Callable[[], Any] | None = None) -> Any:
        """Execute or describe a single side-effect step."""
        prefix = f"  [{self.workflow_id}] "
        if self.mode == Mode.DRY_RUN:
            print(f"{prefix}WOULD: {description}")
            return None

        if self.mode == Mode.CONFIRM:
            print(f"{prefix}NEXT:  {description}")
            answer = input(f"{prefix}Proceed? [y/N/skip-all] ").strip().lower()
            if answer == "skip-all":
                raise KeyboardInterrupt("User chose skip-all")
            if answer != "y":
                print(f"{prefix}skipped.")
                return None

        if self.verbose:
            print(f"{prefix}RUN:   {description}")
        
        if action is None:
            return None
            
        try:
            result = action()
            if self.verbose and result is not None:
                print(f"{prefix}  -> {_truncate(repr(result))}")
            return result
        except Exception as e:
            if self.verbose:
                print(f"{prefix}  [ERR] ERROR: {e}")
            raise


def _truncate(s: str, limit: int = 200) -> str:
    return s if len(s) <= limit else s[:limit] + "..."


def parse_mode(value: str) -> Mode:
    try:
        return Mode(value)
    except ValueError:
        valid = ", ".join(m.value for m in Mode)
        print(f"Invalid mode '{value}'. Use one of: {valid}", file=sys.stderr)
        sys.exit(2)
