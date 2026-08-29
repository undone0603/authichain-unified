"""
agentz.core.workflow_engine
---------------------------
Provides a stateful, parameterizable execution engine for AgentZ workflows.
Allows workflows to be defined as a series of steps that can be persisted and resumed.
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.workflow_engine")

# Persistence path for workflow states
STATE_DIR = Path(__file__).resolve().parents[1] / "logs" / "workflow_states"

@dataclass
class StepResult:
    status: str  # "success" | "failure" | "skipped"
    output: Any = None
    error: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class WorkflowState:
    run_id: str
    workflow_id: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    results: Dict[str, StepResult] = field(default_factory=dict)
    current_step: Optional[str] = None
    status: str = "pending"  # "pending" | "running" | "completed" | "failed"
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)

    @classmethod
    def from_json(cls, data: str) -> WorkflowState:
        obj = json.loads(data)
        # Reconstruct StepResult objects
        results = {k: StepResult(**v) for k, v in obj.get("results", {}).items()}
        return cls(**{**obj, "results": results})

class WorkflowEngine:
    """
    Engine that manages the execution of a stateful workflow.
    It tracks progress and allows resuming from the last failed step.
    """

    def __init__(self, workflow_id: str, run_id: Optional[str] = None, parameters: Optional[Dict[str, Any]] = None):
        self.workflow_id = workflow_id
        self.run_id = run_id or f"run_{uuid.uuid4().hex[:8]}"
        self.parameters = parameters or {}
        self.state = self._load_or_create_state()

    def _load_or_create_state(self) -> WorkflowState:
        state_file = STATE_DIR / f"{self.workflow_id}_{self.run_id}.json"
        if state_file.exists():
            logger.info(f"Resuming existing workflow run: {self.run_id}")
            return WorkflowState.from_json(state_file.read_text())
        
        return WorkflowState(
            run_id=self.run_id,
            workflow_id=self.workflow_id,
            parameters=self.parameters
        )

    def _save_state(self):
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        state_file = STATE_DIR / f"{self.workflow_id}_{self.run_id}.json"
        state_file.write_text(self.state.to_json())

    def execute_step(self, step_id: str, func: Callable[..., Any], *args, **kwargs) -> Any:
        """
        Executes a step if it hasn't already succeeded.
        """
        if step_id in self.state.results and self.state.results[step_id].status == "success":
            logger.info(f"Step {step_id} already succeeded. Skipping.")
            return self.state.results[step_id].output

        self.state.current_step = step_id
        self.state.status = "running"
        self._save_state()

        try:
            logger.info(f"Executing step: {step_id}")
            result = func(*args, **kwargs)
            
            self.state.results[step_id] = StepResult(status="success", output=result)
            self._save_state()
            return result
        except Exception as e:
            logger.error(f"Step {step_id} failed: {e}")
            self.state.results[step_id] = StepResult(status="failure", error=str(e))
            self.state.status = "failed"
            self._save_state()
            raise

    def complete(self):
        self.state.status = "completed"
        self.state.completed_at = datetime.now(timezone.utc).isoformat()
        self._save_state()

    def get_result(self, step_id: str) -> Any:
        res = self.state.results.get(step_id)
        return res.output if res else None
