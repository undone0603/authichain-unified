import os, sys, json, time, uuid, logging

print("=== STARTING PHASE 3 IMPLEMENTATION AND INTEGRATION ===")

# Ensure directories exist
os.makedirs('agentz/controllers', exist_ok=True)
os.makedirs('agentz/scripts', exist_ok=True)

# 1. Create/Update agentz/controllers/agentz_controller.py
ac_code = '''"""
AutonomousController module for AgentZ Phase 3.
Wires WorkerBridge, StateStore, and CircuitBreaker directly for persistent nonce/audit tracking,
automated circuit-breaking on trust failures, queue/worker dispatch handling,
and self-healing autonomous execution cycle with recovery/reset hooks and health telemetry.
"""

import time
import uuid
import logging
from typing import Dict, Any, Optional

from agentz.integrations.worker_bridge import WorkerBridge
from agentz.core.state_store import StateStore
from agentz.core.interdiction import CircuitBreaker

logger = logging.getLogger("AutonomousController")

class AutonomousController:
    def __init__(self, db_path: str = "agentz_state.db", threshold: int = 3, cooldown: float = 5.0):
        self.state_store = StateStore(db_path)
        self.circuit_breaker = CircuitBreaker(failure_threshold=threshold, cooldown=cooldown)
        self.worker_bridge = WorkerBridge()
        self.session_nonce = str(uuid.uuid4())
        self.telemetry = {
            "total_cycles": 0,
            "successful_cycles": 0,
            "failed_cycles": 0,
            "circuit_breaker_trips": 0,
            "recovered_cycles": 0,
            "dispatched_tasks": 0
        }
        logger.info(f"AutonomousController initialized. Session Nonce: {self.session_nonce}")

    def get_health_telemetry((self) -> Dict[str, Any]:
        """Returns health metrics and telemetry for the autonomous control loop."""
        return {
            "session_nonce": self.session_nonce,
            "telemetry": self.telemetry,
            "circuit_breaker_state": self.circuit_breaker.state,
            "circuit_breaker_failures": self.circuit_breaker.failure_count,
            "timestamp": time.time()
        }

    def reset_recovery_hook(self) -> Dict[str, Any]:
        """Recovery and reset hook to restore controller to healthy state."""
        logger.warning("Executing recovery/reset hook...")
        self.circuit_breaker.reset()
        self.session_nonce = str(uuid.uuid4())
        self.telemetry["recovered_cycles"] += 1
        audit_event = {
            "event": "RECOVERY_RESET",
            "new_nonce": self.session_nonce,
            "timestamp": time.time()
        }
        self.state_store.record_event("RECOVERY", audit_event)
        return {"status": "RECOVERED", "session_nonce": self.session_nonce}

    def execute_cycle(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Runs a single iteration of self-healing autonomous execution cycle."""
        self.telemetry["total_cycles"] += 1
        task_id = task.get("id", str(uuid.uuid4()))
        nonce = f"{self.session_nonce}:{self.telemetry['total_cycles']}"

        # Persistent audit record
        self.state_store.record_event("CYCLE_START", {"task_id": task_id, "nonce": nonce, "task": task})

        # Check circuit breaker
        if not self.circuit_breaker.can_execute():
            self.telemetry["circuit_breaker_trips"] += 1
            self.telemetry["failed_cycles"] += 1
            self.state_store.record_event("CIRCUIT_BROKEN", {"task_id": task_id, "nonce": nonce})
            logger.error("Circuit breaker is OPEN. Attempting auto-recovery...")
            # Auto-healing attempt
            self.reset_recovery_hook()
            if not self.circuit_breaker.can_execute():
                return {"status": "BLOCKED", "reason": "Circuit breaker open", "nonce": nonce}

        # Dispatch via WorkerBridge
        try:
            self.telemetry["dispatched_tasks"] += 1
            dispatch_res = self.worker_bridge.dispatch(task)

            if dispatch_res.get("status") == "FAILURE":
                self.circuit_breaker.record_failure()
                self.telemetry["failed_cycles"] += 1
                self.state_store.record_event("CYCLE_FAILURE", {"task_id": task_id, "nonce": nonce, "res": dispatch_res})
                return {"status": "FAILED", "dispatch_res": dispatch_res, "nonce": nonce}

            self.circuit_breaker.record_success()
            self.telemetry["successful_cycles"] += 1
            self.state_store.record_event("CYCLE_SUCCESS", {"task_id": task_id, "nonce": nonce, "res": dispatch_res})
            return {"status": "SUCCESS", "dispatch_res": dispatch_res, "nonce": nonce}

        except Exception as e:
            logger.exception("Unexpected error in autonomous execution cycle")
            self.circuit_breaker.record_failure()
            self.telemetry["failed_cycles"] += 1
            self.state_store.record_event("CYCLE_ERROR", {"task_id": task_id, "nonce": nonce, "error": str(e)})
            return {"status": "ERROR", "error": str(e), "nonce": nonce}
'''

# Fix syntax if needed
ac_code = ac_code.replace("get_health_telemetry((self)", "get_health_telemetry(self)")

with open('agentz/controllers/agentz_controller.py', 'w') as f:
    f.write(ac_code)

print("Created agentz/controllers/agentz_controller.py successfully!")

# 2. Create/Update agentz/scripts/run_autonomous.py
ra_code = '''"""
Daemon runner script for AgentZ Autonomous Control.
Integrates AutonomousController for continuous self-healing autonomous cycle execution.
"""

import sys
import time
import logging
from typing import Optional, List, Dict, Any

from agentz.controllers.agentz_controller import AutonomousController

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("RunAutonomousDaemon")

def run_daemon(tasks: Optional[List[Dict[str, Any]]] = None, max_cycles: int = 5, db_path: str = ":memory:"):
    logger.info("Starting AgentZ Autonomous Control Daemon...")
    controller = AutonomousController(db_path=db_path)

    default_tasks = tasks or [
        {"id": f"task-{i}", "payload": f"Autonomous workload step {i}"} for i in range(1, max_cycles + 1)
    ]

    results = []
    for task in default_tasks:
        logger.info(f"Executing task: {task['id']}")
        res = controller.execute_cycle(task)
        results.append(res)
        telemetry = controller.get_health_telemetry()
        logger.info(f"Cycle result: {res['status']} | Telemetry: {telemetry['telemetry']}")
        time.sleep(0.1)

    logger.info("Daemon run complete.")
    return controller, results

if __name__ == "__main__":
    controller, results = run_daemon(max_cycles=3)
    print("Final Health Telemetry:", json.dumps(controller.get_health_telemetry(), indent=2))
'''

with open('agentz/scripts/run_autonomous.py', 'w') as f:
    f.write(ra_code)

print("Created agentz/scripts/run_autonomous.py successfully!")

# Ensure __init__.py files exist
open('agentz/__init__.py', 'a').close()
open('agentz/controllers/__init__.py', 'a').close()
open('agentz/scripts/__init__.py', 'a').close()

