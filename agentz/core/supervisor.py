"""
agentz.core.supervisor
----------------------
Meta-Cognition agent: Analyzes runs.jsonl for efficiency bottlenecks 
and triggers automated refactoring/tuning.
"""
from __future__ import annotations
import json
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass
from typing import List, Dict

from agentz.core.runner import load_registry
from agentz.core.refactorer import Refactorer
from agentz.core.tester import TestGenerator

# Path to the audit logs
AUDIT_LOG = Path(__file__).resolve().parents[1] / "logs" / "runs.jsonl"

@dataclass
class WorkflowMetrics:
    workflow_id: str
    runs: int = 0
    total_duration: float = 0.0
    failures: int = 0
    total_cost: float = 0.0

class Supervisor:
    def __init__(self, log_path: Path = AUDIT_LOG):
        self.log_path = log_path
        self.refactorer = Refactorer()
        self.tester = TestGenerator()

    def analyze(self) -> Dict[str, WorkflowMetrics]:
        metrics = defaultdict(lambda: WorkflowMetrics(workflow_id="unknown"))
        
        if not self.log_path.exists():
            return {}

        with self.log_path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    data = json.loads(line)
                    wf_id = data["workflow_id"]
                    
                    if metrics[wf_id].workflow_id == "unknown":
                        metrics[wf_id].workflow_id = wf_id
                    
                    m = metrics[wf_id]
                    m.runs += 1
                    m.total_duration += data.get("duration_s", 0)
                    if data["status"] == "failed":
                        m.failures += 1
                    m.total_cost += data.get("cost_usd", 0)
                except (json.JSONDecodeError, KeyError):
                    continue
        return metrics

    def run_optimization_cycle(self):
        """Analyze metrics and autonomously trigger fix cycles."""
        metrics = self.analyze()
        print("--- Supervisor: Active Optimization Mode ---")
        for wf_id, m in metrics.items():
            failure_rate = m.failures / m.runs if m.runs > 0 else 0
            
            if failure_rate > 0.1:
                self._run_fix_cycle(wf_id, "High Failure Rate")

    def _run_fix_cycle(self, wf_id: str, reason: str):
        print(f"  [!] Triggering FIX CYCLE for {wf_id}: {reason}")
        
        # 1. Fetch failure context
        registry = load_registry()
        wf = registry.get(wf_id)
        if not wf:
            print(f"    [!] Workflow {wf_id} not found in registry.")
            return

        handler = wf.handler
        error_trace = "Unknown error"
        
        # Find latest error in logs
        if self.log_path.exists():
            with self.log_path.open("r", encoding="utf-8") as f:
                last_error = None
                for line in f:
                    data = json.loads(line)
                    if data["workflow_id"] == wf_id and data["status"] == "failed":
                        last_error = data.get("error")
                if last_error:
                    error_trace = last_error

        # 2. Refactor
        print(f"    -> Generating patch for handler: {handler}...")
        patch = self.refactorer.generate_patch(wf_id, handler, error_trace)
        
        # 3. Test
        print("    -> Generating test...")
        test = self.tester.generate_test(wf_id, handler, error_trace)
        
        # 4. Verify
        print("    -> Verifying patch...")
        if self.tester.run_test(test):
            print("    -> Fix verified. Proposing commit.")
            # Full impl would write `patch` to `handler_path` here
        else:
            print("    -> Fix failed verification.")

if __name__ == "__main__":
    supervisor = Supervisor()
    supervisor.run_optimization_cycle()
