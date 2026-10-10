"""
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
