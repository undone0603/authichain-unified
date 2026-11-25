"""
agentz.core.modes
-----------------
Execution mode primitives. Wraps every workflow side-effect so the
runner can dry-run, confirm interactively, or auto-execute.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
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
    parameters: dict[str, Any] = field(default_factory=dict)

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

    def gated_step(
        self,
        description: str,
        executor: Any,
        action: Any,
        *,
        target: str = "workspace",
        policy: Any = None,
        approver: Any = None,
        receipts_path: Any = None,
    ) -> Any:
        """Run a side-effect through the consequence gate (ConseqGate).

        The action is pre-executed in a snapshot in EVERY mode and judged on
        its observed effects:

        * dry-run: prints the real effects and verdict, changes nothing;
        * confirm: a blocked action is rolled back without prompting; an
          allowed one asks y/N before it is committed;
        * auto:    commits only allowed actions.

        A block is final. Returns the GateDecision. ``step`` is unchanged.
        """
        from agentz.core.consequence_gate import ConsequenceGate, write_receipt

        prefix = f"  [{self.workflow_id}] "
        gate = ConsequenceGate(executor, policy=policy, approver=approver, bot=self.workflow_id)
        decision, handle = gate.evaluate(action)
        decision.receipt["target"] = target
        decision.receipt["mode"] = self.mode.value
        decision.receipt["description"] = description[:200]
        totals = decision.report.get("totals", {})
        rows = decision.report.get("row_deltas", {})
        verdict = "ALLOW" if decision.allowed else "BLOCK"
        if self.verbose:
            print(f"{prefix}GATE:  {description} -> {verdict} ({decision.reason})")
            print(f"{prefix}  effects: files={totals} rows={rows}")

        if self.mode == Mode.DRY_RUN:
            gate.finish(decision, handle, commit=False, verdict="dry_run")
        elif not decision.allowed:
            gate.finish(decision, handle, commit=False, verdict="abstained")
        elif self.mode == Mode.CONFIRM:
            answer = input(f"{prefix}Commit these effects? [y/N] ").strip().lower()
            if answer == "y":
                gate.finish(decision, handle, commit=True)
            else:
                gate.finish(decision, handle, commit=False, verdict="declined")
                if self.verbose:
                    print(f"{prefix}skipped.")
        else:
            gate.finish(decision, handle, commit=True)

        try:
            write_receipt(decision.receipt, receipts_path)
        except OSError as exc:  # a receipt failure never turns into an execution
            if self.verbose:
                print(f"{prefix}  [WARN] receipt not written: {exc}")
        return decision

def _truncate(s: str, limit: int = 200) -> str:
    return s if len(s) <= limit else s[:limit] + "..."


def parse_mode(value: str) -> Mode:
    try:
        return Mode(value)
    except ValueError:
        valid = ", ".join(m.value for m in Mode)
        print(f"Invalid mode '{value}'. Use one of: {valid}", file=sys.stderr)
        sys.exit(2)
